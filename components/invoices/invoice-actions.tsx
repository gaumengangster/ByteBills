"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import { doc, deleteDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  ArrowLeft,
  CloudUpload,
  Download,
  Edit,
  MoreHorizontal,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react"
import { generateInvoicePDF, downloadPDF } from "@/lib/pdf-service"
import { buildDocumentFilename } from "@/lib/document-filename"
import { ShareInvoiceDialog } from "./share-invoice-dialog"
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
import { driveDeleteOrphanWarning } from "@/lib/google-drive-delete-warning"
import {
  deleteGoogleDriveFile,
  getGoogleDriveAccessToken,
} from "@/lib/google-drive-upload-client"
import { isIssuedPdfOnDrive, uploadIssuedPdfToGoogleDrive } from "@/lib/google-drive-issued-pdf"

type InvoiceActionsProps = {
  invoice: any
  onStatusChange: (newStatus: string) => Promise<void>
  /** Called after a successful Google Drive upload so the detail view can refetch. */
  onInvoiceRefresh?: () => void | Promise<void>
  /** Live company list from settings — fills missing street address on PDFs when invoice snapshot is stale. */
  companies?: any[]
}

export function InvoiceActions({ invoice, onStatusChange, onInvoiceRefresh, companies }: InvoiceActionsProps) {
  const router = useRouter()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploadingDrive, setIsUploadingDrive] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const invoiceDeleteDriveWarning = useMemo(
    () =>
      driveDeleteOrphanWarning(
        !!(invoice.drivePdfFileId && typeof invoice.drivePdfFileId === "string"),
      ),
    [invoice.drivePdfFileId],
  )

  const handleDownloadPDF = async () => {
    setIsDownloading(true)

    try {
      const pdfBlob = await generateInvoicePDF(invoice, companies)
      downloadPDF(pdfBlob, buildDocumentFilename(invoice, "invoice"))

      toast({
        title: "PDF generated",
        description: "Your invoice PDF has been downloaded.",
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

  const handleUploadToGoogleDrive = async () => {
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
      const pdfBlob = await generateInvoicePDF(invoice, companies)
      const displayName = buildDocumentFilename(invoice, "invoice")
      const { fileId } = await uploadIssuedPdfToGoogleDrive(pdfBlob, displayName)
      await updateDoc(doc(db, "invoices", invoice.id), {
        drivePdfName: displayName,
        drivePdfFileId: fileId,
        updatedAt: new Date().toISOString(),
      })
      toast({
        title: "Uploaded to Google Drive",
        description: "The invoice PDF was saved to your Drive folder.",
      })
      await onInvoiceRefresh?.()
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

  const handleDelete = async () => {
    try {
      const token = getGoogleDriveAccessToken()
      const fid = invoice.drivePdfFileId
      if (fid && typeof fid === "string" && token) {
        try {
          await deleteGoogleDriveFile(fid)
        } catch (e) {
          console.warn("Google Drive delete:", e)
        }
      }
      await deleteDoc(doc(db, "invoices", invoice.id))

      toast({
        title: "Invoice deleted",
        description:
          fid && !token
            ? "The invoice was removed. Google Drive was not connected—the PDF was not deleted in Drive."
            : "The invoice has been deleted successfully.",
      })

      router.push("/invoices")
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/invoices")} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>

        <Button variant="outline" onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
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
          disabled={isUploadingDrive || isIssuedPdfOnDrive(invoice)}
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

        <Button variant="outline" onClick={() => setIsShareDialogOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onStatusChange("pending")} disabled={invoice.status === "pending"}>
              Mark as Pending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("paid")} disabled={invoice.status === "paid"}>
              Mark as Paid
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("overdue")} disabled={invoice.status === "overdue"}>
              Mark as Overdue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("cancelled")} disabled={invoice.status === "cancelled"}>
              Mark as Cancelled
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShareInvoiceDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                This removes the invoice and deletes the PDF from Google Drive when you are connected. This cannot be
                undone.
              </span>
              {invoiceDeleteDriveWarning ? (
                <span className="block rounded-md border border-amber-200 bg-amber-50 p-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {invoiceDeleteDriveWarning}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
