/**
 * German reporting hints persisted on every cost/revenue entity:
 * Vorsteuer quarter vs EÜR year-end vs payment-proof-only, plus calendar quarter (`quartal`).
 * Year is taken from document dates / `costYear` elsewhere — not duplicated here.
 *
 * Logic (summary):
 * - Client invoice: VAT quarter + EÜR; not proof-only.
 * - Sales receipt (payment acknowledgment): proof-only; not in VAT quarter; not in annual EÜR from this doc.
 * - Supplier invoice / credit note: Vorsteuer + EÜR when VAT present; never “proof-only” (even at 0% VAT).
 * - Supplier receipt without VAT: EÜR only; “proof/Beleg” for costs, not USt-Voranmeldung.
 * - Bank proof: EÜR + proof-only; no VAT quarter.
 * - Pauschal (home office, Pendler, …): EÜR only; not proof-only; no VAT quarter.
 * - Asset purchase: Vorsteuer in quarter when purchase VAT > 0; EÜR (AfA over years); not proof-only.
 * - Insurance / bank fees: same as other supplier invoices (VAT quarter if |VAT| > 0).
 */

import type { CostExpenseDocumentType, ManualExpenseKind } from "@/lib/bill-types"
import { fiscalYearAndQuarterFromYmd } from "@/lib/cost-bill-fiscal"

const VAT_EPS = 0.005

/** Stored as `q1` … `q4` (calendar quarter of the document date; `costQuarter` on costs stays numeric `1`–`4`). */
export type ReportingQuartal = "q1" | "q2" | "q3" | "q4"

const FISCAL_Q_TO_LABEL: Record<1 | 2 | 3 | 4, ReportingQuartal> = {
  1: "q1",
  2: "q2",
  3: "q3",
  4: "q4",
}

function fiscalQuarterToQuartal(n: 1 | 2 | 3 | 4): ReportingQuartal {
  return FISCAL_Q_TO_LABEL[n]
}

export type EntityReportingFlags = {
  includeInVatQuarter: boolean
  includeInAnnualEuer: boolean
  isPaymentProofOnly: boolean
  quartal: ReportingQuartal
}

/** Document date `yyyy-MM-dd` → calendar quarter label + year (utility; year is not stored on `EntityReportingFlags`). */
export function quartalAndYearFromYmd(ymd: string): { quartal: ReportingQuartal; year: number } | null {
  const m = fiscalYearAndQuarterFromYmd(ymd.trim().slice(0, 10))
  if (!m) return null
  return {
    quartal: fiscalQuarterToQuartal(m.fiscalQuarter),
    year: m.fiscalYear,
  }
}

function quartalFromYmd(billDateYmd: string): ReportingQuartal {
  const q = quartalAndYearFromYmd(billDateYmd)
  return q?.quartal ?? "q1"
}

/** Issued client invoice — Umsatzsteuer + EÜR; ZM-relevant EU supplies use same three flags here. */
export function revenueDocumentReportingFlags(documentDateYmd: string): EntityReportingFlags {
  return {
    includeInVatQuarter: true,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
    quartal: quartalFromYmd(documentDateYmd),
  }
}

/** Sales receipt — payment proof / acknowledgment; income & VAT already on the invoice. */
export function salesReceiptReportingFlags(documentDateYmd: string): EntityReportingFlags {
  return {
    includeInVatQuarter: false,
    includeInAnnualEuer: false,
    isPaymentProofOnly: true,
    quartal: quartalFromYmd(documentDateYmd),
  }
}

/**
 * Supplier cost bill — `expenseDocumentType` + VAT lines:
 * - Formal invoice / credit note: never `isPaymentProofOnly`; VAT quarter only if |VAT| &gt; 0 and toggles.
 * - Receipt without VAT: payment-proof style for EÜR, not Vorsteuer.
 * - Receipt with VAT: like a small supplier Beleg with Vorsteuer.
 * - Bank proof: proof-only, no VAT quarter.
 * - Manual / driving mileage: EÜR only (home office Pauschal uses {@link pauschalReportingFlags}).
 */
export function supplierBillReportingFlags(params: {
  billDateYmd: string
  expenseDocumentType: CostExpenseDocumentType
  manualExpenseKind: ManualExpenseKind | null
  includedInVatReturn: boolean
  vatDeductible: boolean
  vatAmountEur: number | null
}): EntityReportingFlags {
  const quartal = quartalFromYmd(params.billDateYmd)

  const vatEur = params.vatAmountEur
  const hasVat = typeof vatEur === "number" && Number.isFinite(vatEur) && Math.abs(vatEur) > VAT_EPS

  const t = params.expenseDocumentType

  let isPaymentProofOnly = false
  if (t === "bank_proof") {
    isPaymentProofOnly = true
  } else if (t === "manual" || t === "driving") {
    isPaymentProofOnly = false
  } else if (t === "receipt") {
    // Kleiner Beleg / receipt without VAT — cost evidence for EÜR, not USt VA line.
    isPaymentProofOnly = !hasVat
  } else if (t === "invoice" || t === "credit_note") {
    // Supplier invoice / correction — not a bank “proof-only” slip, even at 0% VAT.
    isPaymentProofOnly = false
  }

  let includeInVatQuarter = false
  if (
    !isPaymentProofOnly &&
    hasVat &&
    params.vatDeductible &&
    params.includedInVatReturn &&
    (t === "invoice" || t === "receipt" || t === "credit_note")
  ) {
    includeInVatQuarter = true
  }

  return {
    includeInVatQuarter,
    includeInAnnualEuer: true,
    isPaymentProofOnly,
    quartal,
  }
}

/** Pauschal (home office, Pendler, Verpflegung, …) — annual EÜR; no VAT; not bank proof. */
export function pauschalReportingFlags(fromDateYmd: string): EntityReportingFlags {
  return {
    includeInVatQuarter: false,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
    quartal: quartalFromYmd(fromDateYmd),
  }
}

/**
 * Capital asset **purchase** (Vorsteuer on acquisition in VAT quarter when VAT &gt; 0; AfA in EÜR over years).
 * Not the same as a pure depreciation journal line (those would be EÜR-only, no VAT).
 */
export function assetPurchaseReportingFlags(
  purchaseDateYmd: string,
  purchaseVatAmountEur: number | null,
): EntityReportingFlags {
  const vatEur = purchaseVatAmountEur
  const hasVat = typeof vatEur === "number" && Number.isFinite(vatEur) && Math.abs(vatEur) > VAT_EPS
  return {
    includeInVatQuarter: hasVat,
    includeInAnnualEuer: true,
    isPaymentProofOnly: false,
    quartal: quartalFromYmd(purchaseDateYmd),
  }
}
