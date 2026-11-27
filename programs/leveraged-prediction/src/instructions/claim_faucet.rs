use super::*;

/// Records a wallet's single devnet faucet claim on-chain.
///
/// The `claim_receipt` PDA is created with `init` under seeds
/// `[CLAIM_RECEIPT_SEED, wallet]`. Because the address is derived only from
/// the claiming wallet, a second claim for the same wallet targets the same
/// account and fails outright at initialization — there is no counter to
/// reset and no off-chain state to lose. The faucet authority (the mint
/// authority, which also pays for the account) is the only signer, and the
/// app's faucet path includes this instruction in the same transaction as
/// the mint so the claim and the funds land atomically.
pub fn handler(ctx: Context<ClaimFaucet>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    let clock = Clock::get()?;
    let receipt = &mut ctx.accounts.claim_receipt;
    receipt.wallet = ctx.accounts.wallet.key();
    receipt.mint = ctx.accounts.collateral_mint.key();
    receipt.amount = amount;
    receipt.claimed_at = clock.unix_timestamp;
    receipt.bump = ctx.bumps.claim_receipt;
    emit!(FaucetClaimed {
        wallet: receipt.wallet,
        mint: receipt.mint,
        amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimFaucet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// The wallet receiving the faucet claim. Not a signer: the faucet
    /// authority claims on its behalf as part of the mint transaction.
    /// CHECK: only used as a PDA seed and recorded in the receipt; no data
    /// is read from this account and no funds move to or from it here.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [CLAIM_RECEIPT_SEED, wallet.key().as_ref()],
        bump
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,
    #[account(seeds = [CONFIG_SEED], bump = protocol_config.bump, has_one = collateral_mint)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub collateral_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}
