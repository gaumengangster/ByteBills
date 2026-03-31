import jsPDF from "jspdf"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import { getTranslations } from "./translations"
import { registerFonts } from "./pdf-fonts"

export async function generateDeliveryNotePDF(deliveryNote: any): Promise<Blob> {
  const lang = deliveryNote.language || "en"
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
  pdf.text(t.deliveryNote, margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(`${t.deliveryNoteNumber}: ${deliveryNote.deliveryNoteNumber}`, margin, y)
  y += 5
  pdf.text(`${t.date}: ${formatDocumentDateBerlin(deliveryNote.deliveryDate, "MMMM d, yyyy")}`, margin, y)
  y += 5

  if (deliveryNote.invoiceReference) {
    pdf.text(`${t.invoiceReference}: ${deliveryNote.invoiceReference}`, margin, y)
    y += 5
  }

  if (deliveryNote.orderReference) {
    pdf.text(`${t.orderReference}: ${deliveryNote.orderReference}`, margin, y)
    y += 5
  }

  y += 10

  // Company details on the right
  const companyY = margin
  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")

  // Right-align all company details with proper positioning
  const rightMargin = pageWidth - margin
  pdf.text(deliveryNote.companyDetails.name, rightMargin, companyY, { align: "right" })

  pdf.setFontSize(9)
  pdf.setFont("Roboto", "normal")
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
    pdf.text(deliveryNote.companyDetails.phone, rightMargin, companyDetailY, { align: "right" })
    companyDetailY += 4
  }

  if (deliveryNote.companyDetails.email) {
    pdf.text(deliveryNote.companyDetails.email, rightMargin, companyDetailY, { align: "right" })
  }

  pdf.setFontSize(12)
  pdf.setFont("Roboto", "bold")
  pdf.text(t.deliverTo, margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont("Roboto", "normal")
  pdf.text(deliveryNote.clientDetails.name, margin, y)
  y += 5

  if (deliveryNote.clientDetails.address) {
    pdf.text(deliveryNote.clientDetails.address, margin, y)
    y += 5
  }

  if (deliveryNote.clientDetails.phone) {
    pdf.text(deliveryNote.clientDetails.phone, margin, y)
    y += 5
  }

  if (deliveryNote.clientDetails.email) {
    pdf.text(deliveryNote.clientDetails.email, margin, y)
    y += 5
  }
  if (deliveryNote.clientDetails.registrationNumber) {
    pdf.text(`${t.registrationNumber}: ${deliveryNote.clientDetails.registrationNumber}`, margin, y)
    y += 5
  }
  if (deliveryNote.clientDetails.vatNumber) {
    pdf.text(`${t.vatNumber}: ${deliveryNote.clientDetails.vatNumber}`, margin, y)
    y += 5
  }

  if (deliveryNote.deliveryAddress && deliveryNote.deliveryAddress !== deliveryNote.clientDetails.address) {
    y += 5
    pdf.setFontSize(12)
    pdf.setFont("Roboto", "bold")
    pdf.text(t.deliveryAddress, margin, y)
    y += 7

    pdf.setFontSize(10)
    pdf.setFont("Roboto", "normal")
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

  pdf.setFillColor(240, 240, 240)
  pdf.rect(tableLeft, y, tableWidth, 8, "F")

  pdf.setFont("Roboto", "bold")
  pdf.text(t.description, tableLeft + 2, y + 5)
  pdf.text(t.quantity, tableLeft + colWidths.description + 2, y + 5)
  pdf.text(t.notes.replace(":", ""), tableLeft + colWidths.description + colWidths.quantity + 2, y + 5)

  y += 8

  // Table rows
  pdf.setFont("Roboto", "normal")
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

    pdf.setFont("Roboto", "bold")
    pdf.text(t.deliveryInstructions, margin, y)
    y += 7

    pdf.setFont("Roboto", "normal")
    y = addWrappedText(deliveryNote.deliveryInstructions, margin, y, tableWidth, 5)
    y += 10
  }

  if (deliveryNote.notes) {
    if (y > pageHeight - 60) {
      pdf.addPage()
      y = margin
    }

    pdf.setFont("Roboto", "bold")
    pdf.text(t.notes, margin, y)
    y += 7

    pdf.setFont("Roboto", "normal")
    y = addWrappedText(deliveryNote.notes, margin, y, tableWidth, 5)
    y += 10
  }

  // Signature sections
  if (y > pageHeight - 60) {
    pdf.addPage()
    y = margin
  }

  pdf.setFont("Roboto", "bold")
  pdf.text(t.deliveredBy, margin, y)
  pdf.text(t.receivedBy, pageWidth / 2 + 10, y)
  y += 7

  pdf.setFont("Roboto", "normal")
  pdf.text(`${t.name}: ____________________`, margin, y)
  pdf.text(`${t.name}: ____________________`, pageWidth / 2 + 10, y)
  y += 10

  pdf.text(`${t.signature}: ________________`, margin, y)
  pdf.text(`${t.signature}: ________________`, pageWidth / 2 + 10, y)
  y += 10

  pdf.text(`${t.date}: ____________________`, margin, y)
  pdf.text(`${t.date}: ____________________`, pageWidth / 2 + 10, y)
  y += 15

  pdf.setFont("Roboto", "normal")
  pdf.setFontSize(9)
  pdf.text(t.thankYou, pageWidth / 2, pageHeight - margin, { align: "center" })

  pdf.setFont("Roboto", "normal")
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
