import type { CostItem } from "@/lib/cost-item-types"

function stripUndefinedDeep(v: unknown): unknown {
  if (v === undefined) return undefined
  if (v === null || typeof v !== "object") return v
  if (Array.isArray(v)) {
    return v.map(stripUndefinedDeep).filter((x) => x !== undefined)
  }
  const o = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(o)) {
    if (val === undefined) continue
    const next = stripUndefinedDeep(val)
    if (next !== undefined) out[k] = next
  }
  return out
}

/** Firestore-friendly plain object (no undefined values). */
export function costItemToFirestorePayload(item: CostItem): Record<string, unknown> {
  return stripUndefinedDeep(item) as Record<string, unknown>
}
