/**
 * Calendar quarter + EÜR year + optional VAT quarter assignment for cost documents.
 */

import { fiscalYearAndQuarterFromYmd } from "@/lib/cost-bill-fiscal"
import type { CostItemType, VatQuarter } from "@/lib/cost-item-types"
import { quartalAndYearFromYmd, type ReportingQuartal } from "@/lib/reporting-flags"

export const COST_VAT_EPS = 0.005

export type CostReportingPeriodFields = {
  euerYear: number
  costYear: number
  costQuarter: 1 | 2 | 3 | 4
  quartal: ReportingQuartal
  includeInVatQuarter: boolean
  includeInAnnualEuer: boolean
  isPaymentProofOnly: boolean
  /** Always set; equals calendar year of expense date. */
  vatYear: number
  /** Only when `includeInVatQuarter` (|VAT| &gt; 0 and deductible). */
  vatQuarter?: VatQuarter
}

function toVatQuarter(q: 1 | 2 | 3 | 4): VatQuarter {
  return `Q${q}` as VatQuarter
}

function quartalToNum(q: ReportingQuartal): 1 | 2 | 3 | 4 {
  return (q === "q1" ? 1 : q === "q2" ? 2 : q === "q3" ? 3 : 4) as 1 | 2 | 3 | 4
}

function finiteNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

function expenseDateFromDoc(doc: Record<string, unknown>): string {
  const raw =
    (typeof doc.expenseDate === "string" && doc.expenseDate.trim()) ||
    (typeof doc.purchaseDate === "string" && doc.purchaseDate.trim()) ||
    (typeof doc.periodFrom === "string" && doc.periodFrom.trim()) ||
    ""
  return raw.slice(0, 10)
}

function vatAmountForReporting(doc: Record<string, unknown>, type: CostItemType | string): number {
  if (type === "cost_partial_business_use") {
    return finiteNum(doc.deductibleVatAmount)
  }
  if (type === "cost_pauschale") return 0
  return finiteNum(doc.amountVat)
}

function vatDeductibleFromDoc(doc: Record<string, unknown>, type: CostItemType | string): boolean {
  if (type === "cost_pauschale") return false
  if (type === "cost_afa" || type === "cost_afa_multiyear_slice") return true
  return doc.vatDeductible !== false
}

export function assignCostReportingPeriods(params: {
  expenseDateYmd: string
  amountVatForReporting: number
  vatDeductible?: boolean
  includeInAnnualEuer?: boolean
  isPaymentProofOnly?: boolean
}): CostReportingPeriodFields {
  const ymd = params.expenseDateYmd.trim().slice(0, 10)
  const qy = quartalAndYearFromYmd(ymd)
  const fallback = fiscalYearAndQuarterFromYmd(ymd)
  const year = qy?.year ?? fallback?.fiscalYear ?? new Date().getFullYear()
  const quartal: ReportingQuartal =
    qy?.quartal ??
    (fallback ? (`q${fallback.fiscalQuarter}` as ReportingQuartal) : "q1")
  const fq = quartalToNum(quartal)

  const hasVat = Math.abs(params.amountVatForReporting) > COST_VAT_EPS
  const vatDeductible = params.vatDeductible !== false
  const includeInVatQuarter = Boolean(hasVat && vatDeductible && params.isPaymentProofOnly !== true)

  return {
    euerYear: year,
    costYear: year,
    costQuarter: fq,
    quartal,
    includeInVatQuarter,
    includeInAnnualEuer: params.includeInAnnualEuer !== false,
    isPaymentProofOnly: params.isPaymentProofOnly === true,
    vatYear: year,
    vatQuarter: includeInVatQuarter ? toVatQuarter(fq) : undefined,
  }
}

/** Derive period fields from an existing Firestore cost document (e.g. upload save). */
export function assignCostReportingPeriodsFromDoc(
  doc: Record<string, unknown>,
): CostReportingPeriodFields | null {
  const type = String(doc.type ?? "") as CostItemType
  const ymd = expenseDateFromDoc(doc)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null

  return assignCostReportingPeriods({
    expenseDateYmd: ymd,
    amountVatForReporting: vatAmountForReporting(doc, type),
    vatDeductible: vatDeductibleFromDoc(doc, type),
    includeInAnnualEuer: doc.includeInAnnualEuer !== false,
    isPaymentProofOnly: type === "cost_pauschale" ? false : doc.isPaymentProofOnly === true,
  })
}

export function costQuarterMatchesFilter(
  data: Record<string, unknown>,
  year: number,
  quarter?: VatQuarter,
): boolean {
  const costYear = typeof data.costYear === "number" ? data.costYear : undefined
  const y = costYear ?? (typeof data.euerYear === "number" ? data.euerYear : undefined)
  if (y !== year) return false
  if (!quarter) return true

  const cq = data.costQuarter
  if (typeof cq === "number" && cq >= 1 && cq <= 4) {
    return toVatQuarter(cq as 1 | 2 | 3 | 4) === quarter
  }

  const q = data.quartal
  if (q === "q1" || q === "q2" || q === "q3" || q === "q4") {
    return toVatQuarter(quartalToNum(q)) === quarter
  }

  const ymd = expenseDateFromDoc(data)
  const qy = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? quartalAndYearFromYmd(ymd) : null
  if (qy && qy.year === year) {
    return toVatQuarter(quartalToNum(qy.quartal)) === quarter
  }

  return false
}

export function reportingPeriodPatchFromDoc(
  doc: Record<string, unknown>,
): Record<string, unknown> | null {
  const periods = assignCostReportingPeriodsFromDoc(doc)
  if (!periods) return null
  return {
    euerYear: periods.euerYear,
    costYear: periods.costYear,
    costQuarter: periods.costQuarter,
    quartal: periods.quartal,
    includeInVatQuarter: periods.includeInVatQuarter,
    includeInAnnualEuer: periods.includeInAnnualEuer,
    isPaymentProofOnly: periods.isPaymentProofOnly,
    vatYear: periods.vatYear,
    ...(periods.vatQuarter ? { vatQuarter: periods.vatQuarter } : {}),
  }
}
