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
import { ReceiptItems } from "./receipt-items"
import { ReceiptPreview } from "./receipt-preview"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ReceiptFormProps = {
  userId: string
  companies: any[]
}

// Create a schema for receipt validation
const receiptSchema = z.object({
  companyId: z.string().min(1, "Please select a company"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  receiptNumber: z.string().min(1, "Receipt number is required"),
  receiptDate: z.date({
    required_error: "Receipt date is required",
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        unitPrice: z.number().min(0, "Unit price must be at least 0"),
      }),
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
  invoiceReference: z.string().optional(),
})

type ReceiptFormValues = z.infer<typeof receiptSchema>

export function ReceiptForm({ userId, companies }: ReceiptFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<ReceiptFormValues>>({
    companyId: companies.find((c) => c.isDefault)?.id || companies[0]?.id,
    receiptNumber: generateReceiptNumber(),
    receiptDate: new Date(),
    paymentMethod: "card",
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
    notes: "",
    invoiceReference: "",
  })

  // Set up the form
  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: formData as ReceiptFormValues,
  })

  function generateReceiptNumber() {
    const prefix = "RCT"
    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    const date = new Date()
    const year = date.getFullYear().toString().substr(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    return `${prefix}-${year}${month}-${randomNumbers}`
  }

  // Handle form submission
  async function onSubmit(values: ReceiptFormValues) {
    setIsSubmitting(true)

    try {
      // Calculate totals
      const subtotal = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const tax = subtotal * 0.1 // Example: 10% tax
      const total = subtotal + tax

      // Get selected company
      const selectedCompany = companies.find((c) => c.id === values.companyId)

      // Prepare receipt data
      const receiptData = {
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
        receiptNumber: values.receiptNumber,
        receiptDate: values.receiptDate.toISOString(),
        paymentMethod: values.paymentMethod,
        items: values.items,
        subtotal,
        tax,
        total,
        notes: values.notes || "",
        invoiceReference: values.invoiceReference || "",
        status: "completed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, "receipts"), receiptData)

      toast({
        title: "Receipt created",
        description: `Receipt ${values.receiptNumber} has been created successfully.`,
      })

      // Navigate to receipt view
      router.push(`/receipts/${docRef.id}`)
    } catch (error) {
      console.error("Error creating receipt:", error)
      toast({
        title: "Error",
        description: "Failed to create receipt. Please try again.",
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
      const receiptDetailsValid = form.trigger(["receiptNumber", "receiptDate", "paymentMethod", "items"])
      if (!receiptDetailsValid) return
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
                  <h3 className="text-lg font-medium">Receipt Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="receiptNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="receiptDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Receipt Date</FormLabel>
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
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Credit/Debit Card</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="paypal">PayPal</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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

                  <div className="space-y-2">
                    <h4 className="font-medium">Receipt Items</h4>
                    <ReceiptItems form={form} />
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any additional notes for the receipt" className="h-24" {...field} />
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
                      Create Receipt
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>

      {isPreviewOpen && (
        <ReceiptPreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          receiptData={form.getValues()}
          companies={companies}
        />
      )}
    </div>
  )
}
