import jsPDF from "jspdf"
import html2canvas from 'html2canvas-pro'

export async function generateInvoicePDF(invoiceId: string): Promise<Blob> {
  // Get the invoice element
  const element = document.getElementById(`invoice-content-${invoiceId}`)
  if (!element) {
    throw new Error("Invoice element not found")
  }

  // Create canvas from the element
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  })

  // Calculate dimensions to fit on A4
  const imgWidth = 210 // A4 width in mm
  const pageHeight = 297 // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // Create PDF
  const pdf = new jsPDF("p", "mm", "a4")

  // Add image to PDF
  let heightLeft = imgHeight
  let position = 0

  // First page
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  // Add additional pages if needed
  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

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
