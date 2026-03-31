type TranslationKeys = {
  invoice: string
  receipt: string
  deliveryNote: string
  invoiceNumber: string
  receiptNumber: string
  deliveryNoteNumber: string
  date: string
  dueDate: string
  invoiceReference: string
  orderReference: string
  paymentMethod: string
  billTo: string
  receivedFrom: string
  deliverTo: string
  deliveryAddress: string
  description: string
  quantity: string
  unitPrice: string
  totalValue: string
  notes: string
  subtotal: string
  tax: string
  total: string
  totalPaid: string
  paymentTerms: string
  bank: string
  iban: string
  bankCode: string
  bankAddress: string
  termsAndConditions: string
  thankYou: string
  deliveryInstructions: string
  deliveredBy: string
  receivedBy: string
  name: string
  signature: string
  street: string
  city: string
  phone: string
  email: string
  reverseCharge: string
  paymentDetails: string
  cash: string
  creditDebitCard: string
  bankTransfer: string
  paypal: string
  other: string
  registrationNumber: string
  vatNumber: string
}

const en: TranslationKeys = {
  invoice: "INVOICE",
  receipt: "RECEIPT",
  deliveryNote: "DELIVERY NOTE",
  invoiceNumber: "Invoice #",
  receiptNumber: "Receipt #",
  deliveryNoteNumber: "Delivery Note #",
  date: "Date",
  dueDate: "Due Date",
  invoiceReference: "Invoice Reference",
  orderReference: "Order Reference",
  paymentMethod: "Payment Method",
  billTo: "Bill To:",
  receivedFrom: "Received From:",
  deliverTo: "Deliver To:",
  deliveryAddress: "Delivery Address:",
  description: "Description",
  quantity: "Quantity",
  unitPrice: "Unit Price",
  totalValue: "Total Value",
  notes: "Notes:",
  subtotal: "Subtotal:",
  tax: "Tax:",
  total: "Total:",
  totalPaid: "Total Paid:",
  paymentTerms: "Payment Terms:",
  bank: "Bank:",
  iban: "IBAN:",
  bankCode: "Bank code (SWIFT/BIC):",
  bankAddress: "Bank Address:",
  termsAndConditions: "Terms & Conditions:",
  thankYou: "Thank you for your business!",
  deliveryInstructions: "Delivery Instructions:",
  deliveredBy: "Delivered By:",
  receivedBy: "Received By:",
  name: "Name",
  signature: "Signature",
  street: "Street",
  city: "City",
  phone: "Phone",
  email: "Email",
  reverseCharge: "Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers)",
  paymentDetails: "Payment Details:",
  cash: "Cash",
  creditDebitCard: "Credit/Debit Card",
  bankTransfer: "Bank Transfer",
  paypal: "PayPal",
  other: "Other",
  registrationNumber: "Registration No.",
  vatNumber: "VAT No.",
}

const de: TranslationKeys = {
  invoice: "RECHNUNG",
  receipt: "QUITTUNG",
  deliveryNote: "LIEFERSCHEIN",
  invoiceNumber: "Rechnungsnr.",
  receiptNumber: "Quittungsnr.",
  deliveryNoteNumber: "Lieferscheinnr.",
  date: "Datum",
  dueDate: "Fälligkeitsdatum",
  invoiceReference: "Rechnungsreferenz",
  orderReference: "Bestellreferenz",
  paymentMethod: "Zahlungsart",
  billTo: "Rechnungsempfänger:",
  receivedFrom: "Erhalten von:",
  deliverTo: "Lieferung an:",
  deliveryAddress: "Lieferadresse:",
  description: "Beschreibung",
  quantity: "Menge",
  unitPrice: "Einzelpreis",
  totalValue: "Gesamtwert",
  notes: "Anmerkungen:",
  subtotal: "Zwischensumme:",
  tax: "Steuer:",
  total: "Gesamt:",
  totalPaid: "Gesamtbetrag:",
  paymentTerms: "Zahlungsbedingungen:",
  bank: "Bank:",
  iban: "IBAN:",
  bankCode: "Bankleitzahl (SWIFT/BIC):",
  bankAddress: "Bankadresse:",
  termsAndConditions: "Allgemeine Geschäftsbedingungen:",
  thankYou: "Vielen Dank für Ihren Auftrag!",
  deliveryInstructions: "Lieferanweisungen:",
  deliveredBy: "Geliefert von:",
  receivedBy: "Empfangen von:",
  name: "Name",
  signature: "Unterschrift",
  street: "Straße",
  city: "Stadt",
  phone: "Telefon",
  email: "E-Mail",
  reverseCharge: "Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers)",
  paymentDetails: "Zahlungsdetails:",
  cash: "Bargeld",
  creditDebitCard: "Kredit-/Debitkarte",
  bankTransfer: "Banküberweisung",
  paypal: "PayPal",
  other: "Sonstige",
  registrationNumber: "Reg.-Nr.",
  vatNumber: "USt-idNr.",
}

const translations: Record<string, TranslationKeys> = { en, de }

export function getTranslations(language: string = "en"): TranslationKeys {
  return translations[language] || translations.en
}

/** UI copy for Reports → ELSTER quarter block (German form references + English explanations). */
export type ElsterReportUiStrings = {
  cardTitle: string
  cardDescription: string
  tableItem: string
  tableElsterLine: string
  tableEur: string
  tableDescription: string
  rowReceivedVatInvoiceLabel: string
  rowReceivedVatInvoiceLineRef: string
  rowReceivedVatInvoiceDescription: string
  rowPaidVatCostsLabel: string
  rowPaidVatCostsLineRef: string
  rowPaidVatCostsDescription: string
  rowTaxFreeLabel: string
  rowTaxFreeLineRef: string
  rowTaxFreeDescription: string
  /** Use "{count}" placeholder for number of cost bills */
  costsInTotalNote: string
  zmSectionTitle: string
  zmColClient: string
  zmColVatId: string
  zmColCountry: string
  zmColNet: string
  zmColVat: string
  zmEmptyQuarter: string
  zmFooterNote: string
}

/** Top stat cards on Reports & Analytics */
export type ReportsDashboardStrings = {
  totalRevenueInvoicesTitle: string
  vatReceivedInvoicesTitle: string
  vatReceivedInvoicesSecondary?: string
  vatPaidCostsTitle: string
  vatPaidCostsSecondary?: string
}

const elsterReportEn: ElsterReportUiStrings = {
  cardTitle: "ELSTER (quarter)",
  cardDescription:
    "Helper totals for German tax reporting, sourced from Firestore (invoices, bills). Not a substitute for professional tax advice.",
  tableItem: "Item",
  tableElsterLine: "ELSTER line",
  tableEur: "EUR",
  tableDescription: "Description",
  rowReceivedVatInvoiceLabel: "Received VAT (invoice)",
  rowReceivedVatInvoiceLineRef: "Z. 46/47 (EU VAT / reverse charge)",
  rowReceivedVatInvoiceDescription:
    "VAT on sales invoices only (Firestore: invoices.tax), converted to EUR using each invoice date. Reverse charge is declared separately in ELSTER.",
  rowPaidVatCostsLabel: "Paid VAT (costs)",
  rowPaidVatCostsLineRef: "Z. 37 Vorsteuer",
  rowPaidVatCostsDescription:
    "VAT on supplier bills (Firestore: bills.vatAmount), converted to EUR using each bill date.",
  rowTaxFreeLabel: "Tax-exempt net",
  rowTaxFreeLineRef: "Z. 22 tax-exempt turnover",
  rowTaxFreeDescription:
    "Net amounts on invoices with zero VAT (tax rate 0 or tax amount ≈ 0).",
  costsInTotalNote:
    "Costs in total: {count} documents (bills). ZM: clients with outgoing invoices in the quarter.",
  zmSectionTitle: "ZM — clients (net & VAT, EUR)",
  zmColClient: "Client",
  zmColVatId: "VAT ID",
  zmColCountry: "Country",
  zmColNet: "Net",
  zmColVat: "VAT",
  zmEmptyQuarter: "No invoices in this quarter.",
  zmFooterNote:
    "Summary declaration (ZM): B2B EU supplies / intra-Community supplies — VAT ID, destination country, net and VAT for the quarter.",
}

const elsterReportDe: ElsterReportUiStrings = {
  cardTitle: "ELSTER (Quartal)",
  cardDescription:
    "Hilfsummen für die deutsche Steuererklärung, aus Firestore (invoices, bills). Kein Ersatz für steuerliche Beratung.",
  tableItem: "Position",
  tableElsterLine: "ELSTER-Zeile",
  tableEur: "EUR",
  tableDescription: "Beschreibung",
  rowReceivedVatInvoiceLabel: "Received VAT (invoice)",
  rowReceivedVatInvoiceLineRef: "Z. 46/47 (EU-USt / Reverse Charge)",
  rowReceivedVatInvoiceDescription:
    "Umsatzsteuer aus Ausgangsrechnungen (Firestore: invoices.tax), in EUR zum Rechnungsdatum.",
  rowPaidVatCostsLabel: "Paid VAT (costs)",
  rowPaidVatCostsLineRef: "Z. 37 Vorsteuer",
  rowPaidVatCostsDescription:
    "Abziehbare Vorsteuer aus Lieferantenrechnungen (Firestore: bills, Feld vatAmount), in EUR zum Belegdatum.",
  rowTaxFreeLabel: "Tax-exempt net",
  rowTaxFreeLineRef: "Z. 22 steuerfreie Umsätze",
  rowTaxFreeDescription: "Nettobeträge bei Rechnungen ohne USt (Satz 0 oder Steuer ≈ 0).",
  costsInTotalNote:
    "Kosten gesamt: {count} Belege (bills). ZM: Kunden mit Ausgangsrechnungen im Quartal.",
  zmSectionTitle: "ZM — Kunden (Netto & USt, EUR)",
  zmColClient: "Kunde",
  zmColVatId: "USt-ID",
  zmColCountry: "Land",
  zmColNet: "Netto",
  zmColVat: "USt",
  zmEmptyQuarter: "Keine Rechnungen in diesem Quartal.",
  zmFooterNote:
    "Zusammenfassende Meldung (ZM): innergemeinschaftliche Lieferungen — USt-ID, Bestimmungsland, Netto und USt im Quartal.",
}

const reportsDashboardEn: ReportsDashboardStrings = {
  totalRevenueInvoicesTitle: "Total Revenue (invoices)",
  vatReceivedInvoicesTitle: "VAT received (invoices)",
  vatReceivedInvoicesSecondary: "EUR on invoice date",
  vatPaidCostsTitle: "VAT paid (costs)",
  vatPaidCostsSecondary: "EUR on bill date",
}

const reportsDashboardDe: ReportsDashboardStrings = {
  totalRevenueInvoicesTitle: "Total Revenue (invoices)",
  vatReceivedInvoicesTitle: "VAT received (invoices)",
  vatReceivedInvoicesSecondary: "EUR zum Rechnungsdatum",
  vatPaidCostsTitle: "VAT paid (costs)",
  vatPaidCostsSecondary: "EUR zum Belegdatum",
}

const elsterReportByLang: Record<string, ElsterReportUiStrings> = {
  en: elsterReportEn,
  de: elsterReportDe,
}

const reportsDashboardByLang: Record<string, ReportsDashboardStrings> = {
  en: reportsDashboardEn,
  de: reportsDashboardDe,
}

/** EÜR helper block when report period is “This year” or “Last year”. */
export type EurReportUiStrings = {
  cardTitle: string
  cardDescription: string
  colNeed: string
  colFirestore: string
  colAnlage: string
  colSum: string
  colNotes: string
  rowIncomeLabel: string
  rowIncomeFirestore: string
  rowIncomeAnlage: string
  rowIncomeDesc: string
  rowExpenseLabel: string
  rowExpenseFirestore: string
  rowExpenseAnlage: string
  rowExpenseDesc: string
  rowVatOutLabel: string
  rowVatOutFirestore: string
  rowVatOutAnlage: string
  rowVatOutDesc: string
  rowVatInLabel: string
  rowVatInFirestore: string
  rowVatInAnlage: string
  rowVatInDesc: string
  /** Placeholders: {calendarYear}, {filingDeadlineYear} (31 July of year after calendar year). */
  footerDeadline: string
}

const eurReportEn: EurReportUiStrings = {
  cardTitle: "EÜR (income/expense statement) — hints",
  cardDescription:
    "Sums for German EÜR (Einnahmen-Überschuss-Rechnung) from ByteBills data. Not a substitute for tax advice.",
  colNeed: "Line item",
  colFirestore: "Firestore",
  colAnlage: "Annex / line",
  colSum: "Sum (EUR)",
  colNotes: "Notes",
  rowIncomeLabel: "Total income (net)",
  rowIncomeFirestore: "invoices · subtotalEur (or totalEur − taxEur if legacy)",
  rowIncomeAnlage: "EÜR Z.9 Gesamteinnahmen",
  rowIncomeDesc:
    "Net turnover before VAT (subtotalEur). Not the same as dashboard Total Revenue, which uses gross totalEur. Issued invoices only; receipts excluded. EUR by invoice date.",
  rowExpenseLabel: "Total expenses (net)",
  rowExpenseFirestore: "bills · subtotal",
  rowExpenseAnlage: "EÜR Z.19 Gesamtausgaben",
  rowExpenseDesc: "Net amounts on supplier cost bills, converted to EUR by bill date.",
  rowVatOutLabel: "Total VAT on income",
  rowVatOutFirestore: "invoices · tax",
  rowVatOutAnlage: "EÜR Z.10 USt (control)",
  rowVatOutDesc:
    "Output VAT on invoices only (receipts excluded). Reverse charge is declared separately in ELSTER.",
  rowVatInLabel: "Total VAT on expenses",
  rowVatInFirestore: "bills · vatAmountEur",
  rowVatInAnlage: "EÜR Z.20 Vorsteuer",
  rowVatInDesc:
    "Input VAT where the bill is marked deductible and included in VAT return (bills.vatDeductible, bills.includedInVatReturn).",
  footerDeadline:
    "EÜR and income tax (Einkommensteuer, Germany): annual filing is generally due by 31.07.{filingDeadlineYear} for calendar year {calendarYear}. Confirm dates and forms with your tax office or advisor.",
}

const eurReportDe: EurReportUiStrings = {
  cardTitle: "EÜR — Hinweise",
  cardDescription:
    "Summen für die EÜR aus ByteBills-Daten. Kein Ersatz für Steuerberatung.",
  colNeed: "Position",
  colFirestore: "Firestore",
  colAnlage: "Anlage / Zeile",
  colSum: "Summe (EUR)",
  colNotes: "Hinweis",
  rowIncomeLabel: "Gesamteinnahmen (netto)",
  rowIncomeFirestore: "invoices · subtotalEur (Legacy: totalEur − taxEur)",
  rowIncomeAnlage: "EÜR Z.9 Gesamteinnahmen",
  rowIncomeDesc:
    "Netto ohne USt (subtotalEur). Entspricht nicht der Dashboard-Summe „Total Revenue“ (brutto, totalEur). Nur Ausgangsrechnungen; Receipts ausgeschlossen. EUR zum Rechnungsdatum.",
  rowExpenseLabel: "Gesamtausgaben (netto)",
  rowExpenseFirestore: "bills · subtotal",
  rowExpenseAnlage: "EÜR Z.19 Gesamtausgaben",
  rowExpenseDesc: "Netto aus Lieferantenbelegen (bills), EUR zum Belegdatum.",
  rowVatOutLabel: "Umsatzsteuer (Einnahmen)",
  rowVatOutFirestore: "invoices · tax",
  rowVatOutAnlage: "EÜR Z.10 USt (Kontrolle)",
  rowVatOutDesc: "Umsatzsteuer nur aus Rechnungen (Receipts ausgeschlossen). Reverse Charge gesondert.",
  rowVatInLabel: "Vorsteuer (Ausgaben)",
  rowVatInFirestore: "bills · vatAmountEur",
  rowVatInAnlage: "EÜR Z.20 Vorsteuer",
  rowVatInDesc:
    "Vorsteuer nur bei abziehbarer USt und in der Umsatzsteuererklärung berücksichtigt (bills.vatDeductible, bills.includedInVatReturn).",
  footerDeadline:
    "EÜR und Einkommensteuer: in der Regel Abgabe bis 31.07.{filingDeadlineYear} für das Kalenderjahr {calendarYear}. Termine beim Finanzamt bzw. Steuerberater prüfen.",
}

const eurReportByLang: Record<string, EurReportUiStrings> = {
  en: eurReportEn,
  de: eurReportDe,
}

export function getEurReportUi(language: string = "en"): EurReportUiStrings {
  return eurReportByLang[language] || eurReportByLang.en
}

export function getElsterReportUi(language: string = "en"): ElsterReportUiStrings {
  return elsterReportByLang[language] || elsterReportByLang.en
}

export function getReportsDashboardUi(language: string = "en"): ReportsDashboardStrings {
  return reportsDashboardByLang[language] || reportsDashboardByLang.en
}

export function getPaymentMethodTranslated(method: string, language: string = "en"): string {
  const t = getTranslations(language)
  switch (method) {
    case "cash": return t.cash
    case "card": return t.creditDebitCard
    case "bank": return t.bankTransfer
    case "paypal": return t.paypal
    case "other": return t.other
    default: return method
  }
}
