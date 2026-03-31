/** Firestore `pauschalCosts` — German flat-rate (Pauschal) expenses without paper receipts. */

export type PauschalCategory = "homeoffice" | "pendler" | "verpflegung" | "internet_pauschale"

export type PauschalUnit = "day" | "km" | "percent" | "month"

export type PauschalPeriod = "month" | "quarter" | "year"

/** Internal documentation only (not an invoice upload). */
export type PauschalProofType = "pauschale"

/** How you document this Pauschale for your files. */
export type PauschalInternalProofType =
  | "none"
  | "route_log"
  | "travel_note"
  | "calendar_note"
  | "distance_log"
  | "home_office_log"

export type PauschalCostDoc = {
  userId: string
  category: PauschalCategory
  /** Optional free-text business context; also see shared `cost-common-fields` metadata on new saves. */
  businessPurpose?: string
  legalBasis: string
  rate: number
  unit: PauschalUnit
  quantity: number
  /** rate × quantity, EUR */
  amountEur: number
  period: PauschalPeriod
  /** yyyy-MM-dd */
  fromDate: string
  /** yyyy-MM-dd */
  toDate: string
  notes: string
  eurZeile: string
  proofType: PauschalProofType
  createdAt: string
  /** Pauschalen have no VAT; stored explicitly for reporting clarity. */
  noVat: true
  /** Count only toward annual EÜR-style helpers, not VAT. */
  yearEndEurOnly: true
  /** Optional route description (mileage). */
  routeDescription: string | null
  /** Optional trip date for meal allowance (yyyy-MM-dd). */
  tripDate: string | null
  tripDurationHours: number | null
  destination: string | null
  /** Optional free-text proof (route log, travel note). */
  routeLogOrTravelNote: string | null
  internalProofType: PauschalInternalProofType
}

export const PAUSCHAL_PRESETS: Record<
  PauschalCategory,
  { rate: number; unit: PauschalUnit; legalBasis: string; eurZeile: string }
> = {
  homeoffice: {
    rate: 6,
    unit: "day",
    legalBasis: "Homeoffice-Pauschale §4 Abs. 5 Nr. 1b EStG (ab 2023: bis 6 €/Tag, i. d. R. max. 100 Tage/Jahr)",
    eurZeile: "Z.53",
  },
  pendler: {
    rate: 0.38,
    unit: "km",
    legalBasis: "Entfernungspauschale §9 Abs. 1 Satz 3 Nr. 4 EStG (0,30–0,38 €/km je nach Jahr)",
    eurZeile: "Z.54",
  },
  verpflegung: {
    rate: 14,
    unit: "day",
    legalBasis: "Verpflegungsmehraufwand §9 Abs. 4 Satz 1 EStG (Pauschbetrag — Stunden/Abwesenheit prüfen)",
    eurZeile: "Z.53",
  },
  internet_pauschale: {
    rate: 0,
    unit: "month",
    legalBasis:
      "Telefon/Internet: pauschal oder tatsächliche Kosten — Betrag und Verteilung mit Steuerberater abstimmen",
    eurZeile: "Z.59",
  },
}

/** Typical annual cap for the €6/day home office rule (100 days × €6). */
export const HOME_OFFICE_MAX_DAYS_ANNUAL = 100
export const HOME_OFFICE_MAX_EUR_ANNUAL = HOME_OFFICE_MAX_DAYS_ANNUAL * PAUSCHAL_PRESETS.homeoffice.rate

export function roundMoneyEur(n: number): number {
  return Math.round(n * 100) / 100
}

export function pauschalPreviewWarnings(
  category: PauschalCategory,
  opts: { quantity: number; rate: number; amountEur: number },
): string[] {
  const w: string[] = []
  const { quantity, rate, amountEur } = opts
  if (category === "homeoffice") {
    if (quantity > HOME_OFFICE_MAX_DAYS_ANNUAL) {
      w.push(
        `You entered ${quantity} days. The usual ceiling for the €6/day Homeoffice-Pauschale is ${HOME_OFFICE_MAX_DAYS_ANNUAL} days per year (€${HOME_OFFICE_MAX_EUR_ANNUAL.toLocaleString()}). Confirm with your advisor.`,
      )
    } else if (rate >= 6 && amountEur > HOME_OFFICE_MAX_EUR_ANNUAL + 0.001) {
      w.push(
        `Computed amount exceeds €${HOME_OFFICE_MAX_EUR_ANNUAL.toLocaleString()} — a common annual cap under the standard €6 rule. Confirm with your advisor.`,
      )
    }
  }
  if (category === "pendler" && quantity > 50000) {
    w.push("Very high distance (km). Check plausibility and tax-year km rate with your advisor.")
  }
  if (category === "verpflegung" && quantity > 120) {
    w.push("Many absence days for Verpflegung in one entry — verify against your actual trips and absences.")
  }
  if (category === "internet_pauschale" && opts.rate <= 0) {
    w.push("Set a positive monthly amount you actually apply (internal rule / advisor agreement).")
  }
  return w
}
