"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { Calendar, Mail, Phone, User } from "lucide-react"
import { InvoiceActions } from "@/components/invoices/invoice-actions"

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [loadingInvoice, setLoadingInvoice] = useState(true)
  const { id } = params

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!user) return

      try {
        const invoiceDoc = await getDoc(doc(db, "invoices", id))

        if (!invoiceDoc.exists()) {
          toast({
            title: "Invoice not found",
            description: "The requested invoice does not exist.",
            variant: "destructive",
          })
          router.push("/invoices")
          return
        }

        const invoiceData = {
          id: invoiceDoc.id,
          userId: invoiceDoc.data().userId,
          ...invoiceDoc.data(),
        }

        // Check if the invoice belongs to the current user
        if ((invoiceData.userId as string) !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to view this invoice.",
            variant: "destructive",
          })
          router.push("/invoices")
          return
        }

        setInvoice(invoiceData)
      } catch (error) {
        console.error("Error fetching invoice:", error)
        toast({
          title: "Error",
          description: "Failed to load invoice. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingInvoice(false)
      }
    }

    if (user && id) {
      fetchInvoice()
    }
  }, [user, id, router])

  const handleStatusChange = async (newStatus: string) => {
    try {
      const invoiceRef = doc(db, "invoices", id)
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setInvoice({
        ...invoice,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })

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

  const formatCurrency = (amount: number) => {
    const currency = invoice?.currency || "USD"
    const currencyMap: { [key: string]: string } = {
      USD: "USD",
      EUR: "EUR",
      GBP: "GBP",
      JPY: "JPY",
      AUD: "AUD",
      CAD: "CAD",
      CHF: "CHF",
      CNY: "CNY",
      INR: "INR",
      MXN: "MXN",
      UGX: "UGX",
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyMap[currency] || "USD",
    }).format(amount)
  }

  if (loading || loadingInvoice) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!invoice) {
    return <div className="flex min-h-screen items-center justify-center">Invoice not found</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Invoice #{invoice.invoiceNumber}</h1>
            <div className="flex items-center mt-1">
              {getStatusBadge(invoice.status)}
              <span className="text-muted-foreground ml-2">
                Last updated: {format(new Date(invoice.updatedAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>

          {user ?
            (<InvoiceActions invoice={invoice} userId={user.uid} onStatusChange={handleStatusChange} />)
            : ( <p>Loading user data...</p> )
          }        
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-1">Invoice Number</h3>
                    <p>{invoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Invoice Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      {format(new Date(invoice.invoiceDate), "MMMM d, yyyy")}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Due Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      {format(new Date(invoice.dueDate), "MMMM d, yyyy")}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Status</h3>
                    {getStatusBadge(invoice.status)}
                  </div>
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
                    {invoice.items.map((item: any, index: number) => (
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
                          <span>{formatCurrency(invoice.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax:</span>
                          <span>{formatCurrency(invoice.tax)}</span>
                        </div>
                        <div className="flex justify-between font-medium pt-2 border-t">
                          <span>Total:</span>
                          <span>{formatCurrency(invoice.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(invoice.notes || invoice.terms) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoice.notes && (
                      <div>
                        <h3 className="font-medium mb-1">Notes</h3>
                        <p className="text-muted-foreground">{invoice.notes}</p>
                      </div>
                    )}

                    {invoice.terms && (
                      <div>
                        <h3 className="font-medium mb-1">Terms & Conditions</h3>
                        <p className="text-muted-foreground">{invoice.terms}</p>
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
                      <h3 className="font-medium">{invoice.clientDetails.name}</h3>
                      {invoice.clientDetails.address && (
                        <p className="text-sm text-muted-foreground mt-1">{invoice.clientDetails.address}</p>
                      )}
                    </div>
                  </div>

                  {invoice.clientDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{invoice.clientDetails.email}</span>
                    </div>
                  )}

                  {invoice.clientDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{invoice.clientDetails.phone}</span>
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
                  {invoice.companyDetails.logo && (
                    <img
                      src={invoice.companyDetails.logo || "/placeholder.svg"}
                      alt={invoice.companyDetails.name}
                      className="h-12 object-contain mb-2"
                    />
                  )}

                  <div>
                    <h3 className="font-medium">{invoice.companyDetails.name}</h3>
                    {invoice.companyDetails.address && (
                      <p className="text-sm text-muted-foreground mt-1">{invoice.companyDetails.address}</p>
                    )}
                    {(invoice.companyDetails.city || invoice.companyDetails.country) && (
                      <p className="text-sm text-muted-foreground">
                        {invoice.companyDetails.city}
                        {invoice.companyDetails.city && invoice.companyDetails.country && ", "}
                        {invoice.companyDetails.country}
                      </p>
                    )}
                  </div>

                  {invoice.companyDetails.email && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{invoice.companyDetails.email}</span>
                    </div>
                  )}

                  {invoice.companyDetails.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span>{invoice.companyDetails.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* This div is used for PDF generation */}
        <div id={`invoice-content-${invoice.id}`} className="hidden">
          <div className="bg-white p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-1">INVOICE</h1>
                <div className="text-gray-600">
                  <div>Invoice # {invoice.invoiceNumber}</div>
                  <div>Date: {format(new Date(invoice.invoiceDate), "PP")}</div>
                  <div>Due: {format(new Date(invoice.dueDate), "PP")}</div>
                </div>
              </div>

              <div className="text-right">
                {invoice.companyDetails.logo ? (
                  <img
                    src={invoice.companyDetails.logo || "/placeholder.svg"}
                    alt={invoice.companyDetails.name}
                    className="w-24 h-auto mb-2"
                  />
                ) : (
                  <div className="text-xl font-bold mb-2">{invoice.companyDetails.name}</div>
                )}
                <div className="text-sm text-gray-600">
                  {invoice.companyDetails.address && <div>{invoice.companyDetails.address}</div>}
                  {(invoice.companyDetails.city || invoice.companyDetails.country) && (
                    <div>
                      {invoice.companyDetails.city}
                      {invoice.companyDetails.city && invoice.companyDetails.country && ", "}
                      {invoice.companyDetails.country}
                    </div>
                  )}
                  {invoice.companyDetails.phone && <div>{invoice.companyDetails.phone}</div>}
                  {invoice.companyDetails.email && <div>{invoice.companyDetails.email}</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-lg font-semibold mb-2">Bill To:</h2>
                <div>
                  <div className="font-medium">{invoice.clientDetails.name}</div>
                  {invoice.clientDetails.address && (
                    <div className="text-gray-600">{invoice.clientDetails.address}</div>
                  )}
                  {invoice.clientDetails.phone && <div className="text-gray-600">{invoice.clientDetails.phone}</div>}
                  {invoice.clientDetails.email && <div className="text-gray-600">{invoice.clientDetails.email}</div>}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 border">Description</th>
                    <th className="text-center p-2 border">Quantity</th>
                    <th className="text-right p-2 border">Unit Price</th>
                    <th className="text-right p-2 border">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="p-2 border">{item.description}</td>
                      <td className="text-center p-2 border">{item.quantity}</td>
                      <td className="text-right p-2 border">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right p-2 border">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="border"></td>
                    <td className="text-right p-2 border">Subtotal</td>
                    <td className="text-right p-2 border">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border"></td>
                    <td className="text-right p-2 border">Tax</td>
                    <td className="text-right p-2 border">{formatCurrency(invoice.tax)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={2} className="border"></td>
                    <td className="text-right p-2 border">Total</td>
                    <td className="text-right p-2 border">{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {(invoice.notes || invoice.terms) && (
              <div className="grid grid-cols-2 gap-8 mb-8">
                {invoice.notes && (
                  <div>
                    <h3 className="font-medium mb-2">Notes:</h3>
                    <p className="text-sm text-gray-600">{invoice.notes}</p>
                  </div>
                )}

                {invoice.terms && (
                  <div>
                    <h3 className="font-medium mb-2">Terms & Conditions:</h3>
                    <p className="text-sm text-gray-600">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}

            <div className="text-center mt-8 pt-8 border-t text-sm text-gray-600">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
