import { monthlyLinearDepreciationForCalendarYearEur } from "@/lib/eur-euer-yearly"
import type { CostAfaMultiyearSlice } from "@/lib/cost-item-types"

const EPS = 0.005

/**
 * One entry per calendar year with AfA > 0 (monthly linear schedule).
 */
export function computeAfaDepreciationYearAmounts(params: {
  netPurchaseEur: number
  usefulLifeYears: number
  depreciationStartYmd: string
  businessUsePercent: number
}): Array<{ calendarYear: number; amountNet: number }> {
  const { netPurchaseEur, usefulLifeYears, depreciationStartYmd, businessUsePercent } = params
  if (netPurchaseEur <= 0 || usefulLifeYears <= 0) return []

  const start = new Date(depreciationStartYmd.slice(0, 10))
  const y0 = start.getFullYear()
  const out: Array<{ calendarYear: number; amountNet: number }> = []

  for (let y = y0; y <= y0 + usefulLifeYears + 1; y++) {
    const amt = monthlyLinearDepreciationForCalendarYearEur(
      netPurchaseEur,
      usefulLifeYears,
      depreciationStartYmd,
      y,
      businessUsePercent,
    )
    if (amt > EPS) {
      out.push({ calendarYear: y, amountNet: Math.round(amt * 100) / 100 })
    }
  }

  return out
}

export function buildAfaMultiyearSlice(params: {
  id: string
  userId: string
  parentAssetId: string
  parentTitle: string
  vendorName: string
  category: string
  subcategory?: string
  notes?: string
  calendarYear: number
  amountNet: number
  nowIso: string
}): CostAfaMultiyearSlice {
  const y = params.calendarYear
  const expenseDate = `${y}-12-31`
  return {
    id: params.id,
    userId: params.userId,
    type: "cost_afa_multiyear_slice",
    title: `${params.parentTitle} — AfA ${y}`,
    description: "Annual AfA slice (linear schedule)",
    category: params.category,
    subcategory: params.subcategory,
    vendorName: params.vendorName,
    currency: "EUR",
    expenseDate,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
    amountNet: params.amountNet,
    includeInVatQuarter: false,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
    // vatQuarter intentionally omitted — the parent cost_afa owns the VAT claim
    vatYear: y,
    euerYear: y,
    status: "saved",
    notes: params.notes,
    documents: [],
    documentStatus: "uploaded",
    parentAssetId: params.parentAssetId,
    calendarYear: y,
  }
}

/** @deprecated use buildAfaMultiyearSlice */
export const buildAfaDepreciationYearItem = buildAfaMultiyearSlice
