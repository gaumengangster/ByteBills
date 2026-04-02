/**
 * ELSTER-oriented quarter summaries for German tax reporting hints.
 * Uses persisted EUR fields: invoices (`subtotalEur`, `taxEur`), bills (`vatAmountEur` when Vorsteuer applies).
 */

import { invoiceNetIncomeEurForReport, invoiceTaxEurForReport } from "@/lib/revenue-document-eur"
import { resolveClientCountryCode } from "@/lib/client-country"
import { billContributesInputVat } from "@/lib/report-eur-rates"

export type ElsterZmRow = {
  clientName: string
  vatId: string
  countryCode: string
  nettoEur: number
  /** VAT on invoices for this client in the quarter (EUR) */
  vatEur: number
}

export type ElsterQuarterSummary = {
  /** VAT on issued invoices only (invoices.tax → EUR) */
  receivedVatInvoicesEur: number
  /** VAT on supplier bills (bills.vatAmount → EUR) */
  paidVatCostsEur: number
  /** Net turnover on invoices with zero VAT (Z. 22 steuerfreie Umsätze) */
  taxFreeNetInvoicesEur: number
  /** ZM-style: per client (invoices only) */
  zmRows: ElsterZmRow[]
  /** Bills included in paid VAT sum */
  costsBillCount: number
}

function num(v: unknown): number {
  if (v == null || v === "") return 0
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : 0
  }
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".")
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function isTaxFreeInvoice(doc: { tax: unknown; taxRate?: unknown }): boolean {
  const tr = num(doc.taxRate)
  if (tr === 0) return true
  return Math.abs(num(doc.tax)) < 0.005
}

export function aggregateElsterQuarterForDocuments(
  allDocuments: Array<Record<string, unknown> & { type?: string }>,
  billsInRange: Array<Record<string, unknown>>,
): ElsterQuarterSummary {
  let receivedVatInvoicesEur = 0
  let taxFreeNetInvoicesEur = 0

  type zmAgg = { vatId: string; countryCode: string; nettoEur: number; vatEur: number }
  const zmMap = new Map<string, zmAgg>()

  for (const doc of allDocuments) {
    const t = doc.type
    if (t === "invoices") {
      const row = doc as Record<string, unknown>
      const taxEur = invoiceTaxEurForReport(row)
      const net = invoiceNetIncomeEurForReport(row)
      receivedVatInvoicesEur += taxEur
      if (isTaxFreeInvoice(doc as { tax: unknown; taxRate?: unknown })) {
        taxFreeNetInvoicesEur += net
      }

      const name = String(doc.clientDetails && (doc.clientDetails as { name?: string }).name
        ? (doc.clientDetails as { name?: string }).name
        : "Unknown")
      const vat = String(
        (doc.clientDetails as { vatNumber?: string } | undefined)?.vatNumber ?? "",
      ).trim()
      const cc = resolveClientCountryCode(
        doc.clientDetails as { country?: string; address?: string },
      ) ?? ""
      const prev = zmMap.get(name) ?? { vatId: "", countryCode: "", nettoEur: 0, vatEur: 0 }
      zmMap.set(name, {
        vatId: prev.vatId || vat,
        countryCode: prev.countryCode || cc,
        nettoEur: prev.nettoEur + net,
        vatEur: prev.vatEur + taxEur,
      })
    }
  }

  let paidVatCostsEur = 0
  for (const bill of billsInRange) {
    if (!billContributesInputVat(bill)) continue
    const v = bill.vatAmountEur
    if (typeof v === "number" && Number.isFinite(v)) {
      paidVatCostsEur += v
    }
  }

  const zmRows: ElsterZmRow[] = [...zmMap.entries()]
    .map(([clientName, v]) => ({
      clientName,
      vatId: v.vatId || "—",
      countryCode: v.countryCode || "—",
      nettoEur: v.nettoEur,
      vatEur: v.vatEur,
    }))
    .sort((a, b) => b.nettoEur - a.nettoEur)

  return {
    receivedVatInvoicesEur,
    paidVatCostsEur,
    taxFreeNetInvoicesEur,
    zmRows,
    costsBillCount: billsInRange.length,
  }
}
