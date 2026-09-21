import { documentDateKeyBerlin, persistDocumentDateYmd } from "@/lib/document-date-berlin"

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Berlin calendar `yyyy-MM-dd` from a stored payment date, or null. */
export function paymentDateYmd(value: unknown): string | null {
  if (typeof value === "string" && YMD.test(value.trim())) return value.trim().slice(0, 10)
  return documentDateKeyBerlin(value)
}

/** When marking an invoice paid, set paymentDate to today if it is empty. */
export function invoicePaidStatusPatch(
  existingPaymentDate: unknown,
  newStatus: string,
): { paymentDate?: string } {
  if (newStatus !== "paid") return {}
  if (paymentDateYmd(existingPaymentDate)) return {}
  return { paymentDate: persistDocumentDateYmd(new Date()) }
}
