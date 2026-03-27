"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Badge, Download, X } from "lucide-react"
import { generateInvoicePDF, downloadPDF } from "@/lib/pdf-service"
import { buildDocumentFilename } from "@/lib/document-filename"
import { formatCurrency } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"

type InvoicePreviewProps = {
  isOpen: boolean
  onClose: () => void
  invoiceData: any
  companies: any[]
}

export function InvoicePreview({ isOpen, onClose, invoiceData, companies }: InvoicePreviewProps) {
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  const selectedCompany = companies.find((c) => c.id === invoiceData.companyId) || companies[0]

  const currencyObj = { currency: invoiceData.currency || "EUR" }

  const fmtCurrency = (amount: number) => formatCurrency(amount, currencyObj)

  const calculateSubtotal = () => {
    const items = invoiceData.items || []
    return items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      return sum + quantity * unitPrice
    }, 0)
  }

  const taxRate = invoiceData.taxRate ?? 0
  const calculateTax = () => {
    return calculateSubtotal() * (taxRate / 100)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  const handleDownload = async () => {
    setIsPdfLoading(true)
    try {
      const subtotal = calculateSubtotal()
      const tax = calculateTax()
      const total = calculateTotal()

      const pdfData = {
        ...invoiceData,
        companyDetails: {
          name: selectedCompany?.name || "",
          address: selectedCompany?.businessDetails?.address || "",
          city: selectedCompany?.businessDetails?.city || "",
          country: selectedCompany?.businessDetails?.country || "",
          email: selectedCompany?.businessDetails?.email || "",
          phone: selectedCompany?.businessDetails?.phone || "",
          bankName: selectedCompany?.businessDetails?.bankName || "",
          iban: selectedCompany?.businessDetails?.iban || "",
          swiftBic: selectedCompany?.businessDetails?.swiftBic || "",
          bankAddress: selectedCompany?.businessDetails?.bankAddress || "",
        
        },
        clientDetails: {
          name: invoiceData.clientName,
          address: invoiceData.clientAddress || "",
          email: invoiceData.clientEmail || "",
          phone: invoiceData.clientPhone || "",
          registrationNumber: invoiceData.clientRegistrationNumber || "",
          vatNumber: invoiceData.clientVatNumber || "",
        },
        invoiceDate: invoiceData.invoiceDate instanceof Date ? invoiceData.invoiceDate.toISOString() : invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate instanceof Date ? invoiceData.dueDate.toISOString() : invoiceData.dueDate,
        subtotal,
        tax,
        total,
        language: invoiceData.clientLanguage || "en",
      }

      const pdfBlob = await generateInvoicePDF(pdfData)
      downloadPDF(pdfBlob, buildDocumentFilename(pdfData))

      toast({ title: "PDF generated", description: "Your invoice PDF has been downloaded." })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" })
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-4 border rounded-md">
          <div className="bg-white p-8" id="invoice-content">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-1">INVOICE</h1>
                <div className="text-muted-foreground">
                  <div>Invoice # {invoiceData.invoiceNumber}</div>
                  <div>Date: {invoiceData.invoiceDate ? format(new Date(invoiceData.invoiceDate), "PP") : "N/A"}</div>
                  <div>Due: {invoiceData.dueDate ? format(new Date(invoiceData.dueDate), "PP") : "N/A"}</div>
                </div>
              </div>

              <div className="text-right">
                {selectedCompany.logo ? (
                  <img
                    src={selectedCompany.logo || "/placeholder.svg"}
                    alt={selectedCompany.name}
                    className="w-24 h-auto mb-2"
                  />
                ) : (
                  <div className="text-xl font-bold mb-2">{selectedCompany.name}</div>
                )}
                <div className="text-sm text-muted-foreground">
                  {selectedCompany.businessDetails?.address && <div>{selectedCompany.businessDetails.address}</div>}
                  {(selectedCompany.businessDetails?.city || selectedCompany.businessDetails?.country) && (
                    <div>
                      {selectedCompany.businessDetails.city}
                      {selectedCompany.businessDetails.city && selectedCompany.businessDetails.country && ", "}
                      {selectedCompany.businessDetails.country}
                    </div>
                  )}
                  {selectedCompany.businessDetails?.phone && <div>{selectedCompany.businessDetails.phone}</div>}
                  {selectedCompany.businessDetails?.email && <div>{selectedCompany.businessDetails.email}</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-lg font-semibold mb-2">Bill To:</h2>
                <div>
                  <div className="font-medium">{invoiceData.clientName || "Client Name"}</div>
                  {invoiceData.clientAddress && (
                    <div className="text-muted-foreground">{invoiceData.clientAddress}</div>
                  )}
                  {invoiceData.clientPhone && <div className="text-muted-foreground">{invoiceData.clientPhone}</div>}
                  {invoiceData.clientEmail && <div className="text-muted-foreground">{invoiceData.clientEmail}</div>}
                  {invoiceData.clientEmail && <div className="text-muted-foreground">{invoiceData.clientRegistrationNumber}</div>}
                  {invoiceData.clientEmail && <div className="text-muted-foreground">{invoiceData.clientVatNumber}</div>}
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-lg font-semibold mb-2">Payment Details:</h2>
                <div className="text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Account Name:</span>
                    <span>{selectedCompany.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Account Number:</span>
                    <span>XXXX-XXXX-XXXX</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="bg-muted rounded-t-md overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 font-medium">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
              </div>

              <div className="divide-y border-x">
                {(invoiceData.items || []).map((item: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-4 p-4">
                    <div className="col-span-5">{item.description || "Item Description"}</div>
                    <div className="col-span-2 text-center">{item.quantity || 0}</div>
                    <div className="col-span-2 text-right">{fmtCurrency(item.unitPrice || 0)}</div>
                    <div className="col-span-3 text-right">
                      {fmtCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border rounded-b-md">
                <div className="p-4 flex justify-end">
                  <div className="w-1/3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{fmtCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                      <span>{fmtCurrency(calculateTax())}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total:</span>
                      <span>{fmtCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(invoiceData.notes || invoiceData.terms) && (
              <div className="grid grid-cols-2 gap-8 mb-8">
                {invoiceData.notes && (
                  <div>
                    <h3 className="font-medium mb-2">Notes:</h3>
                    <p className="text-sm text-muted-foreground">{invoiceData.notes}</p>
                  </div>
                )}

                {invoiceData.terms && (
                  <div>
                    <h3 className="font-medium mb-2">Terms & Conditions:</h3>
                    <p className="text-sm text-muted-foreground">{invoiceData.terms}</p>
                  </div>
                )}
              </div>
            )}

            <div className="text-center mt-8 pt-8 border-t text-sm text-muted-foreground">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button onClick={handleDownload} disabled={isPdfLoading}>
            <Download className="mr-2 h-4 w-4" />
            {isPdfLoading ? "Generating PDF..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

