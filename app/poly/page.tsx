import type { Metadata } from "next";
import { PolyPage } from "@/app/components/poly-page";

export const metadata: Metadata = {
  title: "Poly · Lever",
  description:
    "Poly is a paper-only Polymarket prediction agent. It paper-calls only when Jev's fair probability beats the market price by 8+ points — no wallet, no live trading.",
};

export default function Page() {
  return <PolyPage />;
}
