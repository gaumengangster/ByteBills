/**
 * EÜR-oriented annual totals (German income/expense statement hints).
 * Uses persisted EUR fields on native cost documents plus optional Pauschal / AfA lines.
 *
 * When `options.calendarYear` is set, **invoice** income/VAT lines count only if `taxDate` falls in that calendar year.
 */

import { costNetEurForContext, sumCostsVatEur } from "@/lib/cost-report-aggregation"
import { aggregateEuerYearlyExtra, type EuerYearlyExtra } from "@/lib/eur-euer-yearly"
import { revenueInvoiceMatchesCalendarYear } from "@/lib/reporting-flags"
import { invoiceNetIncomeEurForReport, invoiceTaxEurForReport } from "@/lib/revenue-document-eur"

export type EurAnnualSummary = {
  /** Z.9 — sum of net sales (invoices subtotal only) in EUR */
  incomeNetEur: number
  /** Z.19 — sum of net expenses (bills subtotal) in EUR */
  expenseNetEur: number
  /** Z.10 — VAT on income (invoices tax only) in EUR */
  outputVatEur: number
  /** Z.20 — input VAT (bills vatAmount) in EUR */
  inputVatEur: number
} & EuerYearlyExtra

export function aggregateEurAnnualSummary(
  allDocuments: Array<Record<string, unknown> & { type?: string }>,
  billsForEuer: Array<Record<string, unknown>>,
  options?: {
    calendarYear: number
    pauschalDocs?: Array<Record<string, unknown>>
    assetDocs?: Array<Record<string, unknown>>
    /** Bills filtered by vatYear — used for inputVatEur. Falls back to billsForEuer when omitted. */
    vatBills?: Array<Record<string, unknown>>
  },
): EurAnnualSummary {
  let incomeNetEur = 0
  let outputVatEur = 0

  const euerInvoiceYear = options?.calendarYear

  for (const doc of allDocuments) {
    if (doc.type === "invoices") {
      const d = doc as Record<string, unknown>
      if (euerInvoiceYear != null && !revenueInvoiceMatchesCalendarYear(d, euerInvoiceYear)) continue
      incomeNetEur += invoiceNetIncomeEurForReport(d)
      outputVatEur += invoiceTaxEurForReport(d)
    }
  }

  let expenseNetEur = 0
  for (const bill of billsForEuer) {
    const net = costNetEurForContext(bill, "euerNet")
    if (net != null) expenseNetEur += net
  }

  const inputVatEur = sumCostsVatEur(options?.vatBills ?? billsForEuer, "vatQuarter")

  const extra =
    options?.calendarYear != null
      ? aggregateEuerYearlyExtra(
          options.calendarYear,
          billsForEuer,
          options.pauschalDocs ?? [],
          options.assetDocs ?? [],
        )
      : {
          z52_homeoffice_mieteEur: 0,
          z53_pauschalenEur: 0,
          z54_fahrtenEur: 0,
          z44_abschreibungenEur: 0,
          z59_sonstigesEur: 0,
        }

  return {
    incomeNetEur,
    expenseNetEur,
    outputVatEur,
    inputVatEur,
    ...extra,
  }
}
