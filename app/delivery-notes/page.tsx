"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Download, FileText, Loader2, Plus, Search, Trash2, Edit } from "lucide-react"
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { generateDeliveryNotePDF, downloadDeliveryNotePDF } from "@/lib/delivery-note-pdf-service"

export default function DeliveryNotesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [deliveryNotes, setDeliveryNotes] = useState<any[]>([])
  const [filteredDeliveryNotes, setFilteredDeliveryNotes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch delivery notes
  useEffect(() => {
    const fetchDeliveryNotes = async () => {
      if (!user) return

      try {
        const deliveryNotesRef = collection(db, "deliveryNotes")
        const q = query(deliveryNotesRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"))
        const querySnapshot = await getDocs(q)

        const deliveryNotesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setDeliveryNotes(deliveryNotesData)
        setFilteredDeliveryNotes(deliveryNotesData)
      } catch (error) {
        console.error("Error fetching delivery notes:", error)
        toast({
          title: "Error",
          description: "Failed to fetch delivery notes. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDeliveryNotes()
  }, [user])

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredDeliveryNotes(deliveryNotes)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = deliveryNotes.filter(
        (note) =>
          note.deliveryNoteNumber.toLowerCase().includes(query) ||
          note.clientDetails.name.toLowerCase().includes(query) ||
          (note.invoiceReference && note.invoiceReference.toLowerCase().includes(query)) ||
          (note.orderReference && note.orderReference.toLowerCase().includes(query)),
      )
      setFilteredDeliveryNotes(filtered)
    }
  }, [searchQuery, deliveryNotes])

  // Handle delete
  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)

    try {
      await deleteDoc(doc(db, "deliveryNotes", deleteId))

      setDeliveryNotes((prev) => prev.filter((note) => note.id !== deleteId))
      setFilteredDeliveryNotes((prev) => prev.filter((note) => note.id !== deleteId))

      toast({
        title: "Success",
        description: "Delivery note deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to delete delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  // Handle download
  const handleDownload = async (deliveryNote: any) => {
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Delivery Notes</h1>
        <Button asChild>
          <Link href="/delivery-notes/new">
            <Plus className="h-4 w-4 mr-2" /> New Delivery Note
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search delivery notes..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDeliveryNotes.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No delivery notes found</h3>
          <p className="text-muted-foreground mt-2">
            {searchQuery ? "Try a different search term" : "Create your first delivery note to get started"}
          </p>
          {!searchQuery && (
            <Button asChild className="mt-4">
              <Link href="/delivery-notes/new">
                <Plus className="h-4 w-4 mr-2" /> Create Delivery Note
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Note #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>References</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveryNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">
                    <Link href={`/delivery-notes/${note.id}`} className="hover:underline">
                      {note.deliveryNoteNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(note.deliveryDate.seconds ? note.deliveryDate.seconds * 1000 : note.deliveryDate),
                      "MMM d, yyyy",
                    )}
                  </TableCell>
                  <TableCell>{note.clientDetails.name}</TableCell>
                  <TableCell>
                    {note.invoiceReference && <div className="text-xs">Invoice: {note.invoiceReference}</div>}
                    {note.orderReference && <div className="text-xs">Order: {note.orderReference}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleDownload(note)} title="Download PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push(`/delivery-notes/${note.id}/edit`)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteId(note.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the delivery note. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
