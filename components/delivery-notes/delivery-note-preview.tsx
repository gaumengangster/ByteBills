"use client"

import { format } from "date-fns"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"

interface DeliveryNotePreviewProps {
  deliveryNote: any
}

export function DeliveryNotePreview({ deliveryNote }: DeliveryNotePreviewProps) {
  const handleDownload = async () => {
    try {
      const pdfBlob = await generateDeliveryNotePDF(deliveryNote)
      downloadDeliveryNotePDF(pdfBlob, `delivery-note-${deliveryNote.deliveryNoteNumber}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleDownload} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <Card className="p-8 bg-white shadow-md">
        <div className="flex justify-between">
          <div>
            <h1 className="text-2xl font-bold">DELIVERY NOTE</h1>
            <p className="text-sm mt-2">Delivery Note #: {deliveryNote.deliveryNoteNumber}</p>
            <p className="text-sm">
              Date: {deliveryNote.deliveryDate ? format(new Date(deliveryNote.deliveryDate), "MMMM d, yyyy") : ""}
            </p>
            {deliveryNote.invoiceReference && (
              <p className="text-sm">Invoice Reference: {deliveryNote.invoiceReference}</p>
            )}
            {deliveryNote.orderReference && <p className="text-sm">Order Reference: {deliveryNote.orderReference}</p>}
          </div>

          <div className="text-right">
            <h2 className="font-bold">{deliveryNote.companyDetails?.name}</h2>
            {deliveryNote.companyDetails?.address && <p className="text-sm">{deliveryNote.companyDetails.address}</p>}
            {(deliveryNote.companyDetails?.city || deliveryNote.companyDetails?.country) && (
              <p className="text-sm">
                {[deliveryNote.companyDetails.city, deliveryNote.companyDetails.country].filter(Boolean).join(", ")}
              </p>
            )}
            {deliveryNote.companyDetails?.phone && (
              <p className="text-sm">Phone: {deliveryNote.companyDetails.phone}</p>
            )}
            {deliveryNote.companyDetails?.email && (
              <p className="text-sm">Email: {deliveryNote.companyDetails.email}</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-bold">Deliver To:</h3>
          <p>{deliveryNote.clientDetails?.name}</p>
          {deliveryNote.clientDetails?.address && <p className="text-sm">{deliveryNote.clientDetails.address}</p>}
          {(deliveryNote.clientDetails?.city || deliveryNote.clientDetails?.country) && (
            <p className="text-sm">
              {[deliveryNote.clientDetails.city, deliveryNote.clientDetails.country].filter(Boolean).join(", ")}
            </p>
          )}
          {deliveryNote.clientDetails?.phone && <p className="text-sm">Phone: {deliveryNote.clientDetails.phone}</p>}
          {deliveryNote.clientDetails?.email && <p className="text-sm">Email: {deliveryNote.clientDetails.email}</p>}
        </div>

        {deliveryNote.deliveryAddress && deliveryNote.deliveryAddress !== deliveryNote.clientDetails?.address && (
          <div className="mt-4">
            <h3 className="font-bold">Delivery Address:</h3>
            <p className="text-sm">{deliveryNote.deliveryAddress}</p>
          </div>
        )}

        <div className="mt-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Description</th>
                <th className="border p-2 text-center">Quantity</th>
                <th className="border p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {deliveryNote.items?.map((item: any, index: number) => (
                <tr key={index} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="border p-2">{item.description}</td>
                  <td className="border p-2 text-center">{item.quantity}</td>
                  <td className="border p-2">{item.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deliveryNote.deliveryInstructions && (
          <div className="mt-6">
            <h3 className="font-bold">Delivery Instructions:</h3>
            <p className="text-sm mt-1">{deliveryNote.deliveryInstructions}</p>
          </div>
        )}

        {deliveryNote.notes && (
          <div className="mt-6">
            <h3 className="font-bold">Notes:</h3>
            <p className="text-sm mt-1">{deliveryNote.notes}</p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold">Delivered By:</h3>
            <div className="mt-2">
              <p className="mb-2">Name: ____________________</p>
              <p className="mb-2">Signature: ________________</p>
              <p>Date: ____________________</p>
            </div>
          </div>
          <div>
            <h3 className="font-bold">Received By:</h3>
            <div className="mt-2">
              <p className="mb-2">Name: ____________________</p>
              <p className="mb-2">Signature: ________________</p>
              <p>Date: ____________________</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm italic">Thank you for your business!</div>
      </Card>
    </div>
  )
}
