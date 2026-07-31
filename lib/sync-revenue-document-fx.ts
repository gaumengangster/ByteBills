/**
 * Recompute persisted EUR fields from BMF Firestore rates (invoices / receipts).
 */

import type { Firestore } from "firebase/firestore"
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore"
import {
  buildRevenueDocumentEurPersist,
  REVENUE_FX_RATE_MISSING,
  type RevenueLineItem,
} from "@/lib/revenue-document-eur"

/** Non-EUR document without a usable stored FX row — sync can fill EUR fields once BMF rates exist. */
export function revenueDocNeedsFxSync(doc: Record<string, unknown>): boolean {
  const c = String(doc.currency ?? "EUR").trim().toUpperCase()
  if (c === "EUR") return false
  const ex = doc.exchangeRateToEur
  if (typeof ex === "number" && Number.isFinite(ex) && ex > 0) return false
  return true
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
}

function requireFiniteNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return v
}

function lineItemsFromDoc(raw: unknown): RevenueLineItem[] | null {
  if (!Array.isArray(raw)) return null
  const out: RevenueLineItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") return null
    const o = row as Record<string, unknown>
    const description = typeof o.description === "string" ? o.description : ""
    const quantity = typeof o.quantity === "number" && Number.isFinite(o.quantity) ? o.quantity : Number.NaN
    const unitPrice = typeof o.unitPrice === "number" && Number.isFinite(o.unitPrice) ? o.unitPrice : Number.NaN
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null
    out.push({ description, quantity, unitPrice })
  }
  return out
}

export type SyncRevenueDocumentFxResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "not_found" | "forbidden" | "missing_fx" | "invalid_doc" }

export async function syncRevenueDocumentFx(params: {
  db: Firestore
  userId: string
  collection: "invoices" | "receipts"
  docId: string
}): Promise<SyncRevenueDocumentFxResult> {
  const ref = doc(params.db, params.collection, params.docId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, reason: "not_found" }

  const data = snap.data() as Record<string, unknown>
  if (data.userId !== params.userId) return { ok: false, reason: "forbidden" }

  if (!revenueDocNeedsFxSync(data)) {
    return { ok: true, skipped: true }
  }

  const currency = String(data.currency ?? "EUR")
  if (currency.trim().toUpperCase() === "EUR") {
    return { ok: true, skipped: true }
  }

  const subtotal = requireFiniteNumber(data.subtotal)
  const tax = requireFiniteNumber(data.tax)
  const total = requireFiniteNumber(data.total)
  const items = lineItemsFromDoc(data.items)
  if (subtotal == null || tax == null || total == null || items == null) {
    return { ok: false, reason: "invalid_doc" }
  }

  try {
    if (params.collection === "invoices") {
      const invoiceDate = isYmd(data.invoiceDate) ? data.invoiceDate.trim() : null
      if (!invoiceDate) return { ok: false, reason: "invalid_doc" }
      const taxDate = isYmd(data.taxDate) ? data.taxDate.trim() : invoiceDate

      const eurPersist = await buildRevenueDocumentEurPersist({
        db: params.db,
        userId: params.userId,
        kind: "invoice",
        invoiceDateIso: invoiceDate,
        invoiceTaxDateIso: taxDate,
        currency,
        subtotal,
        tax,
        total,
        items,
      })

      await updateDoc(ref, {
        subtotalEur: eurPersist.subtotalEur,
        taxEur: eurPersist.taxEur,
        totalEur: eurPersist.totalEur,
        eurRateDate: eurPersist.eurRateDate,
        items: eurPersist.items,
        updatedAt: new Date().toISOString(),
        ...(currency.trim().toUpperCase() !== "EUR" && eurPersist.exchangeRateToEur != null
          ? { exchangeRateToEur: eurPersist.exchangeRateToEur }
          : { exchangeRateToEur: deleteField() }),
      })
      return { ok: true, skipped: false }
    }

    const receiptDate = isYmd(data.receiptDate) ? data.receiptDate.trim() : null
    if (!receiptDate) return { ok: false, reason: "invalid_doc" }

    const eurPersist = await buildRevenueDocumentEurPersist({
      db: params.db,
      userId: params.userId,
      kind: "receipt",
      receiptDateIso: receiptDate,
      currency,
      subtotal,
      tax,
      total,
      items,
    })

    await updateDoc(ref, {
      subtotalEur: eurPersist.subtotalEur,
      taxEur: eurPersist.taxEur,
      totalEur: eurPersist.totalEur,
      eurRateDate: eurPersist.eurRateDate,
      items: eurPersist.items,
      updatedAt: new Date().toISOString(),
      ...(currency.trim().toUpperCase() !== "EUR" && eurPersist.exchangeRateToEur != null
        ? { exchangeRateToEur: eurPersist.exchangeRateToEur }
        : { exchangeRateToEur: deleteField() }),
      eurRateDateVat: deleteField(),
    })
    return { ok: true, skipped: false }
  } catch (e) {
    if (e instanceof Error && e.message === REVENUE_FX_RATE_MISSING) {
      return { ok: false, reason: "missing_fx" }
    }
    console.error("syncRevenueDocumentFx:", e)
    return { ok: false, reason: "invalid_doc" }
  }
}
