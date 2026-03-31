/**
 * Unified cost item model.
 *
 * Types:
 *  cost_invoice              — standard supplier invoice (100 % business use)
 *  cost_partial_business_use — invoice where only N% is business (internet, phone, …)
 *  cost_pauschale            — flat-rate deduction (home office, mileage, …)
 *  cost_afa                  — depreciable asset; single immediate expense or multi-year AfA
 *  cost_afa_multiyear_slice  — system-generated yearly AfA row linked to cost_afa parent
 *
 * Recurring monthly:
 *  Any cost_invoice or cost_partial_business_use can carry recurringGroupId + recurringMonthIndex.
 *  Subsequent-month items start with documentStatus = "pending" (invoice to be uploaded later).
 */

import { z } from "zod"

// ── common ─────────────────────────────────────────────────────────────────

export const costItemTypeSchema = z.enum([
  "cost_invoice",
  "cost_partial_business_use",
  "cost_pauschale",
  "cost_afa",
  "cost_afa_multiyear_slice",
])
export type CostItemType = z.infer<typeof costItemTypeSchema>

export const vatQuarterSchema = z.enum(["Q1", "Q2", "Q3", "Q4"])
export type VatQuarter = z.infer<typeof vatQuarterSchema>

export const documentStatusSchema = z.enum(["uploaded", "pending"])
export type DocumentStatus = z.infer<typeof documentStatusSchema>

/**
 * Where the vendor/supplier is located — drives VAT treatment:
 *  domestic → standard German input VAT (Vorsteuer)
 *  eu       → EU cross-border; reverse charge (§13b) may apply
 *  import   → third country; import VAT (Einfuhrumsatzsteuer) applies
 */
export const vendorOriginSchema = z.enum(["domestic", "eu", "import"])
export type VendorOrigin = z.infer<typeof vendorOriginSchema>

export const VENDOR_ORIGIN_OPTIONS: Array<{ value: VendorOrigin; label: string; hint: string }> = [
  { value: "domestic", label: "Domestic (Inland)", hint: "Standard German input VAT" },
  { value: "eu", label: "EU", hint: "EU cross-border; reverse charge (§13b) may apply" },
  { value: "import", label: "Import (Drittland)", hint: "Import VAT (Einfuhrumsatzsteuer)" },
]

/**
 * German UStVA / EÜR VAT key codes:
 *  Z35 → 19 % standard rate
 *  Z36 → 7 % reduced rate
 *  Z14 → 0 % / exempt
 *  Z46 → §13b reverse charge (Steuerschuldnerschaft des Leistungsempfängers)
 */
export const vatCodeSchema = z.enum(["Z35", "Z36", "Z14", "Z46"])
export type VatCode = z.infer<typeof vatCodeSchema>

export const VAT_CODE_OPTIONS: Array<{ value: VatCode; label: string; rate: number }> = [
  { value: "Z35", label: "19 % – Z.35 (Regelsteuersatz)", rate: 0.19 },
  { value: "Z36", label: "7 % – Z.36 (ermäßigt)", rate: 0.07 },
  { value: "Z14", label: "0 % – Z.14 (steuerfrei)", rate: 0 },
  { value: "Z46", label: "§13b – Z.46 (Reverse Charge)", rate: 0 },
]

export const costDocumentTypeSchema = z.enum([
  "invoice",
  "receipt",
  "payment_proof",
  "bank_statement",
  "contract",
  "other",
])
export type CostDocumentType = z.infer<typeof costDocumentTypeSchema>

export const costDocumentSchema = z.object({
  id: z.string(),
  type: costDocumentTypeSchema,
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().optional(),
  documentDate: z.string().optional(),
  createdAt: z.string(),
  amountNet: z.number().optional(),
  amountVat: z.number().optional(),
  amountGross: z.number().optional(),
  vatRelevant: z.boolean(),
  euerRelevant: z.boolean(),
  paymentProofOnly: z.boolean(),
  quarter: vatQuarterSchema.optional(),
  year: z.number().optional(),
  isPrimaryTaxDocument: z.boolean().optional(),
})
export type CostDocument = z.infer<typeof costDocumentSchema>


const baseFields = {
  id: z.string(),
  userId: z.string(),
  type: costItemTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  vendorName: z.string().optional(),
  /** ISO 4217 currency code, e.g. "EUR", "USD", "GBP" */
  currency: z.string(),
  /** Original foreign currency when currency != "EUR" (stored for display; amounts are converted) */
  originalCurrency: z.string().optional(),
  /** Net amount in EUR (= amountNet when currency is already EUR) */
  amountNetEur: z.number().optional(),
  /** VAT amount in EUR */
  amountVatEur: z.number().optional(),
  /** Gross amount in EUR */
  amountGrossEur: z.number().optional(),
  /** ECB rate used for conversion: units of original currency per 1 EUR */
  eurRate: z.number().optional(),
  /** yyyy-MM-dd of the ECB rate used (= document business date) */
  eurRateDate: z.string().optional(),
  expenseDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  amountNet: z.number().optional(),
  amountVat: z.number().optional(),
  amountGross: z.number().optional(),
  businessUsePercent: z.number().optional(),
  includeInVatQuarter: z.boolean(),
  includeInAnnualEuer: z.boolean(),
  isPaymentProofOnly: z.boolean(),
  vatQuarter: vatQuarterSchema.optional(),
  vatYear: z.number().optional(),
  euerYear: z.number(),
  status: z.enum(["draft", "saved", "paid", "partially_paid"]).optional(),
  notes: z.string().optional(),
  documents: z.array(costDocumentSchema).optional(),
  /** "uploaded" = invoice is attached; "pending" = needs document upload */
  documentStatus: documentStatusSchema,
  /** Links all monthly entries of a recurring cost series */
  recurringGroupId: z.string().nullable().optional(),
  /** 0 = first month (primary, has document); 1+ = future months (pending) */
  recurringMonthIndex: z.number().nullable().optional(),
  /** German UStVA VAT code for this expense (Z35=19%, Z36=7%, Z14=0%, Z46=reverse charge) */
  vatCode: vatCodeSchema.optional(),
  /** Where the vendor is located — affects VAT treatment */
  vendorOrigin: vendorOriginSchema.optional(),
}

// ── cost_invoice ────────────────────────────────────────────────────────────

export const costInvoiceSchema = z
  .object({
    ...baseFields,
    type: z.literal("cost_invoice"),
    vendorName: z.string(),
    invoiceNumber: z.string().optional(),
    expenseDate: z.string(),
    amountNet: z.number(),
    amountVat: z.number(),
    amountGross: z.number(),
    vatDeductible: z.boolean(),
    businessUsePercent: z.literal(100),
    paymentStatus: z.enum(["unpaid", "paid", "partially_paid"]).optional(),
    paymentDate: z.string().optional(),
  })
  .strict()
export type CostInvoice = z.infer<typeof costInvoiceSchema>

// ── cost_partial_business_use ───────────────────────────────────────────────

export const costPartialBusinessUseSchema = z
  .object({
    ...baseFields,
    type: z.literal("cost_partial_business_use"),
    vendorName: z.string(),
    contractOrLineName: z.string().optional(),
    invoiceNumber: z.string().optional(),
    expenseDate: z.string(),
    amountNet: z.number(),
    amountVat: z.number(),
    amountGross: z.number(),
    vatDeductible: z.boolean(),
    businessUsePercent: z.number().min(0).max(100),
    deductibleNetAmount: z.number(),
    deductibleVatAmount: z.number(),
    deductibleGrossAmount: z.number().optional(),
    paymentStatus: z.enum(["unpaid", "paid", "partially_paid"]).optional(),
    paymentDate: z.string().optional(),
    /** EUR-equivalent of deductibleNetAmount (only set when currency != "EUR") */
    deductibleNetAmountEur: z.number().optional(),
    /** EUR-equivalent of deductibleVatAmount (only set when currency != "EUR") */
    deductibleVatAmountEur: z.number().optional(),
  })
  .strict()
export type CostPartialBusinessUse = z.infer<typeof costPartialBusinessUseSchema>

// ── cost_pauschale ──────────────────────────────────────────────────────────

export const pauschaleTypeSchema = z.enum(["home_office", "mileage", "telephone_flat", "other"])
export type PauschaleType = z.infer<typeof pauschaleTypeSchema>

export const costPauschalSchema = z
  .object({
    ...baseFields,
    type: z.literal("cost_pauschale"),
    pauschaleType: pauschaleTypeSchema,
    calculationMethod: z.enum(["per_day", "per_km", "fixed_amount"]),
    quantity: z.number(),
    rate: z.number(),
    calculatedAmount: z.number(),
    periodFrom: z.string().optional(),
    periodTo: z.string().optional(),
    legalNote: z.string().optional(),
  })
  .strict()
export type CostPauschal = z.infer<typeof costPauschalSchema>

// ── cost_afa ────────────────────────────────────────────────────────────────

export const afaAssetTypeSchema = z.enum([
  "laptop",
  "monitor",
  "phone",
  "furniture",
  "office_equipment",
  "other",
])
export type AfaAssetType = z.infer<typeof afaAssetTypeSchema>

export const costAfaSchema = z
  .object({
    ...baseFields,
    type: z.literal("cost_afa"),
    assetType: afaAssetTypeSchema,
    vendorName: z.string(),
    invoiceNumber: z.string().optional(),
    purchaseDate: z.string(),
    amountNet: z.number(),
    amountVat: z.number(),
    amountGross: z.number(),
    businessUsePercent: z.number(),
    /** true = full net is expensed in purchase year (GWG-style) */
    immediateExpenseEligible: z.boolean().optional(),
    /** required unless immediateExpenseEligible = true */
    usefulLifeYears: z.number().optional(),
    depreciationStartDate: z.string().optional(),
    annualDepreciationAmount: z.number().optional(),
    /** true if user opted to create per-year AfA rows (cost_afa_multiyear_slice) */
    hasMultiyearSlices: z.boolean().optional(),
  })
  .strict()
export type CostAfa = z.infer<typeof costAfaSchema>

// ── cost_afa_multiyear_slice ────────────────────────────────────────────────

export const costAfaMultiyearSliceSchema = z
  .object({
    ...baseFields,
    type: z.literal("cost_afa_multiyear_slice"),
    parentAssetId: z.string(),
    calendarYear: z.number(),
    amountNet: z.number(),
  })
  .strict()
export type CostAfaMultiyearSlice = z.infer<typeof costAfaMultiyearSliceSchema>

// ── union ───────────────────────────────────────────────────────────────────

/** Maps each CostItemType to its dedicated Firestore collection name. */
export function collectionForType(type: CostItemType): string {
  return type // "cost_invoice" → collection "cost_invoice", etc.
}

export const costItemSchema = z.discriminatedUnion("type", [
  costInvoiceSchema,
  costPartialBusinessUseSchema,
  costPauschalSchema,
  costAfaSchema,
  costAfaMultiyearSliceSchema,
])
export type CostItem = z.infer<typeof costItemSchema>
