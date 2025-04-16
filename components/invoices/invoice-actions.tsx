"use client"

import { useState } from "react"
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
import { toast } from "sonner"
import { doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ArrowLeft, Download, Edit, MoreHorizontal, Send, Share2, Trash2 } from "lucide-react"
import { generateInvoicePDF, downloadPDF } from "@/lib/pdf-service"
import { EmailInvoiceDialog } from "./email-invoice-dialog"
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

type InvoiceActionsProps = {
  invoice: any
  userId: string
  onStatusChange: (newStatus: string) => Promise<void>
}

export function InvoiceActions({ invoice, userId, onStatusChange }: InvoiceActionsProps) {
  const router = useRouter()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDownloadPDF = async () => {
    setIsDownloading(true)

    try {
      const pdfBlob = await generateInvoicePDF(invoice.id)
      downloadPDF(pdfBlob, `Invoice-${invoice.invoiceNumber}.pdf`)

      toast( "PDF generated", {
        description: "Your invoice PDF has been downloaded.",
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast("Error", {
        description: "Failed to generate PDF. Please try again.",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "invoices", invoice.id))

      toast("Invoice deleted", {
        description: "The invoice has been deleted successfully.",
      })

      router.push("/invoices")
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast("Error", {
        description: "Failed to delete invoice. Please try again.",
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
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Generating..." : "Download PDF"}
        </Button>

        <Button variant="outline" onClick={() => setIsEmailDialogOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Send
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

      <EmailInvoiceDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        invoice={invoice}
        userId={userId}
      />

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
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice.
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
