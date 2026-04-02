"use client"

import { useEffect, useState } from "react"
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
import { generateNextDocumentNumber } from "@/lib/document-number"
import { persistDocumentDateYmd } from "@/lib/document-date-berlin"
import { quartalAndYearFromYmd, revenueDocumentReportingFlags } from "@/lib/reporting-flags"
import { buildRevenueDocumentEurPersist, REVENUE_FX_RATE_MISSING } from "@/lib/revenue-document-eur"

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
  clientRegistrationNumber: z.string().optional(),
  clientVatNumber: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.date({
    required_error: "Invoice date is required",
  }),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  taxDate: z.date().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "CZK"], { required_error: "Currency is required" }),
  unitOfWork: z.enum(["M/D", "M/H", "Kg", "Piece"], { required_error: "Unit of work is required" }),
  taxRate: z.coerce.number().min(0).max(25).default(20),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        quantity: z.number().min(0.001, "Quantity must be greater than 0"),
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
    invoiceNumber: "",
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


  useEffect(() => {
    if (userId) {
      generateNextDocumentNumber(userId, "invoices")
        .then((num) => {
          form.setValue("invoiceNumber", num)
        })
    }
  }, [userId])

  // Handle form submission
  async function onSubmit(values: InvoiceFormValues) {
    setIsSubmitting(true)

    try {
      // Calculate totals
      const subtotal = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const tax = subtotal * (values.taxRate / 100)
      const total = subtotal + tax

      const invoiceDateYmd = persistDocumentDateYmd(values.invoiceDate)
      // Save-time only: empty VAT date → store Leistungsdatum as invoice date; `taxDate` is always persisted.
      const taxDateYmd = persistDocumentDateYmd(values.taxDate ?? values.invoiceDate)
      const taxPeriodMeta = quartalAndYearFromYmd(taxDateYmd)
      const euerYear = taxPeriodMeta?.year ?? parseInt(invoiceDateYmd.slice(0, 4), 10)

      const eurPersist = await buildRevenueDocumentEurPersist({
        db,
        userId,
        kind: "invoice",
        invoiceDateIso: invoiceDateYmd,
        invoiceTaxDateIso: taxDateYmd,
        currency: values.currency,
        subtotal,
        tax,
        total,
        items: values.items,
      })

      // Get selected company
      const selectedCompany = companies.find((c) => c.id === values.companyId)
      const reporting = revenueDocumentReportingFlags(taxDateYmd)

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
          bankName: selectedCompany?.businessDetails?.bankName || "",
          iban: selectedCompany?.businessDetails?.iban || "",
          swiftBic: selectedCompany?.businessDetails?.swiftBic || "",
          bankAddress: selectedCompany?.businessDetails?.bankAddress || "",

        },
        clientDetails: {
          name: values.clientName,
          email: values.clientEmail || "",
          phone: values.clientPhone || "",
          address: values.clientAddress || "",
          registrationNumber: values.clientRegistrationNumber || "",
          vatNumber: values.clientVatNumber || "",
        },
        language: values.clientLanguage || "en",
        invoiceNumber: values.invoiceNumber,
        invoiceDate: invoiceDateYmd,
        dueDate: persistDocumentDateYmd(values.dueDate),
        taxDate: taxDateYmd,
        euerYear,
        currency: values.currency,
        unitOfWork: values.unitOfWork,
        taxRate: values.taxRate,
        items: eurPersist.items,
        subtotal,
        tax,
        total,
        subtotalEur: eurPersist.subtotalEur,
        taxEur: eurPersist.taxEur,
        totalEur: eurPersist.totalEur,
        eurRateDate: eurPersist.eurRateDate,
        ...(values.currency !== "EUR" && eurPersist.exchangeRateToEur != null
          ? { exchangeRateToEur: eurPersist.exchangeRateToEur }
          : {}),
        notes: values.notes || "",
        terms: values.terms || "",
        status: "pending", // pending, paid, overdue, cancelled
        uploadedToDrive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...reporting,
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
      if (error instanceof Error && error.message === REVENUE_FX_RATE_MISSING) {
        toast({
          title: "Missing exchange rate",
          description:
            "Import the BMF CSV for this document’s month on Exchange rates (Firestore).",
        })
        return
      }
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                    <FormField
                      control={form.control}
                      name="taxDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>
                            Tax Date{" "}
                            <span className="text-xs font-normal text-muted-foreground">(Leistungsdatum)</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? format(field.value, "PPP") : <span>Same as invoice date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">
                            Sets the VAT quarter (Q1–Q4). Leave blank to use invoice date.
                          </p>
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
