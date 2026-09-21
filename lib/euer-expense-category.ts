/** Optional EÜR / BWA tagging on regular cost documents. */

export type BillEuerExpenseCategory =
  | "homeoffice_miete"
  | "software"
  | "internet"
  | "bank_fees"
  | "travel"
  | "insurance"
  | "office_supplies"
  | "education"
  | "tax_prepayment"
  | "personal_tk_compulsory_health_insurance"
  | "personal_tk_compulsory_care_insurance"

/** Einkommensteuer / Gewerbesteuer / Soli Vorauszahlung — private, not a Betriebsausgabe. */
export const TAX_PREPAYMENT_CATEGORY = "tax_prepayment" as const

/** Pflicht Krankenversicherung (Techniker Krankenkasse), personally paid. */
export const TK_COMPULSORY_KV_CATEGORY = "personal_tk_compulsory_health_insurance" as const

/** Pflicht Pflegeversicherung (Techniker Krankenkasse), personally paid. */
export const TK_COMPULSORY_PV_CATEGORY = "personal_tk_compulsory_care_insurance" as const

export function isPrivateTaxPrepayment(cat: string | undefined | null): boolean {
  return cat === TAX_PREPAYMENT_CATEGORY
}

export function isCompulsoryTkHealthCare(cat: string | undefined | null): boolean {
  return cat === TK_COMPULSORY_KV_CATEGORY || cat === TK_COMPULSORY_PV_CATEGORY
}

/** Tax Vorauszahlung or TK Pflicht KV/PV — not Betriebsausgaben. */
export function isPersonalIncomeDeduction(cat: string | undefined | null): boolean {
  return isPrivateTaxPrepayment(cat) || isCompulsoryTkHealthCare(cat)
}

export function costCategoryOf(doc: Record<string, unknown>): string {
  return String(doc.category ?? doc.euerExpenseCategory ?? "").trim()
}

export const EUER_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "software", label: "Software" },
  { value: "internet", label: "Internet / telecom" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "travel", label: "Travel" },
  { value: "insurance", label: "Insurance" },
  { value: "bank_fees", label: "Bank fees" },
  { value: "education", label: "Education" },
  { value: "homeoffice_miete", label: "Home office / rent share" },
  { value: "hardware", label: "Hardware / equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "subscriptions", label: "Subscriptions / SaaS" },
  { value: "tax_prepayment", label: "Tax prepayment (ESt / GewSt / Soli)" },
  { value: TK_COMPULSORY_KV_CATEGORY, label: "TK compulsory KV (Pflicht)" },
  { value: TK_COMPULSORY_PV_CATEGORY, label: "TK compulsory PV (Pflicht)" },
  { value: "other", label: "Other" },
]

/** Categories that are Betriebsausgaben. Tax prepayments and TK Pflicht KV/PV are private. */
export const OPERATING_EUER_CATEGORY_OPTIONS = EUER_CATEGORY_OPTIONS.filter(
  (o) => !isPersonalIncomeDeduction(o.value),
)
