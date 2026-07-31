"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
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
import { toast } from "@/components/ui/use-toast"
import {
  Download,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  CloudUpload,
  Share2,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { ShareInvoiceDialog } from "@/components/invoices/share-invoice-dialog"
import { generateInvoicePDF, downloadPDF } from "@/lib/pdf-service"
import { buildDocumentFilename } from "@/lib/document-filename"
import { isIssuedPdfOnDrive, uploadIssuedPdfToGoogleDrive } from "@/lib/google-drive-issued-pdf"
import { driveDeleteOrphanWarning } from "@/lib/google-drive-delete-warning"
import {
  deleteGoogleDriveFile,
  getGoogleDriveAccessToken,
} from "@/lib/google-drive-upload-client"
import { formatCurrency } from "@/lib/utils"
import {
  formatDocumentListDate,
  formatListEurAmount,
  listDocumentEurRow,
  normalizeListCurrency,
} from "@/lib/document-list-eur"
import { revenueDocNeedsFxSync, syncRevenueDocumentFx } from "@/lib/sync-revenue-document-fx"
import {
  DEFAULT_INVOICE_LIST_SORT_DIR,
  DEFAULT_INVOICE_LIST_SORT_KEY,
  INVOICE_LIST_SORT_OPTIONS,
  type InvoiceListSortDir,
  type InvoiceListSortKey,
  sortInvoiceList,
} from "@/lib/invoice-list-sort"

export default function InvoicesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<InvoiceListSortKey>(DEFAULT_INVOICE_LIST_SORT_KEY)
  const [sortDir, setSortDir] = useState<InvoiceListSortDir>(DEFAULT_INVOICE_LIST_SORT_DIR)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const invoiceDeleteDriveWarning = useMemo(() => {
    if (!invoiceToDelete) return null
    const inv = invoices.find((i) => i.id === invoiceToDelete)
    const hasLinked = !!(inv?.drivePdfFileId && typeof inv.drivePdfFileId === "string")
    return driveDeleteOrphanWarning(hasLinked)
  }, [invoiceToDelete, invoices])
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [uploadingDriveId, setUploadingDriveId] = useState<string | null>(null)
  const [syncingFxId, setSyncingFxId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, "bytebills-users", user.uid))
      .then((snap) => {
        if (snap.exists()) setCompanies(snap.data().companies ?? [])
      })
      .catch(() => setCompanies([]))
  }, [user])

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user) return

      try {
        const q = query(collection(db, "invoices"), where("userId", "==", user.uid))

        const querySnapshot = await getDocs(q)
        const invoiceData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setInvoices(invoiceData)
        setFilteredInvoices(invoiceData)
      } catch (error) {
        console.error("Error fetching invoices:", error)
      } finally {
        setLoadingInvoices(false)
      }
    }

    if (user) {
      fetchInvoices()
    }
  }, [user])

  useEffect(() => {
    // Apply filters
    let result = [...invoices]

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((invoice) => invoice.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.clientDetails.name.toLowerCase().includes(query) ||
          (invoice.clientDetails.email && invoice.clientDetails.email.toLowerCase().includes(query)),
      )
    }

    result = sortInvoiceList(result, sortKey, sortDir)

    setFilteredInvoices(result)
  }, [invoices, statusFilter, searchQuery, sortKey, sortDir])

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const invoiceRef = doc(db, "invoices", invoiceId)
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setInvoices(
        invoices.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, status: newStatus, updatedAt: new Date().toISOString() } : invoice,
        ),
      )

      toast({
        title: "Status updated",
        description: `Invoice status has been updated to ${newStatus}.`,
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update invoice status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const confirmDelete = (invoiceId: string) => {
    setInvoiceToDelete(invoiceId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!invoiceToDelete) return

    const inv = invoices.find((i) => i.id === invoiceToDelete)
    const token = getGoogleDriveAccessToken()
    const fid = inv?.drivePdfFileId && typeof inv.drivePdfFileId === "string" ? inv.drivePdfFileId : null

    try {
      if (fid && token) {
        try {
          await deleteGoogleDriveFile(fid)
        } catch (e) {
          console.warn("Google Drive delete:", e)
        }
      }
      await deleteDoc(doc(db, "invoices", invoiceToDelete))

      // Update local state
      setInvoices(invoices.filter((invoice) => invoice.id !== invoiceToDelete))

      toast({
        title: "Invoice deleted",
        description:
          fid && !token
            ? "Invoice removed. Google Drive was not connected—the PDF was not deleted in Drive."
            : "The invoice has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setInvoiceToDelete(null)
    }
  }

  const handleDownloadPDF = async (invoice: any) => {
    setIsDownloading(invoice.id)

    try {
      // Generate PDF directly using our new approach
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
      setIsDownloading(null)
    }
  }

  const handleUploadToGoogleDrive = async (invoice: any) => {
    if (!getGoogleDriveAccessToken()) {
      toast({
        title: "Connect Google Drive",
        description: "Use Connect Google Drive in the header, then upload again.",
        variant: "destructive",
      })
      return
    }
    setUploadingDriveId(invoice.id)
    try {
      const pdfBlob = await generateInvoicePDF(invoice, companies)
      const displayName = buildDocumentFilename(invoice, "invoice")
      const { fileId } = await uploadIssuedPdfToGoogleDrive(pdfBlob, displayName)
      const updatedAt = new Date().toISOString()
      await updateDoc(doc(db, "invoices", invoice.id), {
        drivePdfName: displayName,
        drivePdfFileId: fileId,
        uploadedToDrive: true,
        updatedAt,
      })
      setInvoices(
        invoices.map((i) =>
          i.id === invoice.id
            ? { ...i, drivePdfName: displayName, drivePdfFileId: fileId, uploadedToDrive: true, updatedAt }
            : i,
        ),
      )
      toast({
        title: "Uploaded to Google Drive",
        description: "The invoice PDF was saved to your Drive folder.",
      })
    } catch (error) {
      console.error("Google Drive upload:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload to Google Drive.",
        variant: "destructive",
      })
    } finally {
      setUploadingDriveId(null)
    }
  }

  const openShareDialog = (invoice: any) => {
    setSelectedInvoice(invoice)
    setIsShareDialogOpen(true)
  }

  const handleSyncExchangeRate = async (invoice: any) => {
    if (!user) return
    setSyncingFxId(invoice.id)
    try {
      const result = await syncRevenueDocumentFx({
        db,
        userId: user.uid,
        collection: "invoices",
        docId: invoice.id,
      })
      if (!result.ok) {
        if (result.reason === "missing_fx") {
          toast({
            title: "Missing exchange rate",
            description:
              "Import the BMF CSV for this document’s month on Exchange rates, then try again.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Sync failed",
            description: "Could not update EUR amounts.",
            variant: "destructive",
          })
        }
        return
      }
      if (result.skipped) {
        toast({
          title: "Already synced",
          description: "EUR amounts are already set for this invoice.",
        })
        return
      }
      const snap = await getDoc(doc(db, "invoices", invoice.id))
      if (snap.exists()) {
        const next = { id: snap.id, ...snap.data() }
        setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? next : i)))
      }
      toast({ title: "Synced", description: "EUR amounts were updated from BMF rates." })
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: "Sync failed unexpectedly.", variant: "destructive" })
    } finally {
      setSyncingFxId(null)
    }
  }

  const hasNonEurInView = filteredInvoices.some(
    (inv) => normalizeListCurrency(inv.currency) !== "EUR",
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500">Paid</Badge>
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>
      case "overdue":
        return <Badge className="bg-red-500">Overdue</Badge>
      case "cancelled":
        return <Badge className="bg-gray-500">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Manage your invoices and track payments</p>
          </div>

          <Button onClick={() => router.push("/invoices/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter, search, and sort your invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by invoice number or client..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="w-full md:w-[200px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:flex-1 sm:max-w-[220px]">
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as InvoiceListSortKey)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_LIST_SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-[180px]">
                  <Select value={sortDir} onValueChange={(v) => setSortDir(v as InvoiceListSortDir)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadingInvoices ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No invoices found</h3>
            <p className="text-muted-foreground mb-4">
              {invoices.length === 0
                ? "You haven't created any invoices yet."
                : "No invoices match your current filters."}
            </p>
            {invoices.length === 0 && (
              <Button onClick={() => router.push("/invoices/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Invoice
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                  <TableHead className="min-w-[10rem] max-w-[16rem]">Client</TableHead>
                  <TableHead className="whitespace-nowrap">Date created</TableHead>
                  <TableHead className="whitespace-nowrap">Invoice date</TableHead>
                  <TableHead className="whitespace-nowrap" title="Leistungsdatum (supply date for VAT)">
                    VAT date
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Due date</TableHead>
                  <TableHead>Amount</TableHead>
                  {hasNonEurInView ? (
                    <TableHead className="text-right whitespace-nowrap">FX rate</TableHead>
                  ) : null}
                  <TableHead className="text-right whitespace-nowrap">EUR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const eurRow = listDocumentEurRow(invoice, "invoice")
                  return (
                  <TableRow key={invoice.id}>
                    <TableCell className="whitespace-nowrap font-medium tabular-nums align-top">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="min-w-0 max-w-[16rem] align-top">
                      <div
                        className="truncate font-medium"
                        title={invoice.clientDetails.name}
                      >
                        {invoice.clientDetails.name}
                      </div>
                      {invoice.clientDetails.email && (
                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={invoice.clientDetails.email}
                        >
                          {invoice.clientDetails.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDocumentListDate(invoice.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDocumentListDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDocumentListDate(invoice.taxDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDocumentListDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.total, invoice)}</TableCell>
                    {hasNonEurInView ? (
                      <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                        {eurRow.rateLabel}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">{formatListEurAmount(eurRow.eur)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${invoice.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(invoice)}
                            disabled={isDownloading === invoice.id}
                          >
                            {isDownloading === invoice.id ? (
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
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleUploadToGoogleDrive(invoice)}
                            disabled={uploadingDriveId === invoice.id || isIssuedPdfOnDrive(invoice)}
                          >
                            {uploadingDriveId === invoice.id ? (
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
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openShareDialog(invoice)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          {revenueDocNeedsFxSync(invoice as Record<string, unknown>) ? (
                            <DropdownMenuItem
                              onClick={() => void handleSyncExchangeRate(invoice)}
                              disabled={syncingFxId === invoice.id}
                            >
                              {syncingFxId === invoice.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Syncing…
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Sync exchange rate
                                </>
                              )}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(invoice.id, "pending")}
                            disabled={invoice.status === "pending"}
                          >
                            Mark as Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(invoice.id, "paid")}
                            disabled={invoice.status === "paid"}
                          >
                            Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(invoice.id, "overdue")}
                            disabled={invoice.status === "overdue"}
                          >
                            Mark as Overdue
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(invoice.id, "cancelled")}
                            disabled={invoice.status === "cancelled"}
                          >
                            Mark as Cancelled
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => confirmDelete(invoice.id)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

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
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedInvoice && (
        <ShareInvoiceDialog
          isOpen={isShareDialogOpen}
          onClose={() => setIsShareDialogOpen(false)}
          invoiceId={selectedInvoice.id}
          invoiceNumber={selectedInvoice.invoiceNumber}
        />
      )}
    </>
  )
}
