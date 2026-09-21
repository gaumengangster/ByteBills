import type { EksLeafId } from "@/lib/eks-model"
import { isPersonalIncomeDeduction } from "@/lib/euer-expense-category"

/** Map a ByteBills operating-cost category to an EKS B-line. Personal income deductions are excluded. */
export function eksBLineFromCategory(cat: string | undefined | null): EksLeafId | null {
  const c = String(cat ?? "").trim()
  if (!c || isPersonalIncomeDeduction(c)) return null
  switch (c) {
    case "homeoffice_miete":
    case "homeoffice":
      return "b3"
    case "insurance":
      return "b4"
    case "pendler":
    case "mileage":
      return "b6_5"
    case "travel":
      return "b7_2"
    case "office_supplies":
      return "b10"
    case "internet":
    case "internet_pauschale":
      return "b11"
    case "education":
      return "b13"
    case "bank_fees":
      return "b14_3"
    default:
      return "b14_5"
  }
}

export function eksBLineFromPauschaleType(pauschaleType: string | undefined | null): EksLeafId | null {
  switch (String(pauschaleType ?? "").trim()) {
    case "home_office":
      return "b3"
    case "mileage":
      return "b6_5"
    case "telephone_flat":
      return "b11"
    default:
      return "b14_5"
  }
}
