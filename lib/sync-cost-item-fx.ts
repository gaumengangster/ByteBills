/**
 * Recompute persisted EUR fields on cost items from BMF reference rates (by expense date).
 */

import type { Firestore } from "firebase/firestore"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { roundMoney } from "@/lib/cost-item-derive"
import {
  resolveReferenceRatesForCostExpenseDate,
  unitsPerEurForCurrencyFromRow,
} from "@/lib/cost-reference-rates"

export const COST_FX_RATE_MISSING = "COST_FX_RATE_MISSING"

const FX_COST_TYPES = new Set(["cost_invoice", "cost_partial_business_use", "cost_afa"])

function requireFiniteNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return v
}

function expenseDateYmd(data: Record<string, unknown>): string | null {
  const raw =
    (typeof data.expenseDate === "string" && data.expenseDate.trim()) ||
    (typeof data.purchaseDate === "string" && data.purchaseDate.trim()) ||
    ""
  const ymd = raw.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

function toEurAmount(amount: number, unitsPerEur: number): number {
  return roundMoney(amount / unitsPerEur)
}

/** Non-EUR supplier cost / AfA that can receive persisted EUR fields. */
export function costItemSupportsFxConversion(item: Record<string, unknown>): boolean {
  const type = String(item.type ?? "")
  if (!FX_COST_TYPES.has(type)) return false
  const c = String(item.currency ?? "EUR").trim().toUpperCase()
  return c !== "EUR"
}

/** Missing or incomplete EUR row — useful for badges; menu still allows manual refresh. */
export function costItemNeedsFxSync(item: Record<string, unknown>): boolean {
  if (!costItemSupportsFxConversion(item)) return false
  const rate = item.eurRate
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return true
  const netEur = item.amountNetEur
  return typeof netEur !== "number" || !Number.isFinite(netEur)
}

export type SyncCostItemFxResult =
  | { ok: true; skipped: boolean; amountNetEur?: number; eurRate?: number }
  | { ok: false; reason: "not_found" | "forbidden" | "missing_fx" | "invalid_doc" | "not_applicable" }

export async function syncCostItemFx(params: {
  db: Firestore
  userId: string
  collectionName: string
  docId: string
  /** Recompute even when EUR fields already exist (refresh rate). */
  force?: boolean
}): Promise<SyncCostItemFxResult> {
  const ref = doc(params.db, params.collectionName, params.docId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, reason: "not_found" }

  const data = snap.data() as Record<string, unknown>
  if (data.userId !== params.userId) return { ok: false, reason: "forbidden" }

  if (!costItemSupportsFxConversion(data)) {
    return { ok: false, reason: "not_applicable" }
  }

  if (!params.force && !costItemNeedsFxSync(data)) {
    return { ok: true, skipped: true }
  }

  const currency = String(data.currency ?? "EUR").trim().toUpperCase()
  const expenseDate = expenseDateYmd(data)
  if (!expenseDate) return { ok: false, reason: "invalid_doc" }

  const net = requireFiniteNumber(data.amountNet)
  const vat = requireFiniteNumber(data.amountVat) ?? 0
  const gross =
    requireFiniteNumber(data.amountGross) ??
    (net != null ? roundMoney(net + vat) : null)
  if (net == null || gross == null) return { ok: false, reason: "invalid_doc" }

  try {
    const { rates } = await resolveReferenceRatesForCostExpenseDate({
      db: params.db,
      userId: params.userId,
      expenseDateYmd: expenseDate,
      currency,
    })
    const unitsPerEur = unitsPerEurForCurrencyFromRow(rates, currency)
    if (unitsPerEur == null) {
      return { ok: false, reason: "missing_fx" }
    }

    const amountNetEur = toEurAmount(net, unitsPerEur)
    const amountVatEur = toEurAmount(vat, unitsPerEur)
    const amountGrossEur = toEurAmount(gross, unitsPerEur)

    const update: Record<string, unknown> = {
      originalCurrency: currency,
      amountNetEur,
      amountVatEur,
      amountGrossEur,
      eurRate: unitsPerEur,
      eurRateDate: expenseDate,
      updatedAt: new Date().toISOString(),
    }

    if (data.type === "cost_partial_business_use") {
      const bizPct =
        typeof data.businessUsePercent === "number" && Number.isFinite(data.businessUsePercent)
          ? data.businessUsePercent
          : 100
      update.deductibleNetAmountEur = roundMoney(amountNetEur * (bizPct / 100))
      update.deductibleVatAmountEur = roundMoney(amountVatEur * (bizPct / 100))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDoc(ref, update as any)

    return { ok: true, skipped: false, amountNetEur, eurRate: unitsPerEur }
  } catch (e) {
    if (e instanceof Error && e.message === COST_FX_RATE_MISSING) {
      return { ok: false, reason: "missing_fx" }
    }
    console.error("syncCostItemFx:", e)
    return { ok: false, reason: "invalid_doc" }
  }
}
