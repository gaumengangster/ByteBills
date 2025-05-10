"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Download, X } from "lucide-react"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"

type DeliveryNotePreviewProps = {
  isOpen: boolean
  onClose: () => void
  deliveryNoteData: any
  companies: any[]
}

export function DeliveryNotePreview({ isOpen, onClose, deliveryNoteData, companies }: DeliveryNotePreviewProps) {
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  // Find the selected company data
  const selectedCompany = companies.find((c) => c.id === deliveryNoteData.companyId) || companies[0]

  const handleDownload = async () => {
    setIsPdfLoading(true)

    try {
      // Prepare the data for PDF generation
      const pdfData = {
        ...deliveryNoteData,
        companyDetails: {
          name: selectedCompany?.name || "",
          address: selectedCompany?.businessDetails?.address || "",
          city: selectedCompany?.businessDetails?.city || "",
          country: selectedCompany?.businessDetails?.country || "",
          email: selectedCompany?.businessDetails?.email || "",
          phone: selectedCompany?.businessDetails?.phone || "",
        },
        clientDetails: {
          name: deliveryNoteData.clientName,
          address: deliveryNoteData.clientAddress || "",
          email: deliveryNoteData.clientEmail || "",
          phone: deliveryNoteData.clientPhone || "",
        },
      }

      const pdfBlob = await generateDeliveryNotePDF(pdfData)
      downloadDeliveryNotePDF(pdfBlob, `delivery-note-${deliveryNoteData.deliveryNoteNumber}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Delivery Note Preview</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-4 border rounded-md">
          <div className="bg-white p-8" id="delivery-note-content">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-1">DELIVERY NOTE</h1>
                <div className="text-muted-foreground">
                  <div>Delivery Note # {deliveryNoteData.deliveryNoteNumber}</div>
                  <div>
                    Date:{" "}
                    {deliveryNoteData.deliveryDate ? format(new Date(deliveryNoteData.deliveryDate), "PP") : "N/A"}
                  </div>
                  {deliveryNoteData.invoiceReference && <div>Invoice Ref: {deliveryNoteData.invoiceReference}</div>}
                  {deliveryNoteData.orderReference && <div>Order Ref: {deliveryNoteData.orderReference}</div>}
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
                <h2 className="text-lg font-semibold mb-2">Deliver To:</h2>
                <div>
                  <div className="font-medium">{deliveryNoteData.clientName || "Client Name"}</div>
                  {deliveryNoteData.clientAddress && (
                    <div className="text-muted-foreground">{deliveryNoteData.clientAddress}</div>
                  )}
                  {deliveryNoteData.clientPhone && (
                    <div className="text-muted-foreground">{deliveryNoteData.clientPhone}</div>
                  )}
                  {deliveryNoteData.clientEmail && (
                    <div className="text-muted-foreground">{deliveryNoteData.clientEmail}</div>
                  )}
                </div>
              </div>

              {deliveryNoteData.deliveryAddress && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Delivery Address:</h2>
                  <div className="text-muted-foreground">{deliveryNoteData.deliveryAddress}</div>
                </div>
              )}
            </div>

            <div className="mb-8">
              <div className="bg-muted rounded-t-md overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 font-medium">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-4">Notes</div>
                </div>
              </div>

              <div className="divide-y border-x">
                {(deliveryNoteData.items || []).map((item: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-4 p-4">
                    <div className="col-span-6">{item.description || "Item Description"}</div>
                    <div className="col-span-2 text-center">{item.quantity || 0}</div>
                    <div className="col-span-4">{item.notes || ""}</div>
                  </div>
                ))}
              </div>
            </div>

            {(deliveryNoteData.deliveryInstructions || deliveryNoteData.notes) && (
              <div className="space-y-4 mb-8">
                {deliveryNoteData.deliveryInstructions && (
                  <div>
                    <h3 className="font-medium mb-2">Delivery Instructions:</h3>
                    <p className="text-sm text-muted-foreground">{deliveryNoteData.deliveryInstructions}</p>
                  </div>
                )}

                {deliveryNoteData.notes && (
                  <div>
                    <h3 className="font-medium mb-2">Notes:</h3>
                    <p className="text-sm text-muted-foreground">{deliveryNoteData.notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-8 mt-8 pt-8 border-t">
              <div>
                <h3 className="font-medium mb-2">Delivered By:</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name: ____________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Signature: ________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date: ____________________</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Received By:</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name: ____________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Signature: ________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date: ____________________</p>
                  </div>
                </div>
              </div>
            </div>

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
