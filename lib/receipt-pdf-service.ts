import jsPDF from "jspdf"
import { format } from "date-fns"

// Function to create a PDF directly without using html2canvas
export async function generateReceiptPDF(receipt: any): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let y = margin

  const currency = receipt.currency || "EUR"

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lineHeight * lines.length
  }

  // Header
  pdf.setFontSize(20)
  pdf.setFont("helvetica", "bold")
  pdf.text("RECEIPT", margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Receipt #: ${receipt.receiptNumber}`, margin, y)
  y += 5
  pdf.text(`Date: ${format(new Date(receipt.receiptDate), "MMMM d, yyyy")}`, margin, y)
  y += 5

  if (receipt.invoiceReference) {
    pdf.text(`Invoice Reference: ${receipt.invoiceReference}`, margin, y)
    y += 5
  }

  pdf.text(`Payment Method: ${getPaymentMethodText(receipt.paymentMethod)}`, margin, y)
  y += 15

  // Company details on the right (same style as invoice)
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")

  const rightMargin = pageWidth - margin
  pdf.text(receipt.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  let companyDetailY = companyY + 5

  if (receipt.companyDetails.address) {
    pdf.text(`Street: ${receipt.companyDetails.address}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.city || receipt.companyDetails.country) {
    const location = [receipt.companyDetails.city, receipt.companyDetails.country].filter(Boolean).join(", ")
    pdf.text(`City: ${location}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.phone) {
    pdf.text(`Phone: ${receipt.companyDetails.phone}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.email) {
    pdf.text(`Email: ${receipt.companyDetails.email}`, rightMargin, companyDetailY, { align: "right" })
  }

  // Client information (same layout as invoice)
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text("Received From:", margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(receipt.clientDetails.name, margin, y)
  y += 5

  if (receipt.clientDetails?.address) {
    const address = receipt.clientDetails.address as string
    const addressLines = address
      .replace(/\\n/g, "\n")
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    addressLines.forEach((line: string, index: number) => {
      let label = ""

      if (index === 0) {
        label = "Street: "
      } else if (index === 1 && addressLines.length > 1) {
        label = "City: "
      }

      const fullText = label + line
      pdf.text(fullText as any, margin, y)
      y += 5
    })
  }

  if (receipt.clientDetails.phone) {
    pdf.text(`Phone: ${receipt.clientDetails.phone}`, margin, y)
    y += 5
  }

  if (receipt.clientDetails.email) {
    pdf.text(`Email: ${receipt.clientDetails.email}`, margin, y)
    y += 5
  }

  y += 10

  // Items table (mirrors invoice)
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
  pdf.text("Description", tableLeft + 2, y + 5)
  pdf.text("Quantity", tableLeft + colWidths.description + 2, y + 5)
  pdf.text("Unit Price", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text("Total Value", tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

  y += 8

  pdf.setFont("helvetica", "normal")
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
  pdf.text("Subtotal:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.subtotal, currency),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  const reverseCharge = true
  if (reverseCharge) {
    pdf.setFontSize(8)
    pdf.text(
      "Reverse Charge (Steuerschuldnerschaft des Leistungsempfängers)",
      tableLeft + 2,
      y + 5,
    )
    pdf.setFontSize(10)
  }

  pdf.text("Tax:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
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
  pdf.setFont("helvetica", "bold")
  pdf.text("Total:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
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

    pdf.setFont("helvetica", "bold")
    pdf.text("Notes:", margin, y)
    y += 7

    pdf.setFont("helvetica", "normal")
    y = addWrappedText(receipt.notes, margin, y, tableWidth, 5)
    y += 10
  }

  // Payment terms (reuse same block as invoice)
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")
  pdf.text("Payment Terms:", margin, y)
  pdf.setFont("helvetica", "normal")
  y += 6

  const paymentDetails = [
    { label: "Bank:", value: "Wise Europe SA" },
    { label: "IBAN:", value: "BE67 9671 9351 7487" },
    { label: "Bank code (SWIFT/BIC):", value: "TRWIBEB1XXX" },
    {
      label: "Bank Address:",
      value: "Wise Europe SA, Avenue Louise 54, Room S52, 1050, Belgium",
    },
  ]

  pdf.setFontSize(9)
  paymentDetails.forEach(({ label, value }) => {
    pdf.setFont("helvetica", "bold")
    pdf.text(label, margin, y)

    pdf.setFont("helvetica", "normal")
    pdf.text(value, margin + pdf.getTextWidth(label) + 3, y)

    y += 6
  })

  pdf.setFontSize(12)
  y += 10

  // Footer
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.text("Thank you for your business!", pageWidth / 2, pageHeight - margin, { align: "center" })

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

// Helper function to get payment method text
function getPaymentMethodText(method: string): string {
  switch (method) {
    case "cash":
      return "Cash"
    case "card":
      return "Credit/Debit Card"
    case "bank":
      return "Bank Transfer"
    case "paypal":
      return "PayPal"
    case "other":
      return "Other"
    default:
      return method
  }
}

// We no longer need separate calculateSubtotal/Tax/Total helpers here,
// because subtotal/tax/total are already stored on the receipt object.
