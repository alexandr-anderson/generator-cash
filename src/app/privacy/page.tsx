import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Конфиденциальность — postvmeste.ru",
};

export default function Privacy() {
  return (
    <LegalPage
      title="Политика конфиденциальности"
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
    />
  );
}
