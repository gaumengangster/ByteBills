/** Firestore `assets` — depreciable business assets (AfA). */

export type AssetCategory = "hardware" | "software" | "furniture"

export type DepreciationMethod = "linear" | "degressiv"

export type AssetEurZeile = "Z.44" | "Z.45"

export type AssetDepreciationSchedule = "legacy" | "monthly"

export type AssetDoc = {
  userId: string
  category: AssetCategory
  name: string
  /** yyyy-MM-dd */
  purchaseDate: string
  /** Net purchase price (EUR, accounting basis for AfA) */
  purchasePriceEur: number
  vatAmountEur: number
  grossPriceEur: number
  /** Display / invoice currency (amounts stored in EUR) */
  currency: string
  vendor: string
  /** Useful life in full years */
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  /** "monthly" = pro-rata months from depreciation start; "legacy" = older year-based AfA */
  depreciationSchedule: AssetDepreciationSchedule
  /** First day of the month AfA begins (yyyy-MM-dd), usually purchase month */
  depreciationStartYmd: string
  /** 0–100, share of business use (reduces deductible AfA) */
  businessUsePercent: number
  /** purchasePriceEur / usefulLifeYears (linear, before private-use adjustment) */
  annualDepreciationEur: number
  /** Book value after purchase (typically = purchasePriceEur net) */
  bookValueEur: number
  eurZeile: AssetEurZeile
  receiptUrl: string
  /** Google Drive file id for uploaded purchase document */
  driveDocumentFileId?: string
  driveDocumentName?: string | null
  notes: string
  /** Optional; shared reporting fields (`cost-common-fields`) are set on new saves. */
  businessPurpose?: string
  createdAt: string
}

export const DEFAULT_USEFUL_LIFE: Record<AssetCategory, number> = {
  hardware: 3,
  software: 3,
  furniture: 5,
}

export const DEFAULT_EUR_ZEILE: Record<AssetCategory, AssetEurZeile> = {
  hardware: "Z.44",
  software: "Z.45",
  furniture: "Z.44",
}
