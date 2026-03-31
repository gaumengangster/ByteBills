"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatDocumentDateBerlin } from "@/lib/document-date-berlin"
import {
  Calendar,
  Mail,
  Phone,
  User,
  ArrowLeft,
  CloudUpload,
  Download,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react"
import { generateReceiptPDF, downloadReceiptPDF } from "@/lib/receipt-pdf-service"
import { buildDocumentFilename } from "@/lib/document-filename"
import { isIssuedPdfOnDrive, uploadIssuedPdfToGoogleDrive } from "@/lib/google-drive-issued-pdf"
import { driveDeleteOrphanWarning } from "@/lib/google-drive-delete-warning"
import {
  deleteGoogleDriveFile,
  getGoogleDriveAccessToken,
} from "@/lib/google-drive-upload-client"
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

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [receipt, setReceipt] = useState<any>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploadingDrive, setIsUploadingDrive] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { id } = use(params)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!user) return

      try {
        const receiptDoc = await getDoc(doc(db, "receipts", id))

        if (!receiptDoc.exists()) {
          toast({
            title: "Receipt not found",
            description: "The requested receipt does not exist.",
            variant: "destructive",
          })
          router.push("/receipts")
          return
        }

        const receiptData = {
          id: receiptDoc.id,
          userId: receiptDoc.data().userId,
          ...receiptDoc.data(),
        }

        // Check if the receipt belongs to the current user
        if ((receiptData.userId as string) !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to view this receipt.",
            variant: "destructive",
          })
          router.push("/receipts")
          return
        }

        setReceipt(receiptData)
      } catch (error) {
        console.error("Error fetching receipt:", error)
        toast({
          title: "Error",
          description: "Failed to load receipt. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingReceipt(false)
      }
    }

    if (user && id) {
      fetchReceipt()
    }
  }, [user, id, router])

  const receiptDriveDeleteWarning = useMemo(
    () =>
      receipt
        ? driveDeleteOrphanWarning(
            !!(receipt.drivePdfFileId && typeof receipt.drivePdfFileId === "string"),
          )
        : null,
    [receipt],
  )

  const refreshReceipt = async () => {
    if (!user || !id) return
    try {
      const receiptDoc = await getDoc(doc(db, "receipts", id))
      if (!receiptDoc.exists()) return
      setReceipt({
        id: receiptDoc.id,
        userId: receiptDoc.data().userId,
        ...receiptDoc.data(),
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleUploadToGoogleDrive = async () => {
    if (!receipt) return
    if (!getGoogleDriveAccessToken()) {
      toast({
        title: "Connect Google Drive",
        description: "Use Connect Google Drive in the header, then try again.",
        variant: "destructive",
      })
      return
    }
    setIsUploadingDrive(true)
    try {
      const pdfBlob = await generateReceiptPDF(receipt)
      const displayName = buildDocumentFilename(receipt, "receipt")
      const { fileId } = await uploadIssuedPdfToGoogleDrive(pdfBlob, displayName)
      await updateDoc(doc(db, "receipts", id), {
        drivePdfName: displayName,
        drivePdfFileId: fileId,
        uploadedToDrive: true,
        updatedAt: new Date().toISOString(),
      })
      toast({
        title: "Uploaded to Google Drive",
        description: "The receipt PDF was saved to your Drive folder.",
      })
      await refreshReceipt()
    } catch (error) {
      console.error("Google Drive upload:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload to Google Drive.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingDrive(false)
    }
  }

  const handleDownloadPDF = async () => {
    setIsDownloading(true)

    try {
      const pdfBlob = await generateReceiptPDF(receipt)
      downloadReceiptPDF(pdfBlob, buildDocumentFilename(receipt, "receipt"))

      toast({
        title: "PDF generated",
        description: "Your receipt PDF has been downloaded.",
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
    if (!receipt) return
    try {
      const token = getGoogleDriveAccessToken()
      const fid = receipt.drivePdfFileId && typeof receipt.drivePdfFileId === "string" ? receipt.drivePdfFileId : null
      if (fid && token) {
        try {
          await deleteGoogleDriveFile(fid)
        } catch (e) {
          console.warn("Google Drive delete:", e)
        }
      }
      await deleteDoc(doc(db, "receipts", id))

      toast({
        title: "Receipt deleted",
        description:
          fid && !token
            ? "Receipt removed. Google Drive was not connected—the PDF was not deleted in Drive."
            : "The receipt has been deleted successfully.",
      })

      router.push("/receipts")
    } catch (error) {
      console.error("Error deleting receipt:", error)
      toast({
        title: "Error",
        description: "Failed to delete receipt. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  const getPaymentMethodText = (method: string) => {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  if (loading || loadingReceipt) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!receipt) {
    return <div className="flex min-h-screen items-center justify-center">Receipt not found</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Receipt #{receipt.receiptNumber}</h1>
            <div className="flex items-center mt-1">
              <span className="text-muted-foreground">{formatDocumentDateBerlin(receipt.receiptDate, "MMMM d, yyyy")}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/receipts")} className="mr-2">
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

            <Button
              variant="outline"
              onClick={() => void handleUploadToGoogleDrive()}
              disabled={isUploadingDrive || (receipt ? isIssuedPdfOnDrive(receipt) : false)}
            >
              {isUploadingDrive ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Upload to Drive
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => router.push(`/receipts/${id}/edit`)}>
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
                <CardTitle>Receipt Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-1">Receipt Number</h3>
                    <p>{receipt.receiptNumber}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Receipt Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      {formatDocumentDateBerlin(receipt.receiptDate, "MMMM d, yyyy")}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Payment Method</h3>
                    <p>{getPaymentMethodText(receipt.paymentMethod)}</p>
                  </div>
                  {receipt.invoiceReference && (
                    <div>
                      <h3 className="font-medium mb-1">Invoice reference</h3>
                      {receipt.invoiceRef ? (
                        <Link
                          href={`/invoices/${receipt.invoiceRef}`}
                          className="text-primary hover:underline"
                        >
                          {receipt.invoiceReference}
                        </Link>
                      ) : (
                        <p>{receipt.invoiceReference}</p>
                      )}
                    </div>
                  )}
                  {receipt.invoiceRef && !receipt.invoiceReference && (
                    <div>
                      <h3 className="font-medium mb-1">Linked invoice</h3>
                      <Link href={`/invoices/${receipt.invoiceRef}`} className="text-primary hover:underline">
                        View invoice
                      </Link>
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
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-3 text-right">Amount</div>
                  </div>

                  <div className="divide-y">
                    {receipt.items.map((item: any, index: number) => (
                      <div key={index} className="grid grid-cols-12 gap-4 p-4">
                        <div className="col-span-5">{item.description}</div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item.unitPrice)}</div>
                        <div className="col-span-3 text-right">{formatCurrency(item.quantity * item.unitPrice)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-muted/50">
                    <div className="flex justify-end">
                      <div className="w-1/3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{formatCurrency(receipt.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax:</span>
                          <span>{formatCurrency(receipt.tax)}</span>
                        </div>
                        <div className="flex justify-between font-medium pt-2 border-t">
                          <span>Total Paid:</span>
                          <span>{formatCurrency(receipt.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {receipt.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">Notes</h3>
                      <p className="text-muted-foreground">{receipt.notes}</p>
                    </div>
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
                      <h3 className="font-medium">{receipt.clientDetails.name}</h3>
                      {receipt.clientDetails.address && (
                        <p className="text-sm text-muted-foreground mt-1">{receipt.clientDetails.address}</p>
                      )}
                    </div>
                  </div>

                  {receipt.clientDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{receipt.clientDetails.email}</span>
                    </div>
                  )}

                  {receipt.clientDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{receipt.clientDetails.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {receipt.companyDetails.logo && (
                    <img
                      src={receipt.companyDetails.logo || "/placeholder.svg"}
                      alt={receipt.companyDetails.name}
                      className="h-12 object-contain mb-2"
                    />
                  )}

                  <div>
                    <h3 className="font-medium">{receipt.companyDetails.name}</h3>
                    {receipt.companyDetails.address && (
                      <p className="text-sm text-muted-foreground mt-1">{receipt.companyDetails.address}</p>
                    )}
                    {(receipt.companyDetails.city || receipt.companyDetails.country) && (
                      <p className="text-sm text-muted-foreground">
                        {receipt.companyDetails.city}
                        {receipt.companyDetails.city && receipt.companyDetails.country && ", "}
                        {receipt.companyDetails.country}
                      </p>
                    )}
                  </div>

                  {receipt.companyDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{receipt.companyDetails.email}</span>
                    </div>
                  )}

                  {receipt.companyDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{receipt.companyDetails.phone}</span>
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
            <AlertDialogDescription className="space-y-2">
              <span>
                This removes the receipt and deletes the PDF from Google Drive when you are connected. This cannot be
                undone.
              </span>
              {receiptDriveDeleteWarning ? (
                <span className="block rounded-md border border-amber-200 bg-amber-50 p-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {receiptDriveDeleteWarning}
                </span>
              ) : null}
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
