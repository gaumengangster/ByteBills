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
