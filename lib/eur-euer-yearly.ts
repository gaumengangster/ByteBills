/**
 * Extended EÜR line hints: Pauschal costs, AfA, tagged regular bills.
 */

import { addMonths } from "date-fns"

import type { AssetDepreciationSchedule } from "@/lib/asset-cost-types"
import type { PauschalCategory } from "@/lib/pauschal-cost-types"
import type { BillEuerExpenseCategory } from "@/lib/euer-expense-category"

function billSubtotalEur(bill: Record<string, unknown>): number {
  const v = bill.subtotalEur
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

function overlapsCalendarYear(fromYmd: string, toYmd: string, year: number): boolean {
  const yStart = `${year}-01-01`
  const yEnd = `${year}-12-31`
  const a = fromYmd.slice(0, 10)
  const b = toYmd.slice(0, 10)
  return a <= yEnd && b >= yStart
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const p = s.slice(0, 10).split("-").map(Number)
  return { y: p[0] ?? 0, m: (p[1] ?? 1) - 1, d: p[2] ?? 1 }
}

function startDateFromYmd(ymd: string): Date {
  const { y, m, d } = parseYmd(ymd)
  return new Date(y, m, d)
}

/** Linear AfA for calendar year (full annual slice, capped by remaining net). Legacy year-based schedule. */
export function linearDepreciationForYearEur(
  purchasePriceEur: number,
  usefulLifeYears: number,
  purchaseYmd: string,
  year: number,
): number {
  if (purchasePriceEur <= 0 || usefulLifeYears <= 0) return 0
  const annual = purchasePriceEur / usefulLifeYears
  const { y: py } = parseYmd(purchaseYmd)
  if (year < py) return 0
  const yearsUsed = year - py
  if (yearsUsed >= usefulLifeYears) return 0
  const remaining = purchasePriceEur - yearsUsed * annual
  return Math.min(annual, Math.max(0, remaining))
}

/**
 * Monthly linear AfA: net ÷ (12 × useful life), summed for calendar months in `calendarYear`
 * that fall inside the depreciation window. Deductible portion scaled by `businessUsePercent`.
 */
export function monthlyLinearDepreciationForCalendarYearEur(
  net: number,
  usefulLifeYears: number,
  depreciationStartYmd: string,
  calendarYear: number,
  businessUsePercent: number,
): number {
  if (net <= 0 || usefulLifeYears <= 0) return 0
  const monthly = net / (usefulLifeYears * 12)
  const totalMonths = usefulLifeYears * 12
  const pct = Math.min(100, Math.max(0, businessUsePercent)) / 100
  const start = startDateFromYmd(depreciationStartYmd.slice(0, 10))
  let count = 0
  for (let i = 0; i < totalMonths; i++) {
    const d = addMonths(start, i)
    if (d.getFullYear() === calendarYear) count++
  }
  return count * monthly * pct
}

/** Full AfA accumulated through end of `calendarYear` (ignores private use — for Restbuchwert). */
export function accumulatedDepreciationThroughEndOfCalendarYearEur(
  net: number,
  usefulLifeYears: number,
  depreciationStartYmd: string,
  calendarYear: number,
): number {
  if (net <= 0 || usefulLifeYears <= 0) return 0
  const monthly = net / (usefulLifeYears * 12)
  const totalMonths = usefulLifeYears * 12
  const start = startDateFromYmd(depreciationStartYmd.slice(0, 10))
  const endOfYear = new Date(calendarYear, 11, 31, 23, 59, 59, 999)
  let sum = 0
  for (let i = 0; i < totalMonths; i++) {
    const d = addMonths(start, i)
    if (d.getTime() > endOfYear.getTime()) break
    sum += monthly
  }
  return sum
}

export function remainingBookValueAfterCalendarYearEur(
  net: number,
  usefulLifeYears: number,
  depreciationStartYmd: string,
  calendarYear: number,
): number {
  const acc = accumulatedDepreciationThroughEndOfCalendarYearEur(net, usefulLifeYears, depreciationStartYmd, calendarYear)
  return Math.max(0, Math.round((net - acc) * 100) / 100)
}

export function assetDepreciationForCalendarYearEur(
  a: Record<string, unknown>,
  calendarYear: number,
): number {
  // Pre-computed AfA slices (_isAfaSlice) already contain the exact deductible
  // amount for their calendar year — just return amountNet if the year matches.
  if (a._isAfaSlice === true) {
    if (a._sliceYear !== calendarYear) return 0
    const n = typeof a.amountNet === "number" ? a.amountNet : 0
    return n
  }

  // New cost_afa uses amountNet; legacy assets use purchasePriceEur
  const net = typeof a.purchasePriceEur === "number" ? a.purchasePriceEur
            : typeof a.amountNet        === "number" ? a.amountNet : 0
  const life = typeof a.usefulLifeYears === "number" ? a.usefulLifeYears : 0
  const pd = typeof a.purchaseDate === "string" ? a.purchaseDate : ""
  const bp = typeof a.businessUsePercent === "number" && Number.isFinite(a.businessUsePercent) ? a.businessUsePercent : 100
  if (net <= 0 || life <= 0 || !pd) return 0

  const schedule = a.depreciationSchedule as AssetDepreciationSchedule | undefined
  // New cost_afa uses depreciationStartDate; legacy uses depreciationStartYmd
  const startRaw = a.depreciationStartDate ?? a.depreciationStartYmd
  const start =
    typeof startRaw === "string" && startRaw.length >= 8
      ? startRaw.slice(0, 10)
      : pd.slice(0, 10)

  if (schedule === "monthly") {
    return monthlyLinearDepreciationForCalendarYearEur(net, life, start, calendarYear, bp)
  }
  return linearDepreciationForYearEur(net, life, pd, calendarYear) * (Math.min(100, Math.max(0, bp)) / 100)
}

export type EuerYearlyExtra = {
  z52_homeoffice_mieteEur: number
  /** Pauschal rows except Pendler (homeoffice, verpflegung, internet_pauschale) */
  z53_pauschalenEur: number
  /** Pendler km Pauschale */
  z54_fahrtenEur: number
  z44_abschreibungenEur: number
  z59_sonstigesEur: number
}

function pauschalAmountInYear(doc: Record<string, unknown>, year: number): number {
  // New cost_pauschale uses periodFrom/periodTo; legacy uses fromDate/toDate
  const from = typeof doc.periodFrom === "string" ? doc.periodFrom
             : typeof doc.fromDate   === "string" ? doc.fromDate : ""
  const to   = typeof doc.periodTo   === "string" ? doc.periodTo
             : typeof doc.toDate     === "string" ? doc.toDate   : ""
  if (!from || !to) return 0
  if (!overlapsCalendarYear(from, to, year)) return 0
  // New cost_pauschale uses calculatedAmount; legacy uses amountEur
  const a = doc.calculatedAmount ?? doc.amountEur
  return typeof a === "number" && Number.isFinite(a) ? a : 0
}

export function aggregateEuerYearlyExtra(
  calendarYear: number,
  billsInYear: Array<Record<string, unknown>>,
  pauschalDocs: Array<Record<string, unknown>>,
  assetDocs: Array<Record<string, unknown> & { id?: string }>,
): EuerYearlyExtra {
  let z52 = 0
  let z59bills = 0
  for (const bill of billsInYear) {
    const cat = bill.euerExpenseCategory as BillEuerExpenseCategory | undefined
    if (cat === "homeoffice_miete") {
      z52 += billSubtotalEur(bill)
    }
    if (
      cat === "software" ||
      cat === "internet" ||
      cat === "bank_fees" ||
      cat === "travel" ||
      cat === "insurance" ||
      cat === "office_supplies" ||
      cat === "education"
    ) {
      z59bills += billSubtotalEur(bill)
    }
  }

  let z53 = 0
  let z54 = 0
  for (const p of pauschalDocs) {
    const cat = p.category as PauschalCategory | undefined
    // Also handle raw new pauschaleType values (in case normalization was skipped)
    const rawType = p.pauschaleType as string | undefined
    const amt = pauschalAmountInYear(p, calendarYear)
    if (amt <= 0) continue
    if (cat === "pendler" || rawType === "mileage") {
      z54 += amt
    } else {
      // All other pauschale types (homeoffice, verpflegung, internet_pauschale, other) → Z.53
      z53 += amt
    }
  }

  let z44 = 0
  for (const a of assetDocs) {
    z44 += assetDepreciationForCalendarYearEur(a, calendarYear)
  }

  return {
    z52_homeoffice_mieteEur: z52,
    z53_pauschalenEur: z53,
    z54_fahrtenEur: z54,
    z44_abschreibungenEur: z44,
    z59_sonstigesEur: z59bills,
  }
}
