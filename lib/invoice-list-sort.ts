/** Client-side sort for `/invoices` list (Firestore fetch stays un-ordered or by `createdAt`). */

export type InvoiceListSortKey =
  | "vatDate"
  | "invoiceDate"
  | "createdAt"
  | "dueDate"
  | "total"
  | "invoiceNumber"
  | "clientName"

export type InvoiceListSortDir = "asc" | "desc"

export const DEFAULT_INVOICE_LIST_SORT_KEY: InvoiceListSortKey = "vatDate"
export const DEFAULT_INVOICE_LIST_SORT_DIR: InvoiceListSortDir = "desc"

export const INVOICE_LIST_SORT_OPTIONS: { value: InvoiceListSortKey; label: string }[] = [
  { value: "vatDate", label: "VAT date" },
  { value: "invoiceDate", label: "Invoice date" },
  { value: "createdAt", label: "Date created" },
  { value: "dueDate", label: "Due date" },
  { value: "total", label: "Amount" },
  { value: "invoiceNumber", label: "Invoice #" },
  { value: "clientName", label: "Client" },
]

function ymdSlice(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return ""
  return v.slice(0, 10)
}

function vatDateYmd(inv: Record<string, unknown>): string {
  const t = ymdSlice(inv.taxDate)
  if (t) return t
  return ymdSlice(inv.invoiceDate)
}

function createdAtMs(inv: Record<string, unknown>): number {
  const c = inv.createdAt as { toMillis?: () => number } | string | undefined
  if (c && typeof (c as { toMillis?: () => number }).toMillis === "function") {
    return (c as { toMillis: () => number }).toMillis()
  }
  if (typeof c === "string") {
    const ms = Date.parse(c)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function compareInvoices(a: Record<string, unknown>, b: Record<string, unknown>, key: InvoiceListSortKey): number {
  switch (key) {
    case "vatDate":
      return vatDateYmd(a).localeCompare(vatDateYmd(b))
    case "invoiceDate":
      return ymdSlice(a.invoiceDate).localeCompare(ymdSlice(b.invoiceDate))
    case "dueDate":
      return ymdSlice(a.dueDate).localeCompare(ymdSlice(b.dueDate))
    case "createdAt":
      return createdAtMs(a) - createdAtMs(b)
    case "total": {
      const na = typeof a.total === "number" && Number.isFinite(a.total) ? a.total : 0
      const nb = typeof b.total === "number" && Number.isFinite(b.total) ? b.total : 0
      return na - nb
    }
    case "invoiceNumber":
      return String(a.invoiceNumber ?? "").localeCompare(String(b.invoiceNumber ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    case "clientName": {
      const ca = (a.clientDetails as { name?: string } | undefined)?.name ?? ""
      const cb = (b.clientDetails as { name?: string } | undefined)?.name ?? ""
      return String(ca).localeCompare(String(cb), undefined, { sensitivity: "base" })
    }
    default:
      return 0
  }
}

/** Returns a new array sorted by `key` and `dir`. */
export function sortInvoiceList<T extends Record<string, unknown>>(list: T[], key: InvoiceListSortKey, dir: InvoiceListSortDir): T[] {
  const mult = dir === "asc" ? 1 : -1
  return [...list].sort((a, b) => mult * compareInvoices(a, b, key))
}
