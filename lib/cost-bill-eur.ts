/**
 * ECB conversion for supplier cost bills (`bills`): same date rule as reporting — rate row for `billDate`.
 * Persisted EUR fields stay stable if ECB history is refetched later.
 */

import type { BillLineItem, CostBillEurFields } from "@/lib/bill-types"
import { convertAmountToEur, type EurRatesByDocumentDate } from "@/lib/eur-rates"
import { calendarDateKeyFromCostBill, eurRatesForCostBill } from "@/lib/report-eur-rates"

/**
 * Same calendar key as reporting / `eurRatesForCostBill` — must be used when fetching ECB rows so the
 * requested date matches the rate applied (HTML `YYYY-MM-DD`, ISO strings, Firestore timestamps).
 */
export function calendarDateKeyFromBillDateField(billDate: string | undefined): string | null {
  return calendarDateKeyFromCostBill({ billDate: billDate ?? null })
}

function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

export type CostBillEurBuildResult = CostBillEurFields & {
  lineItems: Record<string, string | number>[]
}

/**
 * Builds Firestore-safe line items (no `undefined`) with `unitPriceEur` / `lineTotalEur` when originals exist,
 * and document-level EUR totals. Pass `null` for amounts that are not set (not `undefined`).
 */
export function buildCostBillEurFields(
  params: {
    billDate: string
    currency: string
    subtotal: number | null
    vatAmount: number | null
    total: number | null
    lineItems: BillLineItem[]
  },
  eurRatesByDocDate: EurRatesByDocumentDate,
): CostBillEurBuildResult {
  const billStub: Record<string, unknown> = { billDate: params.billDate }
  const dateKey = calendarDateKeyFromCostBill(billStub)
  const rates = eurRatesForCostBill(billStub, eurRatesByDocDate)
  const cur = params.currency.trim() || "EUR"

  const toEur = (n: number | null): number | null => {
    if (n === null) return null
    return roundMoneyEur(convertAmountToEur(n, cur, rates))
  }

  const lineItems = params.lineItems
    .filter((l) => l.description.trim().length > 0)
    .map((l) => {
      const row: Record<string, string | number> = { description: l.description.trim() }
      if (l.quantity !== undefined) row.quantity = l.quantity
      if (l.unitPrice !== undefined) {
        row.unitPrice = l.unitPrice
        row.unitPriceEur = roundMoneyEur(convertAmountToEur(l.unitPrice, cur, rates))
      }
      if (l.lineTotal !== undefined) {
        row.lineTotal = l.lineTotal
        row.lineTotalEur = roundMoneyEur(convertAmountToEur(l.lineTotal, cur, rates))
      }
      if (l.vatRate !== undefined) row.vatRate = l.vatRate
      return row
    })

  const subtotalEur = toEur(params.subtotal)
  const vatAmountEur = toEur(params.vatAmount)
  const totalEur = toEur(params.total)
  return {
    subtotalEur,
    vatAmountEur,
    totalEur,
    netEur: subtotalEur,
    grossEur: totalEur,
    lineItems,
    eurRateDate: dateKey,
  }
}
