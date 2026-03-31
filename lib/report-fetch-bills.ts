import { format } from "date-fns"
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

const PAGE_SIZE = 500

// cost_afa is included here only for its VAT (Vorsteuer).
// The net/depreciation amount is handled separately via fetchAssetsForUser → AssetDepreciation,
// so subtotalEur is set to 0 for cost_afa to avoid double-counting in EÜR.
const VAT_COLLECTIONS = ["cost_invoice", "cost_partial_business_use", "cost_afa"] as const

/**
 * Fetch cost bills for a specific VAT year (and optionally quarter).
 * Uses the persisted `vatYear` / `vatQuarter` fields so the period assignment
 * matches what was saved on the document — not the raw expense date.
 */
export async function fetchBillsForVatPeriod(
  userId: string,
  year: number,
  quarter?: "Q1" | "Q2" | "Q3" | "Q4",
): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>()
  await Promise.all(
    VAT_COLLECTIONS.map(async (col) => {
      const snap = await getDocs(
        query(
          collection(db, col),
          where("userId", "==", userId),
          where("vatYear", "==", year),
          limit(PAGE_SIZE),
        ),
      )
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>
        if (quarter && data.vatQuarter !== quarter) continue
        byId.set(docSnap.id, normalizeBillForReporting(data))
      }
    }),
  )
  return [...byId.values()]
}

/**
 * Fetch cost bills for a specific EÜR (income/expense statement) year.
 * Uses the persisted `euerYear` field so the year assignment matches what
 * was saved on the document.
 */
export async function fetchBillsForEuerYear(
  userId: string,
  year: number,
): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>()
  await Promise.all(
    VAT_COLLECTIONS.map(async (col) => {
      const snap = await getDocs(
        query(
          collection(db, col),
          where("userId", "==", userId),
          where("euerYear", "==", year),
          limit(PAGE_SIZE),
        ),
      )
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>
        byId.set(docSnap.id, normalizeBillForReporting(data))
      }
    }),
  )
  return [...byId.values()]
}

/**
 * Fetch cost_invoice and cost_partial_business_use records in a date range,
 * normalised to the legacy "bill" shape expected by the reporting layer.
 * Used for chart/dashboard views where the expense date is the right axis.
 */
export async function fetchBillsInDateRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Record<string, unknown>[]> {
  const startYmd = format(start, "yyyy-MM-dd")
  const endYmd   = format(end,   "yyyy-MM-dd")

  const inRange = (data: Record<string, unknown>): boolean => {
    const d = (data.expenseDate ?? data.billDate) as string | undefined
    if (!d) return false
    const key = d.slice(0, 10)
    return key >= startYmd && key <= endYmd
  }

  const byId = new Map<string, Record<string, unknown>>()

  await Promise.all(
    VAT_COLLECTIONS.map(async (col) => {
      const snap = await getDocs(
        query(
          collection(db, col),
          where("userId", "==", userId),
          where("expenseDate", ">=", startYmd),
          where("expenseDate", "<=", endYmd),
          limit(PAGE_SIZE),
        ),
      )
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>
        if (!inRange(data)) continue
        byId.set(docSnap.id, normalizeBillForReporting(data))
      }
    }),
  )

  return [...byId.values()]
}

/**
 * Map new cost entity fields to the legacy reporting shape so that
 * sumBillsVatAmountEur, billSubtotalEur, billContributesInputVat etc. work
 * without changes.
 */
function normalizeBillForReporting(data: Record<string, unknown>): Record<string, unknown> {
  const type = data.type as string | undefined

  // Net expense for EÜR:
  //  cost_invoice             → EUR net (amountNetEur if foreign currency, else amountNet)
  //  cost_partial_business_use → only the deductible (business-use) portion
  //  cost_afa                 → 0 here (net is handled by the depreciation path)
  const subtotalEur =
    type === "cost_afa"
      ? 0
      : type === "cost_partial_business_use"
        ? ((data.deductibleNetAmountEur ?? data.deductibleNetAmount) as number | undefined) ?? 0
        : ((data.amountNetEur ?? data.amountNet) as number | undefined) ?? 0

  // Input VAT for Vorsteuer:
  //  cost_invoice             → EUR vat (amountVatEur if foreign currency, else amountVat)
  //  cost_partial_business_use → deductible portion only (EUR if foreign currency)
  //  cost_afa                 → full amountVat (claimed in full in purchase quarter)
  const vatAmountEur =
    type === "cost_partial_business_use"
      ? ((data.deductibleVatAmountEur ?? data.deductibleVatAmount) as number | undefined) ?? 0
      : ((data.amountVatEur ?? data.amountVat) as number | undefined) ?? 0

  return {
    ...data,
    // legacy field aliases
    billDate:            data.expenseDate ?? data.billDate,
    subtotalEur,
    vatAmountEur,
    // euerExpenseCategory maps directly from `category` (same concept)
    euerExpenseCategory: data.category ?? data.euerExpenseCategory,
  }
}
