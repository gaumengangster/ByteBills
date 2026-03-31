import jsPDF from "jspdf"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import { getTranslations, getPaymentMethodTranslated } from "./translations"
import { registerFonts } from "./pdf-fonts"
import { shouldShowReverseChargeNotice } from "./reverse-charge"

export async function generateReceiptPDF(receipt: any): Promise<Blob> {
  const lang = receipt.language || "en"
  const t = getTranslations(lang)

  const pdf = new jsPDF("p", "mm", "a4")
  await registerFonts(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let y = margin

  const currency = receipt.currency || "EUR"

  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lineHeight * lines.length
  }

  pdf.setFontSize(20)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.receipt, margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(`${t.receiptNumber}: ${receipt.receiptNumber}`, margin, y)
  y += 5
  pdf.text(`${t.date}: ${formatDocumentDateBerlin(receipt.receiptDate, "MMMM d, yyyy")}`, margin, y)
  y += 5

  if (receipt.invoiceReference) {
    pdf.text(`${t.invoiceReference}: ${receipt.invoiceReference}`, margin, y)
    y += 5
  }

  pdf.text(`${t.paymentMethod}: ${getPaymentMethodTranslated(receipt.paymentMethod, lang)}`, margin, y)
  y += 15

  // Company details on the right (same style as invoice)
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")

  const rightMargin = pageWidth - margin
  pdf.text(receipt.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("Roboto", "normal")
  let companyDetailY = companyY + 5

  if (receipt.companyDetails.address) {
    pdf.text(receipt.companyDetails.address, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.city || receipt.companyDetails.country) {
    const location = [receipt.companyDetails.city, receipt.companyDetails.country].filter(Boolean).join(", ")
    pdf.text(location, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.phone) {
    pdf.text(receipt.companyDetails.phone, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.email) {
    pdf.text(receipt.companyDetails.email, rightMargin, companyDetailY, { align: "right" })
  }

  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.receivedFrom, margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(receipt.clientDetails.name, margin, y)
  y += 5

  if (receipt.clientDetails?.address) {
    const address = receipt.clientDetails.address as string
    const addressLines = address
      .replace(/\\n/g, "\n")
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    addressLines.forEach((line: string) => {
      pdf.text(line, margin, y)
      y += 5
    })
  }

  if (receipt.clientDetails.phone) {
    pdf.text(receipt.clientDetails.phone, margin, y)
    y += 5
  }

  if (receipt.clientDetails.email) {
    pdf.text(receipt.clientDetails.email, margin, y)
    y += 5
  }
  if (receipt.clientDetails.registrationNumber) {
    pdf.text(`${t.registrationNumber}: ${receipt.clientDetails.registrationNumber}`, margin, y)
    y += 5
  }
  if (receipt.clientDetails.vatNumber) {
    pdf.text(`${t.vatNumber}: ${receipt.clientDetails.vatNumber}`, margin, y)
    y += 5
  }

  y += 10
  const tableLeft = margin
  const tableRight = pageWidth - margin
  const tableWidth = tableRight - tableLeft
  const colWidths = {
    description: tableWidth * 0.4,
    quantity: tableWidth * 0.2,
    unitPrice: tableWidth * 0.2,
    amount: tableWidth * 0.2,
  }

  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft, y, tableWidth, 8, "F")

  pdf.setFont("Roboto", "bold")
  pdf.text(t.description, tableLeft + 2, y + 5)
  pdf.text(t.quantity, tableLeft + colWidths.description + 2, y + 5)
  pdf.text(t.unitPrice, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(t.totalValue, tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

  y += 8

  pdf.setFont("Roboto", "normal")
  receipt.items.forEach((item: any, index: number) => {
    const rowHeight = 8

    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableLeft, y, tableWidth, rowHeight, "F")
    }

    pdf.text(item.description, tableLeft + 2, y + 5)
    pdf.text(item.quantity.toString(), tableLeft + colWidths.description + 2, y + 5)

    const unitPriceFormatted = formatCurrency(item.unitPrice, currency)
    pdf.text(unitPriceFormatted, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

    const amountFormatted = formatCurrency(item.quantity * item.unitPrice, currency)
    pdf.text(
      amountFormatted,
      tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
      y + 5,
    )

    y += rowHeight

    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  })

  // Totals section (styled like invoice)
  pdf.setFillColor(240, 240, 240)
  pdf.rect(
    tableLeft + colWidths.description + colWidths.quantity,
    y,
    colWidths.unitPrice + colWidths.amount,
    8,
    "F",
  )
  pdf.text(t.subtotal, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.subtotal, currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  const reverseCharge = shouldShowReverseChargeNotice({
    clientDetails: receipt.clientDetails,
  })
  if (reverseCharge) {
    pdf.setFontSize(8)
    pdf.text(t.reverseCharge, tableLeft + 2, y + 5)
    pdf.setFontSize(10)
  }

  pdf.text(t.tax, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.tax, currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  pdf.setFillColor(230, 230, 230)
  pdf.rect(
    tableLeft + colWidths.description + colWidths.quantity,
    y,
    colWidths.unitPrice + colWidths.amount,
    8,
    "F",
  )
  pdf.setFont("Roboto", "bold")
  pdf.text(t.total, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.total, currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 15

  // Notes
  if (receipt.notes) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    pdf.setFont("Roboto", "bold")
    pdf.text(t.notes, margin, y)
    y += 7

    pdf.setFont("Roboto", "normal")
    y = addWrappedText(receipt.notes, margin, y, tableWidth, 5)
    y += 10
  }
  const hasBankDetails = receipt.companyDetails.bankName || receipt.companyDetails.iban
  if (hasBankDetails) {
    pdf.setFontSize(10)
    pdf.setFont("Roboto", "bold")
    pdf.text(t.paymentTerms, margin, y)
    pdf.setFont("Roboto", "normal")
    y += 6

    const paymentDetails = [
      { label: t.bank, value: receipt.companyDetails.bankName },
      { label: t.iban, value: receipt.companyDetails.iban },
      { label: t.bankCode, value: receipt.companyDetails.swiftBic },
      { label: t.bankAddress, value: receipt.companyDetails.bankAddress }
    ]

    pdf.setFontSize(9)
    paymentDetails.forEach(({ label, value }) => {
      pdf.setFont("Roboto", "bold")
      pdf.text(label, margin, y)

      pdf.setFont("Roboto", "normal")
      pdf.text(value, margin + pdf.getTextWidth(label) + 3, y)

      y += 6
    })

    pdf.setFontSize(12)
    y += 10
  }


  pdf.setFont("Roboto", "normal")
  pdf.setFontSize(9)
  pdf.text(t.thankYou, pageWidth / 2, pageHeight - margin, { align: "center" })

  return pdf.output("blob")
}

export function downloadReceiptPDF(blob: Blob, filename: string): void {
  // Create a URL for the blob
  const url = URL.createObjectURL(blob)

  // Create a link element
  const link = document.createElement("a")
  link.href = url
  link.download = filename

  // Append to the document
  document.body.appendChild(link)

  // Trigger download
  link.click()

  // Clean up
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper function to format currency (mirrors invoice PDF)
function formatCurrency(amount: number, currency: string = "EUR"): string {
  const locale = "cs-CZ"

  const formatted = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  const symbols: Record<string, string> = {
    EUR: "€",
    CZK: "CZK",
    USD: "$",
    GBP: "£",
  }

  const symbol = symbols[currency] || currency
  return `${formatted} ${symbol}`
}

