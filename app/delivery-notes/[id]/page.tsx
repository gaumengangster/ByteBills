"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { doc, getDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { Calendar, Mail, Phone, User, ArrowLeft, Download, Edit, Trash2, Loader2 } from "lucide-react"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"
import { use } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [deliveryNote, setDeliveryNote] = useState<any>(null)
  const [loadingDeliveryNote, setLoadingDeliveryNote] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { id } = use(params)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDeliveryNote = async () => {
      if (!user) return

      try {
        const deliveryNoteDoc = await getDoc(doc(db, "deliveryNotes", id))

        if (!deliveryNoteDoc.exists()) {
          toast({
            title: "Delivery note not found",
            description: "The requested delivery note does not exist.",
            variant: "destructive",
          })
          router.push("/delivery-notes")
          return
        }

        const deliveryNoteData = {
          id: deliveryNoteDoc.id,
          userId: deliveryNoteDoc.data().userId,
          ...deliveryNoteDoc.data(),
        }

        // Check if the delivery note belongs to the current user
        if ((deliveryNoteData.userId as string) !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to view this delivery note.",
            variant: "destructive",
          })
          router.push("/delivery-notes")
          return
        }

        setDeliveryNote(deliveryNoteData)
      } catch (error) {
        console.error("Error fetching delivery note:", error)
        toast({
          title: "Error",
          description: "Failed to load delivery note. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingDeliveryNote(false)
      }
    }

    if (user && id) {
      fetchDeliveryNote()
    }
  }, [user, id, router])

  const handleDownloadPDF = async () => {
    setIsDownloading(true)

    try {
      const pdfBlob = await generateDeliveryNotePDF(deliveryNote)
      downloadDeliveryNotePDF(pdfBlob, `DeliveryNote-${deliveryNote.deliveryNoteNumber}.pdf`)

      toast({
        title: "PDF generated",
        description: "Your delivery note PDF has been downloaded.",
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "deliveryNotes", id))

      toast({
        title: "Delivery note deleted",
        description: "The delivery note has been deleted successfully.",
      })

      router.push("/delivery-notes")
    } catch (error) {
      console.error("Error deleting delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to delete delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  if (loading || loadingDeliveryNote) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!deliveryNote) {
    return <div className="flex min-h-screen items-center justify-center">Delivery note not found</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Delivery Note #{deliveryNote.deliveryNoteNumber}</h1>
            <div className="flex items-center mt-1">
              <span className="text-muted-foreground">
                {format(new Date(deliveryNote.deliveryDate), "MMMM d, yyyy")}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/delivery-notes")} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>

            <Button onClick={handleDownloadPDF} disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => router.push(`/delivery-notes/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>

            <Button variant="outline" onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Note Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-1">Delivery Note Number</h3>
                    <p>{deliveryNote.deliveryNoteNumber}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Delivery Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      {format(new Date(deliveryNote.deliveryDate), "MMMM d, yyyy")}
                    </div>
                  </div>
                  {deliveryNote.invoiceReference && (
                    <div>
                      <h3 className="font-medium mb-1">Invoice Reference</h3>
                      <p>{deliveryNote.invoiceReference}</p>
                    </div>
                  )}
                  {deliveryNote.orderReference && (
                    <div>
                      <h3 className="font-medium mb-1">Order Reference</h3>
                      <p>{deliveryNote.orderReference}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 p-4 font-medium bg-muted">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-4">Notes</div>
                  </div>

                  <div className="divide-y">
                    {deliveryNote.items.map((item: any, index: number) => (
                      <div key={index} className="grid grid-cols-12 gap-4 p-4">
                        <div className="col-span-6">{item.description}</div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-4">{item.notes || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {(deliveryNote.deliveryInstructions || deliveryNote.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deliveryNote.deliveryInstructions && (
                      <div>
                        <h3 className="font-medium mb-1">Delivery Instructions</h3>
                        <p className="text-muted-foreground">{deliveryNote.deliveryInstructions}</p>
                      </div>
                    )}
                    {deliveryNote.notes && (
                      <div>
                        <h3 className="font-medium mb-1">Notes</h3>
                        <p className="text-muted-foreground">{deliveryNote.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">{deliveryNote.clientDetails.name}</h3>
                      {deliveryNote.clientDetails.address && (
                        <p className="text-sm text-muted-foreground mt-1">{deliveryNote.clientDetails.address}</p>
                      )}
                    </div>
                  </div>

                  {deliveryNote.clientDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{deliveryNote.clientDetails.email}</span>
                    </div>
                  )}

                  {deliveryNote.clientDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{deliveryNote.clientDetails.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {deliveryNote.deliveryAddress && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{deliveryNote.deliveryAddress}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deliveryNote.companyDetails.logo && (
                    <img
                      src={deliveryNote.companyDetails.logo || "/placeholder.svg"}
                      alt={deliveryNote.companyDetails.name}
                      className="h-12 object-contain mb-2"
                    />
                  )}

                  <div>
                    <h3 className="font-medium">{deliveryNote.companyDetails.name}</h3>
                    {deliveryNote.companyDetails.address && (
                      <p className="text-sm text-muted-foreground mt-1">{deliveryNote.companyDetails.address}</p>
                    )}
                    {(deliveryNote.companyDetails.city || deliveryNote.companyDetails.country) && (
                      <p className="text-sm text-muted-foreground">
                        {deliveryNote.companyDetails.city}
                        {deliveryNote.companyDetails.city && deliveryNote.companyDetails.country && ", "}
                        {deliveryNote.companyDetails.country}
                      </p>
                    )}
                  </div>

                  {deliveryNote.companyDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{deliveryNote.companyDetails.email}</span>
                    </div>
                  )}

                  {deliveryNote.companyDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{deliveryNote.companyDetails.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the delivery note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
