import jsPDF from "jspdf"
import { format } from "date-fns"
import { de as dateFnsDe } from "date-fns/locale"
import { getTranslations } from "./translations"

export async function generateInvoicePDF(invoice: any): Promise<Blob> {
  const lang = invoice.language || "en"
  const t = getTranslations(lang)
  const dateLocale = lang === "de" ? { locale: dateFnsDe } : undefined

  const pdf = new jsPDF("p", "mm", "a4")
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
  pdf.setFont("helvetica", "bold")
  pdf.text(t.invoice, margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`${t.invoiceNumber}: ${invoice.invoiceNumber}`, margin, y)
  y += 5
  pdf.text(`${t.date}: ${format(new Date(invoice.invoiceDate), "MMMM d, yyyy", dateLocale)}`, margin, y)
  y += 5
  pdf.text(`${t.dueDate}: ${format(new Date(invoice.dueDate), "MMMM d, yyyy", dateLocale)}`, margin, y)
/*   y += 5
  pdf.text(`Status: ${invoice.status.toUpperCase()}`, margin, y) */
  y += 15

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")

  // Right-align all company details with proper positioning
  const rightMargin = pageWidth - margin
  pdf.text(invoice.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  let companyDetailY = companyY + 5

  if (invoice.companyDetails.address) {
    pdf.text(`${t.street}: ${invoice.companyDetails.address}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (invoice.companyDetails.city || invoice.companyDetails.country) {
    const location = [invoice.companyDetails.city, invoice.companyDetails.country].filter(Boolean).join(", ")
    pdf.text(`${t.city}: ${location}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (invoice.companyDetails.phone) {
    pdf.text(`${t.phone}: ${invoice.companyDetails.phone}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (invoice.companyDetails.email) {
    pdf.text(`${t.email}: ${invoice.companyDetails.email}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text(t.billTo, margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(invoice.clientDetails.name, margin, y)
  y += 5

  if (invoice.clientDetails?.address) {
    // Type guard + safe split
    const address = invoice.clientDetails.address as string
    const addressLines = address
      .replace(/\\n/g, '\n')  // ← Pretvori literal u pravi newline
      .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
    
    addressLines.forEach((line: string, index: number) => {
      let label = '';
      
      if (index === 0) {
        label = `${t.street}: `;
      } else if (index === 1 && addressLines.length > 1) {
        label = `${t.city}: `;
      }
      
      const fullText = label + line;
      pdf.text(fullText as any, margin, y)  // ← pdf-lib tip fix
      y += 5
    })
  }
  

  if (invoice.clientDetails.phone) {
    pdf.text(`${t.phone}: ${invoice.clientDetails.phone}`, margin, y)
    y += 5
  }

  if (invoice.clientDetails.email) {
    pdf.text(`${t.email}: ${invoice.clientDetails.email}`, margin, y)
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

  pdf.setFont("helvetica", "bold")
  pdf.text(t.description, tableLeft + 2, y + 5)
  pdf.text(t.quantity, tableLeft + colWidths.description + 2, y + 5)
  pdf.text(t.unitPrice, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(t.totalValue, tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

  y += 8

  // Table rows
  pdf.setFont("helvetica", "normal")
  invoice.items.forEach((item: any, index: number) => {
    const rowHeight = 8

    // Add alternating row background
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableLeft, y, tableWidth, rowHeight, "F")
    }

    pdf.text(item.description, tableLeft + 2, y + 5)
    pdf.text(item.quantity.toString() + ' ' + invoice.unitOfWork, tableLeft + colWidths.description + 2, y + 5)

    const unitPriceFormatted = formatCurrency(item.unitPrice, invoice.currency)
    pdf.text(unitPriceFormatted, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

    const amountFormatted = formatCurrency(item.quantity * item.unitPrice, invoice.currency)
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
    formatCurrency(invoice.subtotal, invoice.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  const reverseCharge = true
  if(reverseCharge){
    pdf.setFontSize(8)
    pdf.text(t.reverseCharge, tableLeft + 2, y + 5)
    pdf.setFontSize(10)
  }
  
  pdf.text(t.tax, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(invoice.tax, invoice.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

   pdf.setFillColor(230, 230, 230)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F") 
  pdf.setFont("helvetica", "bold")
  pdf.text(t.total, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(invoice.total, invoice.currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 15

  // Notes and terms
  if (invoice.notes || invoice.terms) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    if (invoice.notes) {
      pdf.setFont("helvetica", "bold")
      pdf.text(t.notes, margin, y)
      y += 7

      pdf.setFont("helvetica", "normal")
      y = addWrappedText(invoice.notes, margin, y, tableWidth, 5)
      y += 10
    }

    if (invoice.terms) {
      pdf.setFont("helvetica", "bold")
      pdf.text(t.termsAndConditions, margin, y)
      y += 7

      pdf.setFont("helvetica", "normal")
      y = addWrappedText(invoice.terms, margin, y, tableWidth, 5)
      y += 10
    }
  }

pdf.setFontSize(10)
pdf.setFont("helvetica", 'bold')
pdf.text(t.paymentTerms, margin, y)
pdf.setFont("helvetica", 'normal')
y += 6

const paymentDetails = [
  { label: "Bank:", value: "Wise Europe SA" },
  { label: "IBAN:", value: "BE67 9671 9351 7487" },
  { label: "Bank code (SWIFT/BIC):", value: "TRWIBEB1XXX" },
  { label: "Bank Address:", value: "Wise Europe SA, Avenue Louise 54, Room S52, 1050, Belgium" }
]

pdf.setFontSize(9)
paymentDetails.forEach(({ label, value }) => {
  // Bold label + value U ISTOM REDU (bez razmaka)
  pdf.setFont("helvetica", 'bold')
  pdf.text(label, margin, y)
  
  pdf.setFont("helvetica", 'normal')
  pdf.text(value, margin + pdf.getTextWidth(label) + 3, y)  // ← Dinamički x pozicija
  
  y += 6
})

pdf.setFontSize(12)  // Vrati na default
y += 10



  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.text(t.thankYou, pageWidth / 2, pageHeight - margin, { align: "center" })

  // Add ByteBills branding
/*   pdf.setFont("helvetica", "normal")
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
