import jsPDF from "jspdf"
import { format } from "date-fns"

// Function to create a PDF directly without using html2canvas
export async function generateReceiptPDF(receipt: any): Promise<Blob> {
  // Create a new PDF document
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let y = margin

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lineHeight * lines.length
  }

  // Add company logo and info
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

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")

  // Right-align all company details with proper positioning
  const rightMargin = pageWidth - margin
  pdf.text(receipt.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
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
    pdf.text(`Phone: ${receipt.companyDetails.phone}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (receipt.companyDetails.email) {
    pdf.text(`Email: ${receipt.companyDetails.email}`, rightMargin, companyDetailY, { align: "right" })
  }

  // Client information
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text("Received From:", margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(receipt.clientDetails.name, margin, y)
  y += 5

  if (receipt.clientDetails.address) {
    pdf.text(receipt.clientDetails.address, margin, y)
    y += 5
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

  // Receipt items table
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

  // Table headers
  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft, y, tableWidth, 8, "F")

  pdf.setFont("helvetica", "bold")
  pdf.text("Description", tableLeft + 2, y + 5)
  pdf.text("Quantity", tableLeft + colWidths.description + 2, y + 5)
  pdf.text("Unit Price", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text("Amount", tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

  y += 8

  // Table rows
  pdf.setFont("helvetica", "normal")
  receipt.items.forEach((item: any, index: number) => {
    const rowHeight = 8

    // Add alternating row background
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableLeft, y, tableWidth, rowHeight, "F")
    }

    pdf.text(item.description, tableLeft + 2, y + 5)
    pdf.text(item.quantity.toString(), tableLeft + colWidths.description + 2, y + 5)

    const unitPriceFormatted = formatCurrency(item.unitPrice)
    pdf.text(unitPriceFormatted, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

    const amountFormatted = formatCurrency(item.quantity * item.unitPrice)
    pdf.text(amountFormatted, tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2, y + 5)

    y += rowHeight

    // Check if we need a new page
    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  })

  // Table footer (totals)
  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.text("Subtotal:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.subtotal || calculateSubtotal(receipt)),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.text("Tax:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.tax || calculateTax(receipt)),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  pdf.setFillColor(230, 230, 230)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.setFont("helvetica", "bold")
  pdf.text("Total Paid:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(receipt.total || calculateTotal(receipt)),
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

  // Footer
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.text("Thank you for your business!", pageWidth / 2, pageHeight - margin, { align: "center" })

  // Add ByteBills branding
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.text("Generated by ByteBills", pageWidth - margin, pageHeight - margin, { align: "right" })

  // Return as blob
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

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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

// Helper function to calculate subtotal
function calculateSubtotal(receipt: any): number {
  return receipt.items.reduce((sum: number, item: any) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return sum + quantity * unitPrice
  }, 0)
}

// Helper function to calculate tax
function calculateTax(receipt: any): number {
  const subtotal = calculateSubtotal(receipt)
  return subtotal * 0.1 // 10% tax rate example
}

// Helper function to calculate total
function calculateTotal(receipt: any): number {
  const subtotal = calculateSubtotal(receipt)
  const tax = calculateTax(receipt)
  return subtotal + tax
}
