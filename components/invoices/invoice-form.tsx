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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { ClientDetails } from "./client-details"
import { InvoiceItems } from "./invoice-items"
import { InvoicePreview } from "./invoice-preview"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

type InvoiceFormProps = {
  userId: string
  companies: any[]
}

// Create a schema for invoice validation
const invoiceSchema = z.object({
  companyId: z.string().min(1, "Please select a company"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  clientLanguage: z.string().optional().default("en"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.date({
    required_error: "Invoice date is required",
  }),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  currency: z.enum(["EUR", "USD", "GBP", "CZK"], { required_error: "Currency is required" }),
  unitOfWork: z.enum(["M/D", "M/H", "Kg", "Piece"], { required_error: "Unit of work is required" }),
  taxRate: z.coerce.number().min(0).max(25).default(20),
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
  terms: z.string().optional(),
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

export function InvoiceForm({ userId, companies }: InvoiceFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<InvoiceFormValues>>({
    companyId: companies.find((c) => c.isDefault)?.id || companies[0]?.id,
    invoiceNumber: generateInvoiceNumber(),
    invoiceDate: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    clientLanguage: "en",
    currency: "EUR",
    unitOfWork: "M/D",
    taxRate: 20,
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
    notes: "",
    terms: "Payment is due within 30 days",
  })

  // Set up the form
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: formData as InvoiceFormValues,
  })

  const currency = form.watch("currency")
  const unitOfWork = form.watch("unitOfWork")
  const taxRate = form.watch("taxRate")
  const [showItemErrors, setShowItemErrors] = useState(false)

  function generateInvoiceNumber() {
    const prefix = "INV"
    const randomNumbers = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    const date = new Date()
    const year = date.getFullYear().toString().substr(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    return `${prefix}-${year}${month}-${randomNumbers}`
  }

  // Handle form submission
  async function onSubmit(values: InvoiceFormValues) {
    setIsSubmitting(true)

    try {
      // Calculate totals
      const subtotal = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const tax = subtotal * (values.taxRate / 100)
      const total = subtotal + tax

      // Get selected company
      const selectedCompany = companies.find((c) => c.id === values.companyId)

      // Prepare invoice data
      const invoiceData = {
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
        language: values.clientLanguage || "en",
        invoiceNumber: values.invoiceNumber,
        invoiceDate: values.invoiceDate.toISOString(),
        dueDate: values.dueDate.toISOString(),
        currency: values.currency,
        unitOfWork: values.unitOfWork,
        taxRate: values.taxRate,
        items: values.items,
        subtotal,
        tax,
        total,
        notes: values.notes || "",
        terms: values.terms || "",
        status: "pending", // pending, paid, overdue, cancelled
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, "invoices"), invoiceData)

      toast({
        title: "Success",
        description: `Invoice ${values.invoiceNumber} has been created successfully.`,
      })

      // Navigate to invoice view
      router.push(`/invoices/${docRef.id}`)
    } catch (error) {
      console.error("Error creating invoice:", error)
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = async () => {
    // Get current form values
    const currentValues = form.getValues()
    setFormData(currentValues)

    // Validate current step before proceeding
    if (currentStep === 1) {
      // Allow moving to step 2 without blocking on validation;
      // full client/company validation will occur on final submit.
    } else if (currentStep === 2) {
      const invoiceDetailsValid = await form.trigger([
        "invoiceNumber",
        "invoiceDate",
        "dueDate",
        "currency",
        "unitOfWork",
        "taxRate",
        "items",
      ])
      if (!invoiceDetailsValid) {
        setShowItemErrors(true)
        return
      }
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
          {currentStep === 1 && <ClientDetails form={form} companies={companies} userId={userId} />}

          {currentStep === 2 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Invoice Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Invoice Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
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
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Due Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
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
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="EUR">€ EUR</SelectItem>
                              <SelectItem value="CZK">Kč CZK</SelectItem>
                              <SelectItem value="USD">$ USD</SelectItem>
                              <SelectItem value="GBP">£ GBP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unitOfWork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Unit</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="M/D">Man/Day</SelectItem>
                              <SelectItem value="M/H">Man/Hour</SelectItem>
                              <SelectItem value="Kg">kg</SelectItem>
                              <SelectItem value="Piece">Komad</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PDV / Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="25"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                              className="w-24 h-10"
                              placeholder="20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Invoice Items</h4>
                    <InvoiceItems form={form} currency={currency} taxPercentage={taxRate} showErrors={showItemErrors} />
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
                          <Textarea placeholder="Any additional notes for the client" className="h-24" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Terms and conditions of the invoice" className="h-24" {...field} />
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
                      Create Invoice
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>

      {isPreviewOpen && (
        <InvoicePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          invoiceData={form.getValues()}
          companies={companies}
        />
      )}
    </div>
  )
}
