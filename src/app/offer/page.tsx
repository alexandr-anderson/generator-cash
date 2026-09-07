import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { OFFER_INTRO, OFFER_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Оферта — postvmeste.ru",
};

export default function Offer() {
  return (
    <LegalPage
      title="Публичная оферта"
      intro={OFFER_INTRO}
      sections={OFFER_SECTIONS}
    />
  );
}
