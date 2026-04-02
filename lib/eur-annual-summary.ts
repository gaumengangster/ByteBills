/**
 * EÜR-oriented annual totals (German income/expense statement hints).
 * Uses persisted EUR fields only: invoices (`subtotalEur`, `taxEur`), bills (`subtotalEur` / `netEur`, `vatAmountEur`),
 * plus optional Pauschal assets / AfA lines from `aggregateEuerYearlyExtra`.
 *
 * When `options.calendarYear` is set, **invoice** income/VAT lines count only if `taxDate` falls in that calendar year.
 */

import { aggregateEuerYearlyExtra, type EuerYearlyExtra } from "@/lib/eur-euer-yearly"
import { revenueInvoiceMatchesCalendarYear } from "@/lib/reporting-flags"
import { sumBillsVatAmountEur } from "@/lib/report-eur-rates"
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

function billSubtotalEur(bill: Record<string, unknown>): number {
  // Prefer pre-normalised subtotalEur (set by report-fetch-bills normalization).
  const sub = bill.subtotalEur
  if (typeof sub === "number" && Number.isFinite(sub)) return sub

  // Fallback for un-normalized bills: prefer EUR field, then raw (raw is EUR when currency == EUR).
  const v =
    bill.type === "cost_partial_business_use"
      ? (bill.deductibleNetAmountEur ?? bill.deductibleNetAmount)
      : (bill.amountNetEur ?? bill.amountNet)
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

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
    expenseNetEur += billSubtotalEur(bill)
  }

  const inputVatEur = sumBillsVatAmountEur(options?.vatBills ?? billsForEuer)

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
