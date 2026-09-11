import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEMO_ARCHIVE,
  DEMO_RUBRICS,
  DEMO_SUBSCRIPTION,
  DEMO_USER,
  DEMO_EMAIL,
  DEMO_WORKS,
} from "../src/lib/demo-account";

const prisma = new PrismaClient();

async function main() {
  const password = (process.env.SEED_DEMO_PASSWORD || "").trim();
  if (!password) {
    throw new Error(
      "SEED_DEMO_PASSWORD не задан. Задайте пароль демо-аккаунта в окружении перед сидом — " +
        "в репозитории он не хранится.",
    );
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      id: DEMO_USER.id,
      email: DEMO_EMAIL,
      passwordHash,
      emailVerifiedAt: new Date(),
      niche: DEMO_USER.niche,
      audience: DEMO_USER.audience,
      tone: DEMO_USER.tone,
      colors: DEMO_USER.colors,
      profileCompleted: true,
      profilePopupShown: true,
      usage: {
        create: {
          tier: DEMO_SUBSCRIPTION.tier,
          generationsPerWeek: DEMO_SUBSCRIPTION.generationsPerWeek,
          priceRub: DEMO_SUBSCRIPTION.priceRub,
          generationsUsed: DEMO_SUBSCRIPTION.generationsUsed,
          weekStartedAt: new Date(),
          initialFreeRemaining: 0,
        },
      },
    },
  });

  for (const rubric of DEMO_RUBRICS) {
    await prisma.rubric.create({
      data: {
        id: rubric.id,
        userId: user.id,
        name: rubric.name,
        colors: rubric.colors ?? [],
        createdAt: new Date(rubric.createdAt),
      },
    });
  }

  for (const work of DEMO_WORKS) {
    await prisma.work.create({
      data: {
        id: work.id,
        userId: user.id,
        rubricId: work.rubricId,
        format: work.format,
        topic: work.topic,
        slides: work.slides,
        caption: work.caption,
        hashtags: work.hashtags,
        reelScript: work.reelScript ?? null,
        layout: work.layout,
        background: work.background,
        accent: work.accent,
        foreground: work.foreground,
        eyebrow: work.eyebrow,
        brandLabel: work.brandLabel,
        createdAt: new Date(work.createdAt),
      },
    });
  }

  console.info(`Seeded ${DEMO_EMAIL} (пароль из SEED_DEMO_PASSWORD)`);
  console.info(`Rubrics ${DEMO_RUBRICS.length}, works ${DEMO_WORKS.length}, archive ${DEMO_ARCHIVE.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
