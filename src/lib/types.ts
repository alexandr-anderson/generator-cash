export type ProjectStep = "sources" | "dna" | "brief" | "generate" | "edit";

export type Evidence = {
  label: string;
  source: string;
};

export type StyleTrait = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  evidence: Evidence[];
};

export type StyleProfile = {
  name: string;
  summary: string;
  colors: string[];
  traits: StyleTrait[];
  approved: boolean;
};

export type CreativeBrief = {
  topic: string;
  audience: string;
  goal: string;
  cta: string;
  mood: string;
};

export type CreativeFormat = "reel" | "post" | "carousel";

export type CreativeDirection = {
  id: string;
  name: string;
  rationale: string;
  headline: string;
  eyebrow: string;
  body: string;
  accent: string;
  background: string;
  foreground: string;
  format: CreativeFormat;
  slides: string[];
};

export type ProjectMetrics = {
  startedAt: number;
  exportedAssets: number;
  generations: number;
  edits: number;
};
