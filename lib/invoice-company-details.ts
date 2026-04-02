/**
 * Merges snapshot `companyDetails` on an invoice with live company settings
 * so PDFs and previews show the current street address when the invoice was
 * saved before the address was filled in.
 */

export type CompanyDoc = {
  id: string
  name?: string
  logo?: string | null
  businessDetails?: Record<string, string | undefined | null> | null
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export function mergeInvoiceCompanyDetailsFromCompany(
  invoice: { companyId?: string; companyDetails?: Record<string, unknown> | null },
  companies: CompanyDoc[],
): Record<string, unknown> {
  const snap = (invoice.companyDetails ?? {}) as Record<string, unknown>
  const comp = companies.find((c) => c.id === invoice.companyId)
  const bd = (comp?.businessDetails ?? {}) as Record<string, unknown>

  const pick = (key: string) => str(snap[key]) || str(bd[key]) || ""

  return {
    name: str(snap.name) || str(comp?.name) || "",
    address: pick("address"),
    city: pick("city"),
    country: pick("country"),
    email: pick("email"),
    phone: pick("phone"),
    logo: snap.logo ?? comp?.logo ?? null,
    bankName: pick("bankName"),
    iban: pick("iban"),
    swiftBic: pick("swiftBic"),
    bankAddress: pick("bankAddress"),
  }
}
