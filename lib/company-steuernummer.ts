/** German Steuernummer shown under VAT No. on issued invoices. */

export const DUKANACIT_STEUERNUMMER = "36/268/02118"

export function isDukanacitServicesCompany(name: string | undefined | null): boolean {
  return /dukanacit/i.test(String(name ?? "").trim())
}

export function companySteuernummer(
  companyName: string | undefined | null,
  stored: unknown,
): string {
  const fromSettings = typeof stored === "string" ? stored.trim() : ""
  if (fromSettings) return fromSettings
  if (isDukanacitServicesCompany(companyName)) return DUKANACIT_STEUERNUMMER
  return ""
}
