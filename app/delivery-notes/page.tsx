"use client"

import { useEffect, useState } from "react"
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
import { collection, query, where, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
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
import { Download, Edit, Eye, FileText, MoreHorizontal, Plus, Search, Trash2, Loader2 } from "lucide-react"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"

export default function DeliveryNotesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])
  const [filteredDeliveryNotes, setFilteredDeliveryNotes] = useState<any[]>([])
  const [loadingDeliveryNotes, setLoadingDeliveryNotes] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [referenceFilter, setReferenceFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deliveryNoteToDelete, setDeliveryNoteToDelete] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDeliveryNotes = async () => {
      if (!user) return

      try {
        const q = query(collection(db, "deliveryNotes"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))

        const querySnapshot = await getDocs(q)
        const deliveryNoteData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setDeliveryNotes(deliveryNoteData)
        setFilteredDeliveryNotes(deliveryNoteData)
      } catch (error) {
        console.error("Error fetching delivery notes:", error)
      } finally {
        setLoadingDeliveryNotes(false)
      }
    }

    if (user) {
      fetchDeliveryNotes()
    }
  }, [user])

  useEffect(() => {
    // Apply filters
    let result = [...deliveryNotes]

    // Filter by reference type
    if (referenceFilter === "invoice") {
      result = result.filter((note) => note.invoiceReference && note.invoiceReference.trim() !== "")
    } else if (referenceFilter === "order") {
      result = result.filter((note) => note.orderReference && note.orderReference.trim() !== "")
    } else if (referenceFilter === "none") {
      result = result.filter(
        (note) =>
          (!note.invoiceReference || note.invoiceReference.trim() === "") &&
          (!note.orderReference || note.orderReference.trim() === ""),
      )
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (note) =>
          note.deliveryNoteNumber.toLowerCase().includes(query) ||
          note.clientDetails.name.toLowerCase().includes(query) ||
          (note.clientDetails.email && note.clientDetails.email.toLowerCase().includes(query)) ||
          (note.invoiceReference && note.invoiceReference.toLowerCase().includes(query)) ||
          (note.orderReference && note.orderReference.toLowerCase().includes(query)),
      )
    }

    setFilteredDeliveryNotes(result)
  }, [deliveryNotes, referenceFilter, searchQuery])

  const confirmDelete = (deliveryNoteId: string) => {
    setDeliveryNoteToDelete(deliveryNoteId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deliveryNoteToDelete) return

    try {
      await deleteDoc(doc(db, "deliveryNotes", deliveryNoteToDelete))

      // Update local state
      setDeliveryNotes(deliveryNotes.filter((note) => note.id !== deliveryNoteToDelete))

      toast({
        title: "Delivery note deleted",
        description: "The delivery note has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to delete delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setDeliveryNoteToDelete(null)
    }
  }

  const handleDownloadPDF = async (deliveryNote: any) => {
    setIsDownloading(deliveryNote.id)

    try {
      // Generate PDF directly
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
      setIsDownloading(null)
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
            <h1 className="text-3xl font-bold">Delivery Notes</h1>
            <p className="text-muted-foreground">Manage your delivery notes and shipment records</p>
          </div>

          <Button onClick={() => router.push("/delivery-notes/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Delivery Note
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter and search your delivery notes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by delivery note number, client, or reference..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full md:w-[200px]">
                <Select value={referenceFilter} onValueChange={setReferenceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by reference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All References</SelectItem>
                    <SelectItem value="invoice">Has Invoice Reference</SelectItem>
                    <SelectItem value="order">Has Order Reference</SelectItem>
                    <SelectItem value="none">No References</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadingDeliveryNotes ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading delivery notes...</p>
          </div>
        ) : filteredDeliveryNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No delivery notes found</h3>
            <p className="text-muted-foreground mb-4">
              {deliveryNotes.length === 0
                ? "You haven't created any delivery notes yet."
                : "No delivery notes match your current filters."}
            </p>
            {deliveryNotes.length === 0 && (
              <Button onClick={() => router.push("/delivery-notes/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Delivery Note
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery Note #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveryNotes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell className="font-medium">{note.deliveryNoteNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div>{note.clientDetails.name}</div>
                        {note.clientDetails.email && (
                          <div className="text-xs text-muted-foreground">{note.clientDetails.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(note.deliveryDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {note.invoiceReference && <div className="text-xs">Invoice: {note.invoiceReference}</div>}
                      {note.orderReference && <div className="text-xs">Order: {note.orderReference}</div>}
                      {!note.invoiceReference && !note.orderReference && <div className="text-xs">-</div>}
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => router.push(`/delivery-notes/${note.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(note)}
                            disabled={isDownloading === note.id}
                          >
                            {isDownloading === note.id ? (
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
                          <DropdownMenuItem onClick={() => router.push(`/delivery-notes/${note.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => confirmDelete(note.id)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
