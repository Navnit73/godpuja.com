// Shared (client + server safe). What a Pooja Vidhi guide needs before the public can see it.
// PRD v1.1 §8: "Religious content should be reviewed for accuracy, tradition and cultural sensitivity."
type Checkable = { summary?: string | null; steps?: unknown[] | null; body?: string | null; reviewer?: string | null; reviewedAt?: unknown };

/** Field name -> message. Empty object = ready to publish or schedule. */
export function publishProblems(v: Checkable): Record<string, string> {
  const f: Record<string, string> = {};
  if (!v.summary?.trim()) f.summary = "Add an introduction before publishing";
  if (!(v.steps?.length || v.body?.trim())) f.steps = "Add at least one step (or some body text) before publishing";
  if (!v.reviewer?.trim()) f.reviewer = "Name who reviewed this for accuracy before publishing";
  if (!v.reviewedAt) f.reviewedAt = "Add the date it was reviewed before publishing";
  return f;
}
