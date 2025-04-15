"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore"
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
import { Download, Edit, Eye, FileText, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'

export default function ReceiptsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [receipts, setReceipts] = useState<any[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<any[]>([])
  const [loadingReceipts, setLoadingReceipts] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null)
  
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])
  
  useEffect(() => {
    const fetchReceipts = async () => {
      if (!user) return
      
      try {
        const q = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        )
        
        const querySnapshot = await getDocs(q)
        const receiptData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        setReceipts(receiptData)
        setFilteredReceipts(receiptData)
      } catch (error) {
        console.error("Error fetching receipts:", error)
      } finally {
        setLoadingReceipts(false)
      }
    }
    
    if (user) {
      fetchReceipts()
    }
  }, [user])
  
  useEffect(() => {
    // Apply filters
    let result = [...receipts]
    
    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter(receipt => receipt.status === statusFilter)
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(receipt => 
        receipt.receiptNumber.toLowerCase().includes(query) ||
        receipt.clientDetails.name.toLowerCase().includes(query) ||
        (receipt.clientDetails.email && receipt.clientDetails.email.toLowerCase().includes(query))
      )
    }
    
    setFilteredReceipts(result)
  }, [receipts, statusFilter, searchQuery])
  
  const handleStatusChange = async (receiptId: string, newStatus: string) => {
    try {
      const receiptRef = doc(db, "receipts", receiptId)
      await updateDoc(receiptRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
      
      // Update local state
      setReceipts(receipts.map(receipt => 
        receipt.id === receiptId 
          ? { ...receipt, status: newStatus, updatedAt: new Date().toISOString() } 
          : receipt
      ))
      
      toast({
        title: "Status updated",
        description: `Receipt status has been updated to ${newStatus}.`,
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update receipt status. Please try again.",
        variant: "destructive"
      })
    }
  }
  
  const confirmDelete = (receiptId: string) => {
    setReceiptToDelete(receiptId)
    setDeleteDialogOpen(true)
  }
  
  const handleDelete = async () => {
    if (!receiptToDelete) return
    
    try {
      await deleteDoc(doc(db, "receipts", receiptToDelete))
      
      // Update local state
      setReceipts(receipts.filter(receipt => receipt.id !== receiptToDelete))
      
      toast({
        title: "Receipt deleted",
        description: "The receipt has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting receipt:", error)
      toast({
        title: "Error",
        description: "Failed to delete receipt. Please try again.",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setReceiptToDelete(null)
    }
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      case "void":
        return <Badge className="bg-gray-500">Void</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
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
            <h1 className="text-3xl font-bold">Receipts</h1>
            <p className="text-muted-foreground">
              Manage your receipts and payment records
            </p>
          </div>
          
          <Button onClick={() => router.push("/receipts/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Receipt
          </Button>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter and search your receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by receipt number or client..."
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
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {loadingReceipts ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading receipts...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No receipts found</h3>
            <p className="text-muted-foreground mb-4">
              {receipts.length === 0 
                ? "You haven't created any receipts yet." 
                : "No receipts match your current filters."}
            </p>
            {receipts.length === 0 && (
              <Button onClick={() => router.push("/receipts/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Receipt
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">
                      {receipt.receiptNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{receipt.clientDetails.name}</div>
                        {receipt.clientDetails.email && (
                          <div className="text-xs text-muted-foreground">
                            {receipt.clientDetails.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(receipt.receiptDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {receipt.paymentMethod === "credit_card" ? "Credit Card" : 
                       receipt.paymentMethod === "bank_transfer" ? "Bank Transfer" : 
                       receipt.paymentMethod.charAt(0).toUpperCase() + receipt.paymentMethod.slice(1)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(receipt.total)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(receipt.status)}
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
                          <DropdownMenuItem onClick={() => router.push(`/receipts/${receipt.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/receipts/${receipt.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(receipt.id, "completed")}
                            disabled={receipt.status === "completed"}
                          >
                            Mark as Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(receipt.id, "void")}
                            disabled={receipt.status === "void"}
                          >
                            Mark as Void
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => confirmDelete(receipt.id)}
                            className="text-red-600"
                          >
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
              This action cannot be undone. This will permanently delete the receipt.
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
