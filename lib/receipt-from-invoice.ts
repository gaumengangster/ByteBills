/**
 * Receipt number aligned to the linked invoice: same year + sequence as `INV-YYYY-NNNN` → `RCT-YYYY-NNNN`.
 * So PDF `Eingang_NNNN_` matches the invoice counter (not the next global receipt sequence).
 */
export function receiptNumberFromLinkedInvoice(invoiceNumber: unknown): string {
  const n = typeof invoiceNumber === "string" ? invoiceNumber.trim() : ""
  if (!n) return ""
  if (/^INV-/i.test(n)) {
    return `RCT-${n.replace(/^INV-/i, "")}`
  }
  return ""
}

/**
 * Map a Firestore invoice document to receipt form defaults (client, company, line items, etc.).
 */
export function buildReceiptFormDefaultsFromInvoice(inv: Record<string, unknown>): {
  companyId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  clientAddress: string
  clientLanguage: string
  clientRegistrationNumber: string
  clientVatNumber: string
  items: { description: string; quantity: number; unitPrice: number }[]
  notes: string
  invoiceReference: string
} {
  const client = (inv.clientDetails as Record<string, string | undefined> | undefined) || {}
  const itemsRaw = inv.items as { description?: string; quantity?: number; unitPrice?: number }[] | undefined
  const items =
    Array.isArray(itemsRaw) && itemsRaw.length > 0
      ? itemsRaw.map((it) => ({
          description: String(it.description ?? ""),
          quantity: typeof it.quantity === "number" && it.quantity >= 1 ? it.quantity : 1,
          unitPrice: typeof it.unitPrice === "number" && it.unitPrice >= 0 ? it.unitPrice : 0,
        }))
      : [{ description: "", quantity: 1, unitPrice: 0 }]

  return {
    companyId: String(inv.companyId ?? ""),
    clientName: String(client.name ?? ""),
    clientEmail: String(client.email ?? ""),
    clientPhone: String(client.phone ?? ""),
    clientAddress: String(client.address ?? ""),
    clientLanguage: String(inv.language ?? "en"),
    clientRegistrationNumber: String(client.registrationNumber ?? ""),
    clientVatNumber: String(client.vatNumber ?? ""),
    items,
    notes: String(inv.notes ?? ""),
    invoiceReference: String(inv.invoiceNumber ?? ""),
  }
}

export function getCurrencyAndTaxFromInvoice(inv: Record<string, unknown>): {
  currency: string
  taxPercentage: number
} {
  const currency = typeof inv.currency === "string" && inv.currency.trim() !== "" ? inv.currency : "USD"
  const taxRate = inv.taxRate
  const taxPercentage =
    typeof taxRate === "number" && Number.isFinite(taxRate) ? taxRate : 10
  return { currency, taxPercentage }
}
