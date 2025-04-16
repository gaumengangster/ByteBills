import jsPDF from "jspdf"
import { format } from "date-fns"

// Function to create a PDF directly without using html2canvas
export async function generateInvoicePDF(invoice: any): Promise<Blob> {
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
  pdf.text("INVOICE", margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Invoice #: ${invoice.invoiceNumber}`, margin, y)
  y += 5
  pdf.text(`Date: ${format(new Date(invoice.invoiceDate), "MMMM d, yyyy")}`, margin, y)
  y += 5
  pdf.text(`Due Date: ${format(new Date(invoice.dueDate), "MMMM d, yyyy")}`, margin, y)
  y += 5
  pdf.text(`Status: ${invoice.status.toUpperCase()}`, margin, y)
  y += 15

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text(invoice.companyDetails.name, pageWidth - margin - 60, companyY, { align: "right" })

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  if (invoice.companyDetails.address) {
    pdf.text(invoice.companyDetails.address, pageWidth - margin - 60, companyY + 5, { align: "right" })
  }

  if (invoice.companyDetails.city || invoice.companyDetails.country) {
    const location = [invoice.companyDetails.city, invoice.companyDetails.country].filter(Boolean).join(", ")
    pdf.text(location, pageWidth - margin - 60, companyY + 10, { align: "right" })
  }

  if (invoice.companyDetails.phone) {
    pdf.text(`Phone: ${invoice.companyDetails.phone}`, pageWidth - margin - 60, companyY + 15, { align: "right" })
  }

  if (invoice.companyDetails.email) {
    pdf.text(`Email: ${invoice.companyDetails.email}`, pageWidth - margin - 60, companyY + 20, { align: "right" })
  }

  // Client information
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text("Bill To:", margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(invoice.clientDetails.name, margin, y)
  y += 5

  if (invoice.clientDetails.address) {
    pdf.text(invoice.clientDetails.address, margin, y)
    y += 5
  }

  if (invoice.clientDetails.phone) {
    pdf.text(`Phone: ${invoice.clientDetails.phone}`, margin, y)
    y += 5
  }

  if (invoice.clientDetails.email) {
    pdf.text(`Email: ${invoice.clientDetails.email}`, margin, y)
    y += 5
  }

  y += 10

  // Invoice items table
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
  invoice.items.forEach((item: any, index: number) => {
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
    formatCurrency(invoice.subtotal),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.text("Tax:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(invoice.tax),
    tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 2,
    y + 5,
  )
  y += 8

  pdf.setFillColor(230, 230, 230)
  pdf.rect(tableLeft + colWidths.description + colWidths.quantity, y, colWidths.unitPrice + colWidths.amount, 8, "F")
  pdf.setFont("helvetica", "bold")
  pdf.text("Total:", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
  pdf.text(
    formatCurrency(invoice.total),
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
      pdf.text("Notes:", margin, y)
      y += 7

      pdf.setFont("helvetica", "normal")
      y = addWrappedText(invoice.notes, margin, y, tableWidth, 5)
      y += 10
    }

    if (invoice.terms) {
      pdf.setFont("helvetica", "bold")
      pdf.text("Terms & Conditions:", margin, y)
      y += 7

      pdf.setFont("helvetica", "normal")
      y = addWrappedText(invoice.terms, margin, y, tableWidth, 5)
      y += 10
    }
  }

  // Footer
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.text("Thank you for your business!", pageWidth / 2, pageHeight - margin, { align: "center" })

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
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
