import type { CostItemType } from "@/lib/cost-item-types"

export type CostWizardStepKey =
  | "upload"
  | "amounts"
  | "tax-details"
  | "business-share"
  | "review"
  | "type"
  | "calculation"
  | "period"
  | "asset-type"
  | "depreciation"
  | "recurring"

export const costTypeConfig: Record<
  CostItemType,
  {
    label: string
    shortLabel: string
    description: string
    includeInVatQuarter: boolean
    includeInAnnualEuer: boolean
    /** Whether users can set up recurring monthly entries */
    supportsRecurring: boolean
    steps: CostWizardStepKey[]
  }
> = {
  cost_invoice: {
    label: "Supplier invoice",
    shortLabel: "Invoice",
    description: "Business purchase with a proper invoice or receipt (100 % business use, full VAT deduction).",
    includeInVatQuarter: true,
    includeInAnnualEuer: true,
    supportsRecurring: true,
    steps: ["upload", "amounts", "tax-details", "recurring", "review"],
  },
  cost_partial_business_use: {
    label: "Partial business use",
    shortLabel: "Partial",
    description: "Invoice where only a percentage is a business expense (e.g. internet, mobile, home office rent).",
    includeInVatQuarter: true,
    includeInAnnualEuer: true,
    supportsRecurring: true,
    steps: ["upload", "amounts", "business-share", "recurring", "review"],
  },
  cost_pauschale: {
    label: "Pauschale",
    shortLabel: "Pauschale",
    description: "Flat-rate deductions (home office, mileage, phone/internet allowance) — EÜR only, no VAT.",
    includeInVatQuarter: false,
    includeInAnnualEuer: true,
    supportsRecurring: false,
    steps: ["type", "calculation", "period", "review"],
  },
  cost_afa: {
    label: "Asset / AfA",
    shortLabel: "AfA",
    description: "Depreciable equipment or furniture. Can be expensed immediately (GWG) or spread over years.",
    includeInVatQuarter: true,
    includeInAnnualEuer: true,
    supportsRecurring: false,
    steps: ["asset-type", "upload", "depreciation", "review"],
  },
  /** System-generated yearly AfA row — not selectable in wizard */
  cost_afa_multiyear_slice: {
    label: "AfA (yearly slice)",
    shortLabel: "AfA yr",
    description: "Annual AfA amount automatically linked to an asset purchase record.",
    includeInVatQuarter: false,
    includeInAnnualEuer: true,
    supportsRecurring: false,
    steps: ["review"],
  },
}

/** Types that the user can pick when starting "Add cost" */
export const selectableCostTypes: CostItemType[] = [
  "cost_invoice",
  "cost_partial_business_use",
  "cost_pauschale",
  "cost_afa",
]
