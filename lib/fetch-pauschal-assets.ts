import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

const CAP = 500

/**
 * Fetch cost_pauschale records and normalize them to the shape expected by
 * aggregateEuerYearlyExtra (old pauschalCosts schema):
 *   fromDate, toDate, amountEur, category
 */
export async function fetchPauschalCostsForUser(userId: string): Promise<Array<Record<string, unknown>>> {
  const q = query(collection(db, "cost_pauschale"), where("userId", "==", userId), limit(CAP))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    // Map new field names → old reporting shape
    return {
      id: d.id,
      ...data,
      // Pauschal category mapping: new pauschaleType → old category values
      category: pauschaleTypeToReportCategory(data.pauschaleType as string | undefined),
      fromDate: data.periodFrom ?? data.fromDate,
      toDate: data.periodTo ?? data.toDate,
      amountEur: typeof data.calculatedAmount === "number" ? data.calculatedAmount : (data.amountEur ?? 0),
    }
  })
}

function pauschaleTypeToReportCategory(t: string | undefined): string {
  switch (t) {
    case "home_office":    return "homeoffice"
    case "mileage":        return "pendler"
    case "telephone_flat": return "internet_pauschale"
    // "other" pauschale type has no VAT so it goes into Z.53 (sonstige Pauschalen)
    case "other":          return "verpflegung"
    default:               return "verpflegung"
  }
}

/**
 * Fetch cost_afa records and normalize them to the shape expected by
 * assetDepreciationForCalendarYearEur (old assets schema):
 *   purchasePriceEur, usefulLifeYears, purchaseDate, businessUsePercent,
 *   depreciationSchedule, depreciationStartYmd
 *
 * Assets with hasMultiyearSlices = true are excluded here because their AfA
 * is already pre-computed in cost_afa_multiyear_slice documents.
 */
export async function fetchAssetsForUser(userId: string): Promise<Array<Record<string, unknown>>> {
  const q = query(collection(db, "cost_afa"), where("userId", "==", userId), limit(CAP))
  const snap = await getDocs(q)

  const assets: Array<Record<string, unknown>> = []

  for (const d of snap.docs) {
    const data = d.data()
    // Skip assets whose per-year AfA is handled by multiyear slices (avoid double-count)
    if (data.hasMultiyearSlices === true) continue

    assets.push({
      id: d.id,
      ...data,
      // Map new field names → old reporting shape.
      // Prefer amountNetEur (pre-converted) so foreign-currency assets depreciate in EUR.
      purchasePriceEur:
        typeof data.amountNetEur === "number" ? data.amountNetEur :
        typeof data.amountNet    === "number" ? data.amountNet    :
        (data.purchasePriceEur ?? 0),
      depreciationStartYmd: data.depreciationStartDate ?? data.depreciationStartYmd ?? data.purchaseDate,
      depreciationSchedule: "monthly", // new entities always use monthly linear
    })
  }

  // Also sum up pre-computed yearly AfA slices — add them as synthetic "assets"
  // with immediateExpenseEligible = true so the calling code just takes amountNet as-is.
  const sliceQ = query(collection(db, "cost_afa_multiyear_slice"), where("userId", "==", userId), limit(CAP))
  const sliceSnap = await getDocs(sliceQ)
  for (const d of sliceSnap.docs) {
    const data = d.data()
    // Each slice is already the deductible amount for its calendar year.
    // We represent it as an "immediate expense" so the reporter uses amountNet directly.
    assets.push({
      id: d.id,
      ...data,
      purchasePriceEur: typeof data.amountNet === "number" ? data.amountNet : 0,
      usefulLifeYears: 1,
      purchaseDate: data.expenseDate ?? `${data.calendarYear}-01-01`,
      depreciationStartYmd: data.expenseDate ?? `${data.calendarYear}-01-01`,
      depreciationSchedule: "monthly",
      businessUsePercent: 100, // already scaled
      // tag so callers can identify it
      _isAfaSlice: true,
      _sliceYear: data.calendarYear,
    })
  }

  return assets
}
