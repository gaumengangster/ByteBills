"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import { Badge, Download, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { generateReceiptPDF, downloadReceiptPDF } from "@/lib/receipt-pdf-service"
import { buildDocumentFilename } from "@/lib/document-filename"
import { toast } from "@/components/ui/use-toast"

type ReceiptPreviewProps = {
  isOpen: boolean
  onClose: () => void
  receiptData: any
  companies: any[]
  currency: string
  taxPercentage: number
}

export function ReceiptPreview({
  isOpen,
  onClose,
  receiptData,
  companies,
  currency,
  taxPercentage,
}: ReceiptPreviewProps) {
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  const selectedCompany = companies.find((c) => c.id === receiptData.companyId) || companies[0]

  const currencyObj = { currency: currency || "EUR" }
  const fmtCurrency = (amount: number) => formatCurrency(amount, currencyObj)

  const calculateSubtotal = () => {
    const items = receiptData.items || []
    return items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      return sum + quantity * unitPrice
    }, 0)
  }

  const calculateTax = () => {
    return calculateSubtotal() * (taxPercentage / 100)
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
        ...receiptData,
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
          name: receiptData.clientName,
          address: receiptData.clientAddress || "",
          email: receiptData.clientEmail || "",
          phone: receiptData.clientPhone || "",
          registrationNumber: receiptData.clientRegistrationNumber || "",
          vatNumber: receiptData.clientVatNumber || "",
        },
        receiptDate: receiptData.receiptDate instanceof Date ? receiptData.receiptDate.toISOString() : receiptData.receiptDate,
        currency,
        taxPercentage,
        subtotal,
        tax,
        total,
        language: receiptData.clientLanguage || "en",
      }

      const pdfBlob = await generateReceiptPDF(pdfData)
      downloadReceiptPDF(pdfBlob, buildDocumentFilename(pdfData, "receipt"))

      toast({ title: "PDF generated", description: "Your receipt PDF has been downloaded." })
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
          <DialogTitle>Receipt Preview</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-4 border rounded-md">
          <div className="bg-white p-8" id="receipt-content">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-1">RECEIPT</h1>
                <div className="text-muted-foreground">
                  <div>Receipt # {receiptData.receiptNumber}</div>
                  <div>Date: {receiptData.receiptDate ? formatDocumentDateBerlin(receiptData.receiptDate, "PP") : "N/A"}</div>
                  {receiptData.invoiceReference && <div>Invoice Ref: {receiptData.invoiceReference}</div>}
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
                <h2 className="text-lg font-semibold mb-2">Received From:</h2>
                <div>
                  <div className="font-medium">{receiptData.clientName || "Client Name"}</div>
                  {receiptData.clientAddress && (
                    <div className="text-muted-foreground">{receiptData.clientAddress}</div>
                  )}
                  {receiptData.clientPhone && <div className="text-muted-foreground">{receiptData.clientPhone}</div>}
                  {receiptData.clientEmail && <div className="text-muted-foreground">{receiptData.clientEmail}</div>}
                  {receiptData.clientEmail && <div className="text-muted-foreground">{receiptData.clientRegistrationNumber}</div>}
                  {receiptData.clientEmail && <div className="text-muted-foreground">{receiptData.clientVatNumber}</div>}
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-lg font-semibold mb-2">Payment Details:</h2>
                <div className="text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span>{getPaymentMethodText(receiptData.paymentMethod)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Payment Date:</span>
                    <span>{receiptData.receiptDate ? formatDocumentDateBerlin(receiptData.receiptDate, "PP") : "N/A"}</span>
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
                {(receiptData.items || []).map((item: any, index: number) => (
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
                      <span className="text-muted-foreground">Tax ({taxPercentage}%):</span>
                      <span>{fmtCurrency(calculateTax())}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total Paid:</span>
                      <span>{fmtCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {receiptData.notes && (
              <div className="mb-8">
                <h3 className="font-medium mb-2">Notes:</h3>
                <p className="text-sm text-muted-foreground">{receiptData.notes}</p>
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
