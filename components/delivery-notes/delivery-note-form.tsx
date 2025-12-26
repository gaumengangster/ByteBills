"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addDoc, collection } from "firebase/firestore"
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
import { ClientDetails } from "../invoices/client-details"
import { DeliveryNoteItems } from "./delivery-note-items"
import { DeliveryNotePreview } from "./delivery-note-preview"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { DocumentSettings } from "@/components/document-settings/document-settings" // Added DocumentSettings import

type DeliveryNoteFormProps = {
  userId?: string
  companies?: any[]
}

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

export function DeliveryNoteForm({ userId, companies = [] }: DeliveryNoteFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [currency, setCurrency] = useState("USD") // Added currency state
  const [formData, setFormData] = useState<Partial<DeliveryNoteFormValues>>({
    companyId: companies.find((c) => c.isDefault)?.id || companies[0]?.id,
    deliveryNoteNumber: generateDeliveryNoteNumber(),
    deliveryDate: new Date(),
    items: [{ description: "", quantity: 1, notes: "" }],
    deliveryInstructions: "",
    notes: "",
    invoiceReference: "",
    orderReference: "",
  })

  // Set up the form
  const form = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: formData as DeliveryNoteFormValues,
  })

  function generateDeliveryNoteNumber() {
    const prefix = "DN"
    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    const date = new Date()
    const year = date.getFullYear().toString().substr(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    return `${prefix}-${year}${month}-${randomNumbers}`
  }

  // Handle form submission
  async function onSubmit(values: DeliveryNoteFormValues) {
    setIsSubmitting(true)

    try {
      // Get selected company
      const selectedCompany = companies.find((c) => c.id === values.companyId)

      // Prepare delivery note data
      const deliveryNoteData = {
        userId,
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
        currency, // Store currency for consistency
        status: "delivered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, "deliveryNotes"), deliveryNoteData)

      toast({
        title: "Success",
        description: `Delivery note ${values.deliveryNoteNumber} has been created successfully.`,
      })

      // Navigate to delivery note view
      router.push(`/delivery-notes/${docRef.id}`)
    } catch (error) {
      console.error("Error creating delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to create delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = () => {
    // Get current form values
    const currentValues = form.getValues()
    setFormData(currentValues)

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
    // Get current form values
    const currentValues = form.getValues()
    setFormData(currentValues)
    setCurrentStep(currentStep - 1)
  }

  return (
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
          {currentStep === 1 && <ClientDetails form={form} companies={companies} />}

          {currentStep === 2 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Delivery Note Details</h3>

                  <DocumentSettings currency={currency} onCurrencyChange={setCurrency} hidesTaxSelector={true} />

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
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Create Delivery Note
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
          companies={companies}
        />
      )}
    </div>
  )
}
