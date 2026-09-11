import { PublicShell } from "@/components/public-shell";
import type { LegalSection } from "@/lib/legal";
import { SUPPORT_EMAIL, legalVersionLabel } from "@/lib/legal";

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
        <p className="legal-kicker">Редакция от {legalVersionLabel()}</p>
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
        <p>
          Вопросы по документу: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </article>
    </PublicShell>
  );
}
