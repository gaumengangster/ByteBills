/**
 * Per-type cost inclusion rules and context-aware EUR aggregation for reports.
 */

import type { CostItemType } from "@/lib/cost-item-types"
import {
  billContributesInputVat,
  persistedBillGrossEur,
  persistedBillNetEur,
  persistedBillSubtotalEurForEuer,
  persistedBillVatEur,
} from "@/lib/report-eur-rates"

export type CostReportContext =
  | "dashboard"
  | "vatQuarter"
  | "euerNet"
  | "euerPauschale"
  | "euerAfa"

const CONTEXTS_BY_TYPE: Record<CostItemType, readonly CostReportContext[]> = {
  cost_invoice: ["dashboard", "vatQuarter", "euerNet"],
  cost_partial_business_use: ["dashboard", "vatQuarter", "euerNet"],
  cost_afa: ["dashboard", "vatQuarter"],
  cost_pauschale: ["dashboard", "euerPauschale"],
  cost_afa_multiyear_slice: ["euerAfa"],
}

function costType(doc: Record<string, unknown>): CostItemType | null {
  const t = doc.type
  if (typeof t !== "string") return null
  if (t in CONTEXTS_BY_TYPE) return t as CostItemType
  return null
}

function finiteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export function costIncludedInContext(
  doc: Record<string, unknown>,
  ctx: CostReportContext,
): boolean {
  const type = costType(doc)
  if (!type) return false
  return CONTEXTS_BY_TYPE[type].includes(ctx)
}

function pauschaleAmountEur(doc: Record<string, unknown>): number | null {
  return finiteNum(doc.calculatedAmount) ?? finiteNum(doc.amountNet)
}

/** Net EUR for a cost doc in the given report context (null = skip / missing FX). */
export function costNetEurForContext(
  doc: Record<string, unknown>,
  ctx: CostReportContext,
): number | null {
  if (!costIncludedInContext(doc, ctx)) return null

  const type = costType(doc)
  if (type === "cost_pauschale") return pauschaleAmountEur(doc)
  if (ctx === "euerNet") return persistedBillSubtotalEurForEuer(doc)
  return persistedBillNetEur(doc)
}

/** VAT EUR for a cost doc in the given report context. */
export function costVatEurForContext(
  doc: Record<string, unknown>,
  ctx: CostReportContext,
): number | null {
  if (!costIncludedInContext(doc, ctx)) return null

  const type = costType(doc)
  if (type === "cost_pauschale") return 0

  if (ctx === "vatQuarter") {
    if (!billContributesInputVat(doc)) return null
    return persistedBillVatEur(doc)
  }

  if (ctx === "dashboard") {
    return persistedBillVatEur(doc)
  }

  if (ctx === "euerNet") {
    if (!billContributesInputVat(doc)) return null
    return persistedBillVatEur(doc)
  }

  return null
}

/** Gross EUR for a cost doc in the given report context. */
export function costGrossEurForContext(
  doc: Record<string, unknown>,
  ctx: CostReportContext,
): number | null {
  if (!costIncludedInContext(doc, ctx)) return null

  const type = costType(doc)
  if (type === "cost_pauschale") return pauschaleAmountEur(doc)

  return persistedBillGrossEur(doc)
}

export function sumCostsNetEur(
  docs: Record<string, unknown>[],
  ctx: CostReportContext,
): number {
  let s = 0
  for (const doc of docs) {
    const v = costNetEurForContext(doc, ctx)
    if (v != null) s += v
  }
  return s
}

export function sumCostsVatEur(
  docs: Record<string, unknown>[],
  ctx: CostReportContext,
): number {
  let s = 0
  for (const doc of docs) {
    const v = costVatEurForContext(doc, ctx)
    if (v != null) s += v
  }
  return s
}

export function sumCostsGrossEur(
  docs: Record<string, unknown>[],
  ctx: CostReportContext,
): number {
  let s = 0
  for (const doc of docs) {
    const v = costGrossEurForContext(doc, ctx)
    if (v != null) s += v
  }
  return s
}

/** Merge cost doc arrays, de-duplicating by Firestore document id. */
export function mergeCostDocsById(
  ...groups: Record<string, unknown>[][]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>()
  for (const group of groups) {
    for (const doc of group) {
      const id = typeof doc.id === "string" ? doc.id : undefined
      if (id) byId.set(id, doc)
    }
  }
  return [...byId.values()]
}
