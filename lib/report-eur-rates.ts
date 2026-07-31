/**
 * Report helpers for cost bills: Vorsteuer flags and persisted EUR readers (no live FX).
 * Foreign-currency costs without saved EUR fields are excluded from totals.
 */

function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

function billCurrencyCode(bill: Record<string, unknown>): string {
  return String(bill.currency ?? "EUR").trim().toUpperCase()
}

function finiteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/**
 * Whether this bill counts toward input VAT / Vorsteuer helpers.
 * Legacy docs without flags default to included and deductible.
 * New fields: `isPaymentProofOnly` / `includeInVatQuarter` (see `lib/reporting-flags.ts`).
 */
export function billContributesInputVat(bill: Record<string, unknown>): boolean {
  if (bill.isPaymentProofOnly === true) return false
  const inQuarter = bill.includeInVatQuarter ?? bill.includedInVatReturn ?? true
  if (inQuarter === false) return false
  if (bill.includedInVatReturn === false) return false
  if (bill.vatDeductible === false) return false
  return true
}

/** Net in EUR from persisted fields only. Foreign currency requires `*Eur` columns. */
export function persistedBillNetEur(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  const cur = billCurrencyCode(bill)

  if (type === "cost_partial_business_use") {
    if (cur === "EUR") return finiteNum(bill.deductibleNetAmount)
    return finiteNum(bill.deductibleNetAmountEur)
  }

  if (cur === "EUR") return finiteNum(bill.amountNet)
  return finiteNum(bill.amountNetEur)
}

/** VAT in EUR from persisted fields only. */
export function persistedBillVatEur(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  const cur = billCurrencyCode(bill)

  if (type === "cost_partial_business_use") {
    if (cur === "EUR") return finiteNum(bill.deductibleVatAmount)
    return finiteNum(bill.deductibleVatAmountEur)
  }

  if (cur === "EUR") return finiteNum(bill.amountVat) ?? 0
  const v = finiteNum(bill.amountVatEur)
  return v
}

/** Gross in EUR from persisted fields only (no FX conversion at report time). */
export function persistedBillGrossEur(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  const cur = billCurrencyCode(bill)

  if (type === "cost_partial_business_use") {
    if (cur === "EUR") {
      const gross = finiteNum(bill.deductibleGrossAmount)
      if (gross != null) return gross
      const net = finiteNum(bill.deductibleNetAmount)
      const vat = finiteNum(bill.deductibleVatAmount)
      if (net != null && vat != null) return roundMoneyEur(net + vat)
      return null
    }
    return finiteNum(bill.deductibleGrossAmountEur)
  }

  if (cur === "EUR") {
    const gross = finiteNum(bill.amountGross)
    if (gross != null) return gross
    const net = finiteNum(bill.amountNet)
    const vat = finiteNum(bill.amountVat)
    if (net != null && vat != null) return roundMoneyEur(net + vat)
    return null
  }

  return finiteNum(bill.amountGrossEur)
}

/** EÜR net expense line (cost_afa purchase net is handled via AfA, not here). */
export function persistedBillSubtotalEurForEuer(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  if (type === "cost_afa") return 0
  return persistedBillNetEur(bill)
}

function dashboardNetEur(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  if (type === "cost_pauschale") {
    return finiteNum(bill.calculatedAmount) ?? finiteNum(bill.amountNet)
  }
  if (type === "cost_afa_multiyear_slice") return null
  return persistedBillNetEur(bill)
}

function dashboardGrossEur(bill: Record<string, unknown>): number | null {
  const type = bill.type as string | undefined
  if (type === "cost_pauschale") {
    return finiteNum(bill.calculatedAmount) ?? finiteNum(bill.amountNet)
  }
  if (type === "cost_afa_multiyear_slice") return null
  return persistedBillGrossEur(bill)
}

/** Sum of persisted VAT EUR on costs where Vorsteuer applies. */
export function sumBillsVatAmountEur(bills: Record<string, unknown>[]): number {
  let s = 0
  for (const bill of bills) {
    if (!billContributesInputVat(bill)) continue
    const v = persistedBillVatEur(bill)
    if (v != null) s += v
  }
  return s
}

/** Net supplier cost in EUR for dashboard totals. */
export function billNetAmountEurForReport(bill: Record<string, unknown>): number | null {
  return dashboardNetEur(bill)
}

/** Gross supplier cost in EUR for dashboard totals. */
export function billGrossAmountEurForReport(bill: Record<string, unknown>): number | null {
  return dashboardGrossEur(bill)
}

export function sumBillsNetAmountEur(bills: Record<string, unknown>[]): number {
  let s = 0
  for (const bill of bills) {
    const v = dashboardNetEur(bill)
    if (v != null) s += v
  }
  return s
}

export function sumBillsGrossAmountEur(bills: Record<string, unknown>[]): number {
  let s = 0
  for (const bill of bills) {
    const v = dashboardGrossEur(bill)
    if (v != null) s += v
  }
  return s
}
