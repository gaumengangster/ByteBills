/**
 * Report helpers for cost bills: Vorsteuer flags and summed persisted EUR VAT (no live FX).
 */

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

/** Sum of `vatAmountEur` on cost bills where Vorsteuer applies (saved at upload). */
export function sumBillsVatAmountEur(bills: Record<string, unknown>[]): number {
  let s = 0
  for (const bill of bills) {
    if (!billContributesInputVat(bill)) continue
    const v = bill.vatAmountEur
    if (typeof v === "number" && Number.isFinite(v)) {
      s += v
    }
  }
  return s
}
