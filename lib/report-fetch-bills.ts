import { format } from "date-fns"
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { costQuarterMatchesFilter } from "@/lib/cost-reporting-periods"

const PAGE_SIZE = 500

// cost_afa is included here only for its VAT (Vorsteuer).
// The net/depreciation amount is handled separately via fetchAssetsForUser → AssetDepreciation,
// so purchase net is excluded from EÜR net via cost-report-aggregation (euerNet context).
const CORE_COST_COLLECTIONS = ["cost_invoice", "cost_partial_business_use", "cost_afa"] as const
const PAUSCHALE_COLLECTION = "cost_pauschale"

function docWithId(id: string, data: Record<string, unknown>): Record<string, unknown> {
  return { id, ...data }
}

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
    CORE_COST_COLLECTIONS.map(async (col) => {
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
        if (data.includeInVatQuarter !== true) continue
        if (quarter && data.vatQuarter !== quarter) continue
        byId.set(docSnap.id, docWithId(docSnap.id, data))
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
    CORE_COST_COLLECTIONS.map(async (col) => {
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
        byId.set(docSnap.id, docWithId(docSnap.id, data))
      }
    }),
  )
  return [...byId.values()]
}

/**
 * All supplier costs in a calendar quarter (Option A): uses `costYear` / `costQuarter`
 * so 0-VAT costs are included alongside VAT costs.
 */
export async function fetchBillsForCostQuarter(
  userId: string,
  year: number,
  quarter: "Q1" | "Q2" | "Q3" | "Q4",
): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>()
  await Promise.all(
    CORE_COST_COLLECTIONS.map(async (col) => {
      const snap = await getDocs(
        query(
          collection(db, col),
          where("userId", "==", userId),
          where("costYear", "==", year),
          limit(PAGE_SIZE),
        ),
      )
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>
        if (!costQuarterMatchesFilter(data, year, quarter)) continue
        byId.set(docSnap.id, docWithId(docSnap.id, data))
      }
    }),
  )
  return [...byId.values()]
}

/**
 * All supplier costs in a calendar year (by `costYear`), any VAT amount.
 */
export async function fetchBillsForCostYear(
  userId: string,
  year: number,
): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>()
  await Promise.all(
    CORE_COST_COLLECTIONS.map(async (col) => {
      const snap = await getDocs(
        query(
          collection(db, col),
          where("userId", "==", userId),
          where("costYear", "==", year),
          limit(PAGE_SIZE),
        ),
      )
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>
        byId.set(docSnap.id, docWithId(docSnap.id, data))
      }
    }),
  )
  return [...byId.values()]
}

/** Pauschale costs in a calendar year (dashboard totals). */
export async function fetchPauschalForCostYear(
  userId: string,
  year: number,
): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(
    query(
      collection(db, PAUSCHALE_COLLECTION),
      where("userId", "==", userId),
      where("costYear", "==", year),
      limit(PAGE_SIZE),
    ),
  )
  return snap.docs.map((d) => docWithId(d.id, d.data() as Record<string, unknown>))
}

/** Pauschale costs in a calendar quarter (dashboard totals). */
export async function fetchPauschalForCostQuarter(
  userId: string,
  year: number,
  quarter: "Q1" | "Q2" | "Q3" | "Q4",
): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(
    query(
      collection(db, PAUSCHALE_COLLECTION),
      where("userId", "==", userId),
      where("costYear", "==", year),
      limit(PAGE_SIZE),
    ),
  )
  return snap.docs
    .map((d) => docWithId(d.id, d.data() as Record<string, unknown>))
    .filter((data) => costQuarterMatchesFilter(data, year, quarter))
}

/**
 * Fetch cost_invoice, cost_partial_business_use, and cost_afa in a date range.
 * Used for chart/dashboard views where the expense date is the right axis.
 */
export async function fetchBillsInDateRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Record<string, unknown>[]> {
  const startYmd = format(start, "yyyy-MM-dd")
  const endYmd = format(end, "yyyy-MM-dd")

  const inRange = (data: Record<string, unknown>): boolean => {
    const d = data.expenseDate as string | undefined
    if (!d) return false
    const key = d.slice(0, 10)
    return key >= startYmd && key <= endYmd
  }

  const byId = new Map<string, Record<string, unknown>>()

  await Promise.all(
    CORE_COST_COLLECTIONS.map(async (col) => {
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
        byId.set(docSnap.id, docWithId(docSnap.id, data))
      }
    }),
  )

  return [...byId.values()]
}

/** Pauschale costs in an expense-date range (dashboard totals). */
export async function fetchPauschalInDateRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Record<string, unknown>[]> {
  const startYmd = format(start, "yyyy-MM-dd")
  const endYmd = format(end, "yyyy-MM-dd")

  const snap = await getDocs(
    query(
      collection(db, PAUSCHALE_COLLECTION),
      where("userId", "==", userId),
      where("expenseDate", ">=", startYmd),
      where("expenseDate", "<=", endYmd),
      limit(PAGE_SIZE),
    ),
  )

  return snap.docs.map((d) => docWithId(d.id, d.data() as Record<string, unknown>))
}
