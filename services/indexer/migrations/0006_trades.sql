-- One row per trade (position), recorded from the open event and completed
-- by the close event, independent of the positions projection. A close that
-- is indexed before its create still lands here as a partial row (no user /
-- open fields yet); the later create fills those fields in and clears
-- is_partial, so no trade is lost to event ordering.
CREATE TABLE indexer.trades (
    network TEXT NOT NULL,
    program_id TEXT NOT NULL,
    market_id INTEGER NOT NULL CHECK (market_id BETWEEN 0 AND 65535),
    position_id BIGINT NOT NULL CHECK (position_id BETWEEN 0 AND 4294967295),
    user_pubkey TEXT,
    entry_price BIGINT,
    collateral BIGINT CHECK (collateral IS NULL OR collateral BETWEEN 0 AND 4294967295),
    direction TEXT CHECK (direction IS NULL OR direction IN ('up', 'down')),
    expires_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    lifecycle_status TEXT NOT NULL DEFAULT 'open'
        CHECK (lifecycle_status IN ('open', 'settled', 'refunded')),
    outcome TEXT CHECK (outcome IS NULL OR outcome IN ('won', 'lost', 'breakeven', 'refunded')),
    payout_amount BIGINT CHECK (payout_amount IS NULL OR payout_amount >= 0),
    lp_fee_amount BIGINT CHECK (lp_fee_amount IS NULL OR lp_fee_amount >= 0),
    platform_fee_amount BIGINT CHECK (platform_fee_amount IS NULL OR platform_fee_amount >= 0),
    total_fee_amount BIGINT GENERATED ALWAYS AS (
        CASE
            WHEN lp_fee_amount IS NULL OR platform_fee_amount IS NULL THEN NULL
            ELSE lp_fee_amount + platform_fee_amount
        END
    ) STORED,
    net_pnl BIGINT GENERATED ALWAYS AS (
        CASE
            WHEN payout_amount IS NULL OR collateral IS NULL THEN NULL
            ELSE payout_amount - collateral
        END
    ) STORED,
    closed_at TIMESTAMPTZ,
    event_contract_version SMALLINT NOT NULL,
    is_partial BOOLEAN NOT NULL DEFAULT false,
    created_source_id BIGINT REFERENCES indexer.chain_sources(id),
    created_signature TEXT,
    closed_source_id BIGINT REFERENCES indexer.chain_sources(id),
    closed_signature TEXT,
    last_slot BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (network, program_id, market_id, position_id)
);

CREATE INDEX trades_user_history
    ON indexer.trades (network, program_id, user_pubkey, closed_at DESC, market_id, position_id);

-- Backfill every trade the positions projection already knows about.
INSERT INTO indexer.trades (
    network, program_id, market_id, position_id, user_pubkey, entry_price,
    collateral, direction, expires_at, opened_at, lifecycle_status, outcome,
    payout_amount, lp_fee_amount, platform_fee_amount, closed_at,
    event_contract_version, is_partial, created_source_id, created_signature,
    closed_source_id, closed_signature, last_slot, updated_at
)
SELECT
    network, program_id, market_id, position_id, user_pubkey, entry_price,
    collateral, direction, expires_at, opened_at, lifecycle_status, outcome,
    payout_amount, lp_fee_amount, platform_fee_amount, closed_at,
    event_contract_version, is_partial, created_source_id, created_signature,
    closed_source_id, closed_signature, last_slot, updated_at
FROM indexer.positions
ON CONFLICT (network, program_id, market_id, position_id) DO NOTHING;
