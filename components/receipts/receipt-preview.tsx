"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Download, X } from "lucide-react"

type ReceiptPreviewProps = {
  isOpen: boolean
  onClose: () => void
  receiptData: any
  companies: any[]
  currency: string // Added currency prop
  taxPercentage: number // Added tax percentage prop
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

  // Find the selected company data
  const selectedCompany = companies.find((c) => c.id === receiptData.companyId) || companies[0]

  const formatCurrency = (amount: number) => {
    const currencyMap: Record<string, string> = {
      UGX: "UGX",
      USD: "USD",
      EUR: "EUR",
      GBP: "GBP",
      JPY: "JPY",
      AUD: "AUD",
      CAD: "CAD",
      CHF: "CHF",
      CNY: "CNY",
      INR: "INR",
      MXN: "MXN",
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyMap[currency] || "USD",
    }).format(amount)
  }

  // Calculate receipt totals
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

  const handleDownload = () => {
    setIsPdfLoading(true)

    // In a real implementation, this would generate and download the PDF
    // For this example, we'll just wait a second and then stop loading
    setTimeout(() => {
      setIsPdfLoading(false)
    }, 1000)
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
                  <div>Date: {receiptData.receiptDate ? format(new Date(receiptData.receiptDate), "PP") : "N/A"}</div>
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
                    <span>{receiptData.receiptDate ? format(new Date(receiptData.receiptDate), "PP") : "N/A"}</span>
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
                    <div className="col-span-2 text-right">{formatCurrency(item.unitPrice || 0)}</div>
                    <div className="col-span-3 text-right">
                      {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border rounded-b-md">
                <div className="p-4 flex justify-end">
                  <div className="w-1/3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({taxPercentage}%):</span>
                      <span>{formatCurrency(calculateTax())}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total Paid:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
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
