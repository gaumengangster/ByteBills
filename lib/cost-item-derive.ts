import { fiscalYearAndQuarterFromYmd } from "@/lib/cost-bill-fiscal"
import {
  assignCostReportingPeriods,
  COST_VAT_EPS,
  type CostReportingPeriodFields,
} from "@/lib/cost-reporting-periods"
import type {
  CostAfa,
  CostInvoice,
  CostItem,
  CostItemType,
  CostPauschal,
  CostPartialBusinessUse,
  VatCode,
  VendorOrigin,
  VatQuarter,
} from "@/lib/cost-item-types"

const VAT_EPS = COST_VAT_EPS

function withReportingPeriods<T extends Record<string, unknown>>(
  item: T,
  periods: CostReportingPeriodFields,
  overrides?: {
    includeInVatQuarter?: boolean
    includeInAnnualEuer?: boolean
    isPaymentProofOnly?: boolean
  },
): T & CostReportingPeriodFields {
  const includeInVatQuarter = overrides?.includeInVatQuarter ?? periods.includeInVatQuarter
  return {
    ...item,
    euerYear: periods.euerYear,
    costYear: periods.costYear,
    costQuarter: periods.costQuarter,
    quartal: periods.quartal,
    includeInVatQuarter,
    includeInAnnualEuer: overrides?.includeInAnnualEuer ?? periods.includeInAnnualEuer,
    isPaymentProofOnly: overrides?.isPaymentProofOnly ?? periods.isPaymentProofOnly,
    vatYear: periods.vatYear,
    vatQuarter: includeInVatQuarter ? periods.vatQuarter : undefined,
  }
}

export function fiscalQuarterToVatQuarter(q: 1 | 2 | 3 | 4): VatQuarter {
  return `Q${q}` as VatQuarter
}

export function euerYearFromYmd(ymd: string): number {
  const m = fiscalYearAndQuarterFromYmd(ymd.trim().slice(0, 10))
  return m?.fiscalYear ?? new Date().getFullYear()
}

export function vatQuarterMetaFromYmd(ymd: string): { vatQuarter: VatQuarter; vatYear: number } | null {
  const m = fiscalYearAndQuarterFromYmd(ymd.trim().slice(0, 10))
  if (!m) return null
  return { vatQuarter: fiscalQuarterToVatQuarter(m.fiscalQuarter), vatYear: m.fiscalYear }
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function partialBusinessUseDeductible(params: {
  amountNet: number
  amountVat: number
  amountGross: number
  businessUsePercent: number
}): Pick<CostPartialBusinessUse, "deductibleNetAmount" | "deductibleVatAmount" | "deductibleGrossAmount"> {
  const p = Math.min(100, Math.max(0, params.businessUsePercent)) / 100
  return {
    deductibleNetAmount: roundMoney(params.amountNet * p),
    deductibleVatAmount: roundMoney(params.amountVat * p),
    deductibleGrossAmount: roundMoney(params.amountGross * p),
  }
}

/** Keep old name as alias so any other imports still work */
export const internetDeductibleAmounts = partialBusinessUseDeductible

export function linearAnnualDepreciation(params: {
  amountNet: number
  businessUsePercent: number
  usefulLifeYears: number
}): number {
  const p = Math.min(100, Math.max(0, params.businessUsePercent)) / 100
  const basis = params.amountNet * p
  const years = params.usefulLifeYears
  if (!Number.isFinite(basis) || !Number.isFinite(years) || years <= 0) return 0
  return roundMoney(basis / years)
}

function invoiceReporting(vatDeductible: boolean, amountVat: number) {
  const hasVat = Math.abs(amountVat) > VAT_EPS
  return {
    includeInVatQuarter: Boolean(vatDeductible && hasVat),
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
  }
}

function partialReporting(deductibleVatAmount: number) {
  return {
    includeInVatQuarter: Math.abs(deductibleVatAmount) > VAT_EPS,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
  }
}

function afaReporting(amountVat: number) {
  return {
    includeInVatQuarter: Math.abs(amountVat) > VAT_EPS,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
  }
}

// ── legacy re-exports so existing callers compile ──────────────────────────
export function supplierInvoiceReporting(item: Pick<CostInvoice, "vatDeductible" | "amountVat">) {
  return invoiceReporting(item.vatDeductible, item.amountVat)
}
export function pauschaleReporting() {
  return { includeInVatQuarter: false, includeInAnnualEuer: true, isPaymentProofOnly: false }
}
export function internetCostReporting(item: Pick<CostPartialBusinessUse, "deductibleVatAmount">) {
  return partialReporting(item.deductibleVatAmount)
}
export function afaAssetReporting(item: Pick<CostAfa, "amountVat">) {
  return afaReporting(item.amountVat)
}

// ── build payload ───────────────────────────────────────────────────────────

type InvoiceInput = Pick<
  CostInvoice,
  | "vendorName"
  | "invoiceNumber"
  | "expenseDate"
  | "amountNet"
  | "amountVat"
  | "amountGross"
  | "vatDeductible"
  | "businessUsePercent"
  | "paymentStatus"
  | "paymentDate"
> &
  Partial<Pick<CostInvoice, "includeInVatQuarter" | "includeInAnnualEuer" | "isPaymentProofOnly">>

type PartialInput = Pick<
  CostPartialBusinessUse,
  | "vendorName"
  | "invoiceNumber"
  | "contractOrLineName"
  | "expenseDate"
  | "amountNet"
  | "amountVat"
  | "amountGross"
  | "vatDeductible"
  | "businessUsePercent"
  | "deductibleNetAmount"
  | "deductibleVatAmount"
  | "deductibleGrossAmount"
  | "paymentStatus"
  | "paymentDate"
> &
  Partial<Pick<CostPartialBusinessUse, "includeInVatQuarter" | "includeInAnnualEuer" | "isPaymentProofOnly">>

type PauschaleInput = Pick<
  CostPauschal,
  | "pauschaleType"
  | "calculationMethod"
  | "quantity"
  | "rate"
  | "calculatedAmount"
  | "periodFrom"
  | "periodTo"
  | "legalNote"
> &
  Partial<Pick<CostPauschal, "includeInVatQuarter" | "includeInAnnualEuer" | "isPaymentProofOnly">>

type AfaInput = Pick<
  CostAfa,
  | "assetType"
  | "vendorName"
  | "invoiceNumber"
  | "purchaseDate"
  | "amountNet"
  | "amountVat"
  | "amountGross"
  | "businessUsePercent"
  | "immediateExpenseEligible"
> &
  Partial<
    Pick<
      CostAfa,
      | "usefulLifeYears"
      | "depreciationStartDate"
      | "annualDepreciationAmount"
      | "hasMultiyearSlices"
      | "includeInVatQuarter"
      | "includeInAnnualEuer"
      | "isPaymentProofOnly"
    >
  >

export function buildCostItemPayload(params: {
  type: CostItemType
  userId: string
  id: string
  nowIso: string
  expenseDateYmd: string
  purchaseDateYmd?: string
  title: string
  description?: string
  category: string
  subcategory?: string
  notes?: string
  documents: CostItem["documents"]
  documentStatus?: "uploaded" | "pending"
  recurringGroupId?: string | null
  recurringMonthIndex?: number | null
  vatCode?: VatCode
  vendorOrigin?: VendorOrigin
  /** Original invoice currency (omit or "EUR" when amounts are already in EUR) */
  currency?: string
  /** EUR-converted net amount (only set when currency != "EUR") */
  amountNetEur?: number
  amountVatEur?: number
  amountGrossEur?: number
  /** Reference rate: units of original currency per 1 EUR */
  eurRate?: number
  /** yyyy-MM-dd the rate row is keyed to (document date) */
  eurRateDate?: string
  invoice?: InvoiceInput
  partial?: PartialInput
  pauschale?: PauschaleInput
  afa?: AfaInput
}): CostItem {
  const { type, userId, id, nowIso, title, category, notes, documents } = params
  const currency = (params.currency && params.currency.trim().toUpperCase()) || "EUR"
  const isForeign = currency !== "EUR"
  const docStatus = params.documentStatus ?? "uploaded"

  if (type === "cost_invoice" && params.invoice) {
    const s = params.invoice
    const date = s.expenseDate.slice(0, 10)
    const periods = assignCostReportingPeriods({
      expenseDateYmd: date,
      amountVatForReporting: s.amountVat,
      vatDeductible: s.vatDeductible,
      includeInAnnualEuer: s.includeInAnnualEuer ?? true,
      isPaymentProofOnly: s.isPaymentProofOnly ?? false,
    })
    const item: CostInvoice = withReportingPeriods(
      {
      id,
      userId,
      type: "cost_invoice",
      title,
      description: params.description,
      category,
      subcategory: params.subcategory,
      vendorName: s.vendorName,
      currency,
      originalCurrency: isForeign ? currency : undefined,
      amountNet: s.amountNet,
      amountVat: s.amountVat,
      amountGross: s.amountGross,
      amountNetEur: isForeign ? params.amountNetEur : undefined,
      amountVatEur: isForeign ? params.amountVatEur : undefined,
      amountGrossEur: isForeign ? params.amountGrossEur : undefined,
      eurRate: isForeign ? params.eurRate : undefined,
      eurRateDate: isForeign ? params.eurRateDate : undefined,
      expenseDate: date,
      createdAt: nowIso,
      updatedAt: nowIso,
      businessUsePercent: 100,
      status: s.paymentStatus === "paid" ? "paid" : s.paymentStatus === "partially_paid" ? "partially_paid" : "saved",
      notes,
      documents,
      documentStatus: docStatus,
      recurringGroupId: params.recurringGroupId ?? null,
      recurringMonthIndex: params.recurringMonthIndex ?? null,
      vatCode: params.vatCode,
      vendorOrigin: params.vendorOrigin,
      invoiceNumber: s.invoiceNumber,
      vatDeductible: s.vatDeductible,
      paymentStatus: s.paymentStatus,
      paymentDate: s.paymentDate,
      },
      periods,
      {
        includeInVatQuarter: s.includeInVatQuarter,
        includeInAnnualEuer: s.includeInAnnualEuer,
        isPaymentProofOnly: s.isPaymentProofOnly,
      },
    )
    return item
  }

  if (type === "cost_partial_business_use" && params.partial) {
    const n = params.partial
    const date = n.expenseDate.slice(0, 10)
    const ded = partialBusinessUseDeductible({
      amountNet: n.amountNet,
      amountVat: n.amountVat,
      amountGross: n.amountGross,
      businessUsePercent: n.businessUsePercent,
    })
    const deductibleVat = n.deductibleVatAmount ?? ded.deductibleVatAmount
    const periods = assignCostReportingPeriods({
      expenseDateYmd: date,
      amountVatForReporting: deductibleVat,
      vatDeductible: n.vatDeductible,
      includeInAnnualEuer: n.includeInAnnualEuer ?? true,
      isPaymentProofOnly: n.isPaymentProofOnly ?? false,
    })
    const dedNetEur = isForeign && params.amountNetEur != null
      ? roundMoney(params.amountNetEur * (n.businessUsePercent / 100))
      : undefined
    const dedVatEur = isForeign && params.amountVatEur != null
      ? roundMoney(params.amountVatEur * (n.businessUsePercent / 100))
      : undefined
    const item: CostPartialBusinessUse = withReportingPeriods(
      {
      id,
      userId,
      type: "cost_partial_business_use",
      title,
      description: params.description,
      category,
      subcategory: params.subcategory,
      vendorName: n.vendorName,
      currency,
      originalCurrency: isForeign ? currency : undefined,
      expenseDate: date,
      createdAt: nowIso,
      updatedAt: nowIso,
      amountNet: n.amountNet,
      amountVat: n.amountVat,
      amountGross: n.amountGross,
      amountNetEur: isForeign ? params.amountNetEur : undefined,
      amountVatEur: isForeign ? params.amountVatEur : undefined,
      amountGrossEur: isForeign ? params.amountGrossEur : undefined,
      eurRate: isForeign ? params.eurRate : undefined,
      eurRateDate: isForeign ? params.eurRateDate : undefined,
      businessUsePercent: n.businessUsePercent,
      status: "saved",
      notes,
      documents,
      documentStatus: docStatus,
      recurringGroupId: params.recurringGroupId ?? null,
      recurringMonthIndex: params.recurringMonthIndex ?? null,
      vatCode: params.vatCode,
      vendorOrigin: params.vendorOrigin,
      contractOrLineName: n.contractOrLineName,
      invoiceNumber: n.invoiceNumber,
      vatDeductible: n.vatDeductible,
      deductibleNetAmount: n.deductibleNetAmount ?? ded.deductibleNetAmount,
      deductibleVatAmount: deductibleVat,
      deductibleGrossAmount: n.deductibleGrossAmount ?? ded.deductibleGrossAmount,
      deductibleNetAmountEur: dedNetEur,
      deductibleVatAmountEur: dedVatEur,
      paymentStatus: n.paymentStatus,
      paymentDate: n.paymentDate,
      },
      periods,
      {
        includeInVatQuarter: n.includeInVatQuarter,
        includeInAnnualEuer: n.includeInAnnualEuer,
        isPaymentProofOnly: n.isPaymentProofOnly,
      },
    )
    return item
  }

  if (type === "cost_pauschale" && params.pauschale) {
    const p = params.pauschale
    const date = (p.periodFrom ?? p.periodTo ?? `${new Date().getFullYear()}-01-01`).slice(0, 10)
    const periods = assignCostReportingPeriods({
      expenseDateYmd: date,
      amountVatForReporting: 0,
      vatDeductible: false,
      includeInAnnualEuer: p.includeInAnnualEuer ?? true,
      isPaymentProofOnly: false,
    })
    const item: CostPauschal = withReportingPeriods(
      {
      id,
      userId,
      type: "cost_pauschale",
      title,
      description: params.description,
      category,
      subcategory: params.subcategory,
      currency,
      expenseDate: date,
      createdAt: nowIso,
      updatedAt: nowIso,
      amountNet: p.calculatedAmount,
      amountGross: p.calculatedAmount,
      notes,
      documents,
      documentStatus: docStatus,
      vatCode: params.vatCode,
      vendorOrigin: params.vendorOrigin,
      pauschaleType: p.pauschaleType,
      calculationMethod: p.calculationMethod,
      quantity: p.quantity,
      rate: p.rate,
      calculatedAmount: p.calculatedAmount,
      periodFrom: p.periodFrom,
      periodTo: p.periodTo,
      legalNote: p.legalNote,
      },
      periods,
      {
        includeInVatQuarter: p.includeInVatQuarter,
        includeInAnnualEuer: p.includeInAnnualEuer,
        isPaymentProofOnly: p.isPaymentProofOnly,
      },
    )
    return item
  }

  if (type === "cost_afa" && params.afa) {
    const a = params.afa
    const purchaseDate = a.purchaseDate.slice(0, 10)
    const periods = assignCostReportingPeriods({
      expenseDateYmd: purchaseDate,
      amountVatForReporting: a.amountVat,
      vatDeductible: true,
      includeInAnnualEuer: a.includeInAnnualEuer ?? true,
      isPaymentProofOnly: a.isPaymentProofOnly ?? false,
    })
    const annual =
      a.annualDepreciationAmount ??
      (a.usefulLifeYears
        ? linearAnnualDepreciation({
            amountNet: a.amountNet,
            businessUsePercent: a.businessUsePercent,
            usefulLifeYears: a.usefulLifeYears,
          })
        : undefined)
    const item: CostAfa = withReportingPeriods(
      {
      id,
      userId,
      type: "cost_afa",
      title,
      description: params.description,
      category,
      subcategory: params.subcategory,
      vendorName: a.vendorName,
      currency,
      originalCurrency: isForeign ? currency : undefined,
      expenseDate: purchaseDate,
      createdAt: nowIso,
      updatedAt: nowIso,
      amountNet: a.amountNet,
      amountVat: a.amountVat,
      amountGross: a.amountGross,
      amountNetEur: isForeign ? params.amountNetEur : undefined,
      amountVatEur: isForeign ? params.amountVatEur : undefined,
      amountGrossEur: isForeign ? params.amountGrossEur : undefined,
      eurRate: isForeign ? params.eurRate : undefined,
      eurRateDate: isForeign ? params.eurRateDate : undefined,
      businessUsePercent: a.businessUsePercent,
      status: "saved",
      notes,
      documents,
      documentStatus: docStatus,
      vatCode: params.vatCode,
      vendorOrigin: params.vendorOrigin,
      assetType: a.assetType,
      invoiceNumber: a.invoiceNumber,
      purchaseDate,
      usefulLifeYears: a.usefulLifeYears,
      depreciationStartDate: a.depreciationStartDate,
      annualDepreciationAmount: annual,
      immediateExpenseEligible: a.immediateExpenseEligible,
      hasMultiyearSlices: a.hasMultiyearSlices,
      },
      periods,
      {
        includeInVatQuarter: a.includeInVatQuarter,
        includeInAnnualEuer: a.includeInAnnualEuer,
        isPaymentProofOnly: a.isPaymentProofOnly,
      },
    )
    return item
  }

  throw new Error("buildCostItemPayload: missing branch data for type " + type)
}
