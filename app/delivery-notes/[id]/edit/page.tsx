"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Check, Eye, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ClientDetails } from "@/components/invoices/client-details"
import { DeliveryNoteItems } from "@/components/delivery-notes/delivery-note-items"
import { DeliveryNotePreview } from "@/components/delivery-notes/delivery-note-preview"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

// Create a schema for delivery note validation
const deliveryNoteSchema = z.object({
  companyId: z.string().min(1, "Please select a company"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  deliveryNoteNumber: z.string().min(1, "Delivery note number is required"),
  deliveryDate: z.date({
    required_error: "Delivery date is required",
  }),
  deliveryAddress: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        notes: z.string().optional(),
      }),
    )
    .min(1, "At least one item is required"),
  deliveryInstructions: z.string().optional(),
  notes: z.string().optional(),
  invoiceReference: z.string().optional(),
  orderReference: z.string().optional(),
})

type DeliveryNoteFormValues = z.infer<typeof deliveryNoteSchema>

export default function EditDeliveryNotePage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [deliveryNote, setDeliveryNote] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  // Set up the form
  const form = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: {
      companyId: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      deliveryNoteNumber: "",
      deliveryDate: new Date(),
      deliveryAddress: "",
      items: [{ description: "", quantity: 1, notes: "" }],
      deliveryInstructions: "",
      notes: "",
      invoiceReference: "",
      orderReference: "",
    },
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch user data
        const userDoc = await getDoc(doc(db, "bytebills-users", user.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        }

        // Fetch delivery note data
        const deliveryNoteDoc = await getDoc(doc(db, "deliveryNotes", params.id))
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
        if (deliveryNoteData.userId !== user.uid) {
          toast({
            title: "Access denied",
            description: "You don't have permission to edit this delivery note.",
            variant: "destructive",
          })
          router.push("/delivery-notes")
          return
        }

        setDeliveryNote(deliveryNoteData)

        // Set form values
        form.reset({
          companyId: deliveryNoteData.companyId,
          clientName: deliveryNoteData.clientDetails.name,
          clientEmail: deliveryNoteData.clientDetails.email || "",
          clientPhone: deliveryNoteData.clientDetails.phone || "",
          clientAddress: deliveryNoteData.clientDetails.address || "",
          deliveryNoteNumber: deliveryNoteData.deliveryNoteNumber,
          deliveryDate: new Date(deliveryNoteData.deliveryDate),
          deliveryAddress: deliveryNoteData.deliveryAddress || "",
          items: deliveryNoteData.items || [{ description: "", quantity: 1, notes: "" }],
          deliveryInstructions: deliveryNoteData.deliveryInstructions || "",
          notes: deliveryNoteData.notes || "",
          invoiceReference: deliveryNoteData.invoiceReference || "",
          orderReference: deliveryNoteData.orderReference || "",
        })
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingData(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user, params.id, router, form])

  // Handle form submission
  async function onSubmit(values: DeliveryNoteFormValues) {
    setIsSubmitting(true)

    try {
      // Get selected company
      const selectedCompany = userData.companies.find((c: any) => c.id === values.companyId)

      // Prepare delivery note data
      const deliveryNoteData = {
        companyId: values.companyId,
        companyDetails: {
          name: selectedCompany?.name || "",
          address: selectedCompany?.businessDetails?.address || "",
          city: selectedCompany?.businessDetails?.city || "",
          country: selectedCompany?.businessDetails?.country || "",
          email: selectedCompany?.businessDetails?.email || "",
          phone: selectedCompany?.businessDetails?.phone || "",
          logo: selectedCompany?.logo || null,
        },
        clientDetails: {
          name: values.clientName,
          email: values.clientEmail || "",
          phone: values.clientPhone || "",
          address: values.clientAddress || "",
        },
        deliveryNoteNumber: values.deliveryNoteNumber,
        deliveryDate: values.deliveryDate.toISOString(),
        deliveryAddress: values.deliveryAddress || "",
        items: values.items,
        deliveryInstructions: values.deliveryInstructions || "",
        notes: values.notes || "",
        invoiceReference: values.invoiceReference || "",
        orderReference: values.orderReference || "",
        updatedAt: new Date().toISOString(),
      }

      // Update in Firestore
      await updateDoc(doc(db, "deliveryNotes", params.id), deliveryNoteData)

      toast({
        title: "Delivery note updated",
        description: `Delivery note ${values.deliveryNoteNumber} has been updated successfully.`,
      })

      // Navigate to delivery note view
      router.push(`/delivery-notes/${params.id}`)
    } catch (error) {
      console.error("Error updating delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to update delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      const companyIdValid = form.trigger("companyId")
      if (!companyIdValid) return

      const clientDetailsValid = form.trigger(["clientName", "clientEmail", "clientPhone", "clientAddress"])
      if (!clientDetailsValid) return
    } else if (currentStep === 2) {
      const deliveryNoteDetailsValid = form.trigger(["deliveryNoteNumber", "deliveryDate", "deliveryAddress", "items"])
      if (!deliveryNoteDetailsValid) return
    }

    setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    setCurrentStep(currentStep - 1)
  }

  if (loading || loadingData) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!userData?.companies || userData.companies.length === 0) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col justify-center items-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-bold mb-2">No Company Setup</h2>
            <p className="text-muted-foreground mb-4">You need to set up a company before editing delivery notes.</p>
            <button onClick={() => router.push("/settings")} className="text-primary hover:underline">
              Go to Settings
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Delivery Note</h1>
          <p className="text-muted-foreground">Update the details of your delivery note</p>
        </div>

        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border",
                  currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                1
              </div>
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border",
                  currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                2
              </div>
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border",
                  currentStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                3
              </div>
            </div>

            <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {currentStep === 1 && <ClientDetails form={form} companies={userData.companies} />}

              {currentStep === 2 && (
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Delivery Note Details</h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="deliveryNoteNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Delivery Note Number</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="deliveryDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Delivery Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground",
                                      )}
                                    >
                                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="deliveryAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Delivery Address (if different from client address)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="invoiceReference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Invoice Reference (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., INV-2023-0001" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="orderReference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Order Reference (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., ORD-2023-0001" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Delivery Items</h4>
                        <DeliveryNoteItems form={form} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep === 3 && (
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Additional Information</h3>

                      <FormField
                        control={form.control}
                        name="deliveryInstructions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Instructions</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Special instructions for delivery" className="h-24" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Any additional notes for the delivery note"
                                className="h-24"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                ) : (
                  <div></div>
                )}

                {currentStep < 3 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Update Delivery Note
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </Form>

          {isPreviewOpen && (
            <DeliveryNotePreview
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              deliveryNoteData={form.getValues()}
              companies={userData.companies}
            />
          )}
        </div>
      </main>
    </>
  )
}
