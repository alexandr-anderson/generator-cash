import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { getLandingVariant, LANDING_VARIANTS } from "@/lib/landing-variants";

export function generateStaticParams() {
  return LANDING_VARIANTS.map((variant) => ({ variant: variant.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const { variant } = await params;
  const config = getLandingVariant(variant);
  if (!config) return {};
  return {
    title: `${config.name} - лендинг postvmeste`,
    description: config.sub,
  };
}

export default async function LandingVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  const config = getLandingVariant(variant);
  if (!config) notFound();
  return <LandingPage variant={config} />;
}
