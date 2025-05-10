import jsPDF from "jspdf"
import { format } from "date-fns"

// Function to create a PDF directly without using html2canvas
export async function generateDeliveryNotePDF(deliveryNote: any): Promise<Blob> {
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
  pdf.text("DELIVERY NOTE", margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Delivery Note #: ${deliveryNote.deliveryNoteNumber}`, margin, y)
  y += 5
  pdf.text(`Date: ${format(new Date(deliveryNote.deliveryDate), "MMMM d, yyyy")}`, margin, y)
  y += 5

  if (deliveryNote.invoiceReference) {
    pdf.text(`Invoice Reference: ${deliveryNote.invoiceReference}`, margin, y)
    y += 5
  }

  if (deliveryNote.orderReference) {
    pdf.text(`Order Reference: ${deliveryNote.orderReference}`, margin, y)
    y += 5
  }

  y += 10

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")

  // Right-align all company details with proper positioning
  const rightMargin = pageWidth - margin
  pdf.text(deliveryNote.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  let companyDetailY = companyY + 5

  if (deliveryNote.companyDetails.address) {
    pdf.text(deliveryNote.companyDetails.address, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (deliveryNote.companyDetails.city || deliveryNote.companyDetails.country) {
    const location = [deliveryNote.companyDetails.city, deliveryNote.companyDetails.country].filter(Boolean).join(", ")
    pdf.text(location, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (deliveryNote.companyDetails.phone) {
    pdf.text(`Phone: ${deliveryNote.companyDetails.phone}`, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (deliveryNote.companyDetails.email) {
    pdf.text(`Email: ${deliveryNote.companyDetails.email}`, rightMargin, companyDetailY, { align: "right" })
  }

  // Client information
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text("Deliver To:", margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(deliveryNote.clientDetails.name, margin, y)
  y += 5

  if (deliveryNote.clientDetails.address) {
    pdf.text(deliveryNote.clientDetails.address, margin, y)
    y += 5
  }

  if (deliveryNote.clientDetails.phone) {
    pdf.text(`Phone: ${deliveryNote.clientDetails.phone}`, margin, y)
    y += 5
  }

  if (deliveryNote.clientDetails.email) {
    pdf.text(`Email: ${deliveryNote.clientDetails.email}`, margin, y)
    y += 5
  }

  // Delivery address if different
  if (deliveryNote.deliveryAddress && deliveryNote.deliveryAddress !== deliveryNote.clientDetails.address) {
    y += 5
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("Delivery Address:", margin, y)
    y += 7

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(deliveryNote.deliveryAddress, margin, y)
    y += 5
  }

  y += 10

  // Items table
  const tableTop = y
  const tableLeft = margin
  const tableRight = pageWidth - margin
  const tableWidth = tableRight - tableLeft
  const colWidths = {
    description: tableWidth * 0.5,
    quantity: tableWidth * 0.2,
    notes: tableWidth * 0.3,
  }

  // Table headers
  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft, y, tableWidth, 8, "F")

  pdf.setFont("helvetica", "bold")
  pdf.text("Description", tableLeft + 2, y + 5)
  pdf.text("Quantity", tableLeft + colWidths.description + 2, y + 5)
  pdf.text("Notes", tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

  y += 8

  // Table rows
  pdf.setFont("helvetica", "normal")
  deliveryNote.items.forEach((item: any, index: number) => {
    const rowHeight = 8

    // Add alternating row background
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableLeft, y, tableWidth, rowHeight, "F")
    }

    pdf.text(item.description, tableLeft + 2, y + 5)
    pdf.text(item.quantity.toString(), tableLeft + colWidths.description + 2, y + 5)

    if (item.notes) {
      pdf.text(item.notes, tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)
    }

    y += rowHeight

    // Check if we need a new page
    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  })

  y += 10

  // Delivery instructions
  if (deliveryNote.deliveryInstructions) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    pdf.setFont("helvetica", "bold")
    pdf.text("Delivery Instructions:", margin, y)
    y += 7

    pdf.setFont("helvetica", "normal")
    y = addWrappedText(deliveryNote.deliveryInstructions, margin, y, tableWidth, 5)
    y += 10
  }

  // Notes
  if (deliveryNote.notes) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    pdf.setFont("helvetica", "bold")
    pdf.text("Notes:", margin, y)
    y += 7

    pdf.setFont("helvetica", "normal")
    y = addWrappedText(deliveryNote.notes, margin, y, tableWidth, 5)
    y += 10
  }

  // Signature sections
  if (y > pageHeight - 60) {
    pdf.addPage()
    y = margin
  }

  pdf.setFont("helvetica", "bold")
  pdf.text("Delivered By:", margin, y)
  pdf.text("Received By:", pageWidth / 2 + 10, y)
  y += 7

  pdf.setFont("helvetica", "normal")
  pdf.text("Name: ____________________", margin, y)
  pdf.text("Name: ____________________", pageWidth / 2 + 10, y)
  y += 10

  pdf.text("Signature: ________________", margin, y)
  pdf.text("Signature: ________________", pageWidth / 2 + 10, y)
  y += 10

  pdf.text("Date: ____________________", margin, y)
  pdf.text("Date: ____________________", pageWidth / 2 + 10, y)
  y += 15

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

export function downloadDeliveryNotePDF(blob: Blob, filename: string): void {
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
