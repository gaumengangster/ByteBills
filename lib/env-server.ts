/**
 * Server-only env (API routes, server components). No `NEXT_PUBLIC_` prefix.
 */

/** Fallback when `OPENAI_COSTS_MODEL` / `OPENAI_VISION_MODEL` / `OPENAI_TEXT_MODEL` are unset. */
export function getOpenAiCostsModelDefault(): string {
  return process.env.OPENAI_COSTS_MODEL_DEFAULT ?? "gpt-4o-mini"
}
