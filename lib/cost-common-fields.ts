/**
 * Shared cost metadata for Firestore (`bills`, `pauschalCosts`, `assets`) so reporting can treat
 * different cost types uniformly. Legacy documents may omit these fields.
 */

import { fiscalYearAndQuarterFromYmd } from "@/lib/cost-bill-fiscal"
import type { CostExpenseDocumentType, ManualExpenseKind } from "@/lib/bill-types"
import {
  assetPurchaseReportingFlags,
  pauschalReportingFlags,
  supplierBillReportingFlags,
  type EntityReportingFlags,
} from "@/lib/reporting-flags"

export type CostSourceType = "supplier_bill" | "pauschal" | "asset"

/** Primary hint for badges: VAT prepayment vs annual EÜR vs multi-year AfA */
export type CostReportingKind = "vat_quarterly" | "year_end" | "afa_multi_year"

export function yearQuarterFromYmd(ymd: string): { year: number; quarter: 1 | 2 | 3 | 4 } | null {
  const m = fiscalYearAndQuarterFromYmd(ymd.trim().slice(0, 10))
  if (!m) return null
  return { year: m.fiscalYear, quarter: m.fiscalQuarter }
}

export function billReportingKind(
  includedInVatReturn: boolean,
  vatDeductible: boolean,
  vatAmountEur: number | null | undefined,
): CostReportingKind {
  if (includedInVatReturn && vatDeductible && (vatAmountEur ?? 0) > 0) return "vat_quarterly"
  return "year_end"
}

export type SupplierBillCommonFields = {
  sourceType: "supplier_bill"
  costCategory: string
  costSubcategory: string | null
  costDate: string
  costYear: number
  costQuarter: 1 | 2 | 3 | 4
  /** Net expense in EUR (same idea as subtotalEur / netEur) */
  amountEur: number | null
  currency: string
  businessPurpose: string | null
  notes: string | null
  reportingKind: CostReportingKind
} & EntityReportingFlags

export function buildSupplierBillCommonFields(params: {
  billDate: string
  currency: string
  amountEur: number | null
  businessPurpose: string | null
  notes: string | null
  euerExpenseCategory: string | null
  expenseDocumentType: string
  manualExpenseKind: string | null
  homeOfficeCategory: string | null
  drivingCategory: string | null
  includedInVatReturn: boolean
  vatDeductible: boolean
  vatAmountEur: number | null
}): SupplierBillCommonFields {
  const d = params.billDate.slice(0, 10)
  const yq = yearQuarterFromYmd(d)
  const year = yq?.year ?? new Date().getFullYear()
  const quarter = yq?.quarter ?? 1
  const costCategory = params.euerExpenseCategory ?? params.expenseDocumentType
  const costSub =
    params.manualExpenseKind ?? params.homeOfficeCategory ?? params.drivingCategory ?? null
  const flags = supplierBillReportingFlags({
    billDateYmd: d,
    expenseDocumentType: params.expenseDocumentType as CostExpenseDocumentType,
    manualExpenseKind: params.manualExpenseKind as ManualExpenseKind | null,
    includedInVatReturn: params.includedInVatReturn,
    vatDeductible: params.vatDeductible,
    vatAmountEur: params.vatAmountEur,
  })
  return {
    sourceType: "supplier_bill",
    costCategory,
    costSubcategory: costSub,
    costDate: d,
    costYear: year,
    costQuarter: quarter,
    amountEur: params.amountEur,
    currency: params.currency.trim() || "EUR",
    businessPurpose: params.businessPurpose,
    notes: params.notes,
    reportingKind: billReportingKind(params.includedInVatReturn, params.vatDeductible, params.vatAmountEur),
    ...flags,
  }
}

export type PauschalCommonFields = {
  sourceType: "pauschal"
  costCategory: string
  costSubcategory: string | null
  costDate: string
  costYear: number
  costQuarter: 1 | 2 | 3 | 4
  amountEur: number
  currency: "EUR"
  businessPurpose: string | null
  notes: string | null
  reportingKind: "year_end"
} & EntityReportingFlags

export function buildPauschalCommonFields(params: {
  category: string
  fromDate: string
  amountEur: number
  businessPurpose: string | null
  notes: string | null
}): PauschalCommonFields {
  const d = params.fromDate.slice(0, 10)
  const yq = yearQuarterFromYmd(d)
  const year = yq?.year ?? new Date().getFullYear()
  const quarter = yq?.quarter ?? 1
  const flags = pauschalReportingFlags(d)
  return {
    sourceType: "pauschal",
    costCategory: params.category,
    costSubcategory: null,
    costDate: d,
    costYear: year,
    costQuarter: quarter,
    amountEur: params.amountEur,
    currency: "EUR",
    businessPurpose: params.businessPurpose,
    notes: params.notes,
    reportingKind: "year_end",
    ...flags,
  }
}

export type AssetCommonFields = {
  sourceType: "asset"
  costCategory: string
  costSubcategory: string | null
  costDate: string
  costYear: number
  costQuarter: 1 | 2 | 3 | 4
  /** Net AfA basis */
  amountEur: number
  currency: string
  businessPurpose: string | null
  notes: string | null
  reportingKind: "afa_multi_year"
} & EntityReportingFlags

export function buildAssetCommonFields(params: {
  category: string
  purchaseDate: string
  amountEur: number
  /** VAT on acquisition (Vorsteuer); drives `includeInVatQuarter` on the asset row. */
  purchaseVatAmountEur: number | null
  currency: string
  businessPurpose: string | null
  notes: string | null
}): AssetCommonFields {
  const d = params.purchaseDate.slice(0, 10)
  const yq = yearQuarterFromYmd(d)
  const year = yq?.year ?? new Date().getFullYear()
  const quarter = yq?.quarter ?? 1
  const flags = assetPurchaseReportingFlags(d, params.purchaseVatAmountEur)
  return {
    sourceType: "asset",
    costCategory: params.category,
    costSubcategory: "depreciation",
    costDate: d,
    costYear: year,
    costQuarter: quarter,
    amountEur: params.amountEur,
    currency: params.currency.trim() || "EUR",
    businessPurpose: params.businessPurpose,
    notes: params.notes,
    reportingKind: "afa_multi_year",
    ...flags,
  }
}
