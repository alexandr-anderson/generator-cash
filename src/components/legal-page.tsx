import { PublicShell } from "@/components/public-shell";
import type { LegalSection } from "@/lib/legal";
import { LEGAL_VERSION } from "@/lib/legal";

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <PublicShell>
      <article className="legal-doc">
        <p className="legal-kicker">Версия {LEGAL_VERSION}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
