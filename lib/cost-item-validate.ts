import { costItemSchema, type CostItem, type CostItemType } from "@/lib/cost-item-types"

const GROSS_EPS = 0.02

export function validateCostItem(item: CostItem): string[] {
  const errs: string[] = []
  const parsed = costItemSchema.safeParse(item)
  if (!parsed.success) {
    parsed.error.issues.forEach((i) => errs.push(i.message))
    return errs
  }

  const t = item.type

  // Gross = net + vat check for all money-based types
  if (
    t === "cost_invoice" ||
    t === "cost_partial_business_use" ||
    t === "cost_afa"
  ) {
    const g = item.amountGross ?? 0
    const n = item.amountNet ?? 0
    const v = item.amountVat ?? 0
    if (Math.abs(g - n - v) > GROSS_EPS) {
      errs.push("Gross amount must equal net plus VAT.")
    }
  }

  if (item.includeInVatQuarter && !item.vatQuarter) {
    errs.push("VAT quarter is required when this cost is included in the VAT quarter.")
  }

  const docs = item.documents ?? []
  // Recurring future months have documentStatus = "pending" — no document required yet
  const isDocPending = item.documentStatus === "pending"

  const requiresDoc =
    !isDocPending &&
    (t === "cost_invoice" || t === "cost_afa")

  const partialNeedsDoc =
    !isDocPending &&
    t === "cost_partial_business_use"

  if (requiresDoc && docs.length < 1) {
    errs.push("Add at least one document for this cost type.")
  }
  if (partialNeedsDoc && docs.length < 1) {
    errs.push("Add at least one document for this cost type.")
  }

  if (t === "cost_pauschale") {
    if (!Number.isFinite(item.calculatedAmount)) {
      errs.push("Calculated amount is required for Pauschale.")
    }
  }

  if (t === "cost_afa") {
    if (!item.immediateExpenseEligible && (!item.usefulLifeYears || item.usefulLifeYears <= 0)) {
      errs.push("Useful life (years) is required unless the asset is immediately expensed.")
    }
  }

  if (t === "cost_afa_multiyear_slice") {
    if (!Number.isFinite(item.amountNet) || item.amountNet <= 0) {
      errs.push("AfA year amount must be a positive number.")
    }
  }

  const bp = item.businessUsePercent
  if (bp !== undefined && (bp < 0 || bp > 100)) {
    errs.push("Business use must be between 0 and 100 %.")
  }

  const primaries = docs.filter((d) => d.isPrimaryTaxDocument)
  if (docs.length > 1 && primaries.length !== 1) {
    errs.push("Mark exactly one document as the primary tax document.")
  }

  return errs
}

export function minDocumentsForType(type: CostItemType): number {
  if (type === "cost_pauschale" || type === "cost_afa_multiyear_slice") return 0
  return 1
}
