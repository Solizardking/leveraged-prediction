import type { Metadata } from "next";
import { OracleMarketPage } from "@/app/components/oracle-market-page";

export const metadata: Metadata = {
  title: "Oracle markets · Lever",
  description:
    "Spot and perps on metals, FX, equities, and crypto, priced by the Pyth fixed-rate feed and funded from a confidential Privacy Rings balance",
};

export default function Page() {
  return <OracleMarketPage />;
}
