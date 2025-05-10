"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Download, Edit, Loader2 } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"

export default function DeliveryNoteDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [deliveryNote, setDeliveryNote] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch delivery note
  useEffect(() => {
    const fetchDeliveryNote = async () => {
      if (!user) return

      try {
        const docRef = doc(db, "deliveryNotes", params.id)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()

          // Check if this delivery note belongs to the current user
          if (data.userId !== user.uid) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to view this delivery note",
              variant: "destructive",
            })
            router.push("/delivery-notes")
            return
          }

          setDeliveryNote({
            id: docSnap.id,
            ...data,
          })
        } else {
          toast({
            title: "Not Found",
            description: "The requested delivery note could not be found",
            variant: "destructive",
          })
          router.push("/delivery-notes")
        }
      } catch (error) {
        console.error("Error fetching delivery note:", error)
        toast({
          title: "Error",
          description: "Failed to fetch delivery note. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDeliveryNote()
  }, [user, params.id, router])

  // Handle download
  const handleDownload = async () => {
    try {
      const pdfBlob = await generateDeliveryNotePDF(deliveryNote)
      downloadDeliveryNotePDF(pdfBlob, `delivery-note-${deliveryNote.deliveryNoteNumber}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!deliveryNote) {
    return null
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link href="/delivery-notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Delivery Note Details</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button asChild>
            <Link href={`/delivery-notes/${params.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-white shadow-md">
        <CardContent className="p-0">
          <div className="flex justify-between">
            <div>
              <h1 className="text-2xl font-bold">DELIVERY NOTE</h1>
              <p className="text-sm mt-2">Delivery Note #: {deliveryNote.deliveryNoteNumber}</p>
              <p className="text-sm">
                Date:{" "}
                {format(
                  new Date(
                    deliveryNote.deliveryDate.seconds
                      ? deliveryNote.deliveryDate.seconds * 1000
                      : deliveryNote.deliveryDate,
                  ),
                  "MMMM d, yyyy",
                )}
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
        </CardContent>
      </Card>
    </div>
  )
}
