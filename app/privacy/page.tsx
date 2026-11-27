import type { Metadata } from "next";
import { PrivacyPage } from "@/app/components/privacy-page";
import "./privacy.css";

export const metadata: Metadata = {
  title: "Privacy · Lever",
  description:
    "Confidential collateral for Lever positions with Helius Solana Privacy Rings",
};

export default function Page() {
  return <PrivacyPage />;
}
