import jsPDF from "jspdf"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import { getTranslations } from "./translations"
import { registerFonts } from "./pdf-fonts"
import { shouldShowReverseChargeNotice } from "./reverse-charge"
import { mergeInvoiceCompanyDetailsFromCompany, type CompanyDoc } from "./invoice-company-details"

export async function generateInvoicePDF(invoice: any, companies?: CompanyDoc[]): Promise<Blob> {
  const mergedDetails =
    Array.isArray(companies) && companies.length > 0
      ? mergeInvoiceCompanyDetailsFromCompany(invoice, companies)
      : invoice.companyDetails ?? {}
  const inv = { ...invoice, companyDetails: mergedDetails }
  const lang = inv.language || "en"
  const t = getTranslations(lang)

  const pdf = new jsPDF("p", "mm", "a4")
  await registerFonts(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let y = margin

  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lineHeight * lines.length
  }

  pdf.setFontSize(20)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.invoice, margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(`${t.invoiceNumber}: ${inv.invoiceNumber}`, margin, y)
  y += 5
  pdf.text(`${t.date}: ${formatDocumentDateBerlin(inv.invoiceDate, "MMMM d, yyyy")}`, margin, y)
  y += 5
  pdf.text(`${t.dueDate}: ${formatDocumentDateBerlin(inv.dueDate, "MMMM d, yyyy")}`, margin, y)
/*   y += 5
  pdf.text(`Status: ${inv.status.toUpperCase()}`, margin, y) */
  y += 15

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")

  // Right-align all company details with proper positioning
  const rightMargin = pageWidth - margin
  const cd = inv.companyDetails as {
    name?: string
    address?: string
    city?: string
    country?: string
    email?: string
    phone?: string
  }
  pdf.text(String(cd.name ?? ""), rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("Roboto", "normal")
  let companyDetailY = companyY + 5

  if (cd.address?.trim()) {
    const addrLines = cd.address
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of addrLines) {
      pdf.text(line, rightMargin, companyDetailY, { align: "right" })
      companyDetailY += 4
    }
  }

  if (cd.city || cd.country) {
    const location = [cd.city, cd.country].filter(Boolean).join(", ")
    pdf.text(location, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (cd.email) {
    pdf.text(cd.email, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (cd.phone) {
    pdf.text(cd.phone, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.billTo, margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(inv.clientDetails.name, margin, y)
  y += 5

  if (inv.clientDetails?.address) {
    const address = inv.clientDetails.address as string
    const addressLines = address
      .replace(/\\n/g, '\n') 
      .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
    
    addressLines.forEach((line: string) => {
      pdf.text(line, margin, y)
      y += 5
    })
  }
  

  if (inv.clientDetails.phone) {
    pdf.text(inv.clientDetails.phone, margin, y)
    y += 5
  }

  if (inv.clientDetails.email) {
    pdf.text(inv.clientDetails.email, margin, y)
    y += 5
  }
  if (inv.clientDetails.registrationNumber) {
    pdf.text(`${t.registrationNumber}: ${inv.clientDetails.registrationNumber}`, margin, y)
    y += 5
  }
  if (inv.clientDetails.vatNumber) {
    pdf.text(`${t.vatNumber}: ${inv.clientDetails.vatNumber}`, margin, y)
    y += 5
  }

  y += 10
  const tableTop = y
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

  // Table rows
  pdf.setFont("Roboto", "normal")
  inv.items.forEach((item: any, index: number) => {
    const rowHeight = 8

    // Add alternating row background
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableLeft, y, tableWidth, rowHeight, "F")
    }

    pdf.text(item.description, tableLeft + 2, y + 5)
    pdf.text(item.quantity.toString() + ' ' + inv.unitOfWork, tableLeft + colWidths.description + 2, y + 5)

    const unitPriceFormatted = formatCurrency(item.unitPrice, inv.currency)
    pdf.text(unitPriceFormatted, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

    const amountFormatted = formatCurrency(item.quantity * item.unitPrice, inv.currency)
    pdf.text(amountFormatted, tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

    y += rowHeight

    // Check if we need a new page
    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  })

  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.text(t.subtotal, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(inv.subtotal, inv.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  const reverseCharge = shouldShowReverseChargeNotice({
    clientDetails: inv.clientDetails,
  })
  if (reverseCharge) {
    pdf.setFontSize(8)
    pdf.text(t.reverseCharge, tableLeft + 2, y + 5)
    pdf.setFontSize(10)
  }
  
  pdf.text(t.tax, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(inv.tax, inv.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  const taxDateForDoc = inv.taxDate
  pdf.setFillColor(230, 230, 230)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.setFont("Roboto", "normal")
  pdf.setFontSize(9)
  const taxDateLine = `${t.taxDate} ${formatDocumentDateBerlin(taxDateForDoc, "MMMM d, yyyy")}`
  pdf.text(taxDateLine, tableLeft + 2, y + 5)
  pdf.setFontSize(10)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.total, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(inv.total, inv.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 15

  // Notes and terms
  if (inv.notes || inv.terms) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    if (inv.notes) {
      pdf.setFont("Roboto", "bold")
      pdf.text(t.notes, margin, y)
      y += 7

      pdf.setFont("Roboto", "normal")
      y = addWrappedText(inv.notes, margin, y, tableWidth, 5)
      y += 10
    }

    if (inv.terms) {
      pdf.setFont("Roboto", "bold")
      pdf.text(t.termsAndConditions, margin, y)
      y += 7

      pdf.setFont("Roboto", "normal")
      y = addWrappedText(inv.terms, margin, y, tableWidth, 5)
      y += 10
    }
  }
const hasBankDetails = inv.companyDetails.bankName || inv.companyDetails.iban
if (hasBankDetails) {
  pdf.setFontSize(10)
  pdf.setFont("Roboto", 'bold')
  pdf.text(t.paymentTerms, margin, y)
  pdf.setFont("Roboto", 'normal')
  y += 6
  
  const paymentDetails = [
    { label: t.bank, value: inv.companyDetails.bankName },
    { label: t.iban, value: inv.companyDetails.iban },
    { label: t.bankCode, value:  inv.companyDetails.swiftBic },
    { label: t.bankAddress, value: inv.companyDetails.bankAddress }
  ]
  
  pdf.setFontSize(9)
  paymentDetails.forEach(({ label, value }) => {
    pdf.setFont("Roboto", 'bold')
    pdf.text(label, margin, y)
    
    pdf.setFont("Roboto", 'normal')
    pdf.text(value, margin + pdf.getTextWidth(label) + 3, y)  // ← Dinamički x pozicija
    
    y += 6
  })
  
  pdf.setFontSize(12)  // Vrati na default
  y += 10
}




  pdf.setFont("Roboto", "normal")
  pdf.setFontSize(9)
  pdf.text(t.thankYou, pageWidth / 2, pageHeight - margin, { align: "center" })

  // Add ByteBills branding
/*   pdf.setFont("Roboto", "normal")
  pdf.setFontSize(8)
  pdf.text("Generated by ByteBills", pageWidth - margin, pageHeight - margin, { align: "right" }) */

  // Return as blob
  return pdf.output("blob")
}

export function downloadPDF(blob: Blob, filename: string): void {
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

// Helper function to format currency
function formatCurrency(amount: number, currency: string = 'EUR'): string {
  const locale = 'cs-CZ'  // EU format
  
  const formatted = new Intl.NumberFormat(locale, {
    style: "decimal",  // Bez simbola
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  
  // Ručni simboli za pouzdanost
  const symbols: Record<string, string> = {
    'EUR': '€',
    'CZK': 'CZK',
    'USD': '$',
    'GBP': '£',
  }
  
  const symbol = symbols[currency] || currency
  return `${formatted} ${symbol}`
}
