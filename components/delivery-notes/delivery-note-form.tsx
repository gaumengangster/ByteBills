"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Plus, Trash } from "lucide-react"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { DeliveryNotePreview } from "./delivery-note-preview"

// Define the schema for the form
const formSchema = z.object({
  companyId: z.string().min(1, { message: "Please select a company" }),
  deliveryNoteNumber: z.string().min(1, { message: "Delivery note number is required" }),
  deliveryDate: z.date(),
  clientDetails: z.object({
    name: z.string().min(1, { message: "Client name is required" }),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
  }),
  deliveryAddress: z.string().optional(),
  invoiceReference: z.string().optional(),
  orderReference: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, { message: "Description is required" }),
        quantity: z.coerce.number().min(1, { message: "Quantity must be at least 1" }),
        notes: z.string().optional(),
      }),
    )
    .min(1, { message: "At least one item is required" }),
  deliveryInstructions: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function DeliveryNoteForm() {
  const { user } = useAuth()
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("form")

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deliveryDate: new Date(),
      clientDetails: {
        name: "",
        address: "",
        city: "",
        country: "",
        phone: "",
        email: "",
      },
      deliveryAddress: "",
      invoiceReference: "",
      orderReference: "",
      items: [
        {
          description: "",
          quantity: 1,
          notes: "",
        },
      ],
      deliveryInstructions: "",
      notes: "",
    },
  })

  // Generate a unique delivery note number
  useEffect(() => {
    const generateDeliveryNoteNumber = () => {
      const date = new Date()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const day = date.getDate().toString().padStart(2, "0")
      const randomNum = Math.floor(1000 + Math.random() * 9000)
      return `DN-${month}${day}-${randomNum}`
    }

    form.setValue("deliveryNoteNumber", generateDeliveryNoteNumber())
  }, [form])

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) return

      try {
        const companiesRef = collection(db, "companies")
        const q = query(companiesRef, where("userId", "==", user.uid))
        const querySnapshot = await getDocs(q)

        const companiesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setCompanies(companiesData)

        // Set the first company as default if available
        if (companiesData.length > 0) {
          form.setValue("companyId", companiesData[0].id)
          setSelectedCompany(companiesData[0])
        }
      } catch (error) {
        console.error("Error fetching companies:", error)
        toast({
          title: "Error",
          description: "Failed to fetch companies. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchCompanies()
  }, [user, form])

  // Handle company change
  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId)
    setSelectedCompany(company)
  }

  // Add a new item
  const addItem = () => {
    const currentItems = form.getValues("items")
    form.setValue("items", [
      ...currentItems,
      {
        description: "",
        quantity: 1,
        notes: "",
      },
    ])
  }

  // Remove an item
  const removeItem = (index: number) => {
    const currentItems = form.getValues("items")
    if (currentItems.length > 1) {
      form.setValue(
        "items",
        currentItems.filter((_, i) => i !== index),
      )
    }
  }

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a delivery note",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Get the selected company details
      const company = companies.find((c) => c.id === data.companyId)

      // Prepare the delivery note data
      const deliveryNoteData = {
        ...data,
        userId: user.uid,
        companyDetails: {
          name: company?.name || "",
          address: company?.address || "",
          city: company?.city || "",
          country: company?.country || "",
          phone: company?.phone || "",
          email: company?.email || "",
        },
        createdAt: new Date(),
        status: "delivered",
      }

      // Add the delivery note to Firestore
      const docRef = await addDoc(collection(db, "deliveryNotes"), deliveryNoteData)

      toast({
        title: "Success",
        description: "Delivery note created successfully",
      })

      // Redirect to the delivery notes list
      router.push("/delivery-notes")
    } catch (error) {
      console.error("Error creating delivery note:", error)
      toast({
        title: "Error",
        description: "Failed to create delivery note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Create Delivery Note</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Selection */}
              <Card>
                <CardContent className="pt-6">
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value)
                            handleCompanyChange(value)
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Delivery Note Details */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <Button variant={"outline"} className="w-full pl-3 text-left font-normal">
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
                      name="invoiceReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Reference (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Client Details */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-medium mb-4">Client Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientDetails.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clientDetails.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clientDetails.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clientDetails.address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Address</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clientDetails.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clientDetails.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Country</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address (if different from client address)</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  </div>

                  {form.getValues("items").map((_, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-start">
                      <div className="md:col-span-5">
                        <FormField
                          control={form.control}
                          name={`items.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={form.getValues("items").length <= 1}
                          className="mt-8"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-medium mb-4">Additional Information</h3>

                  <FormField
                    control={form.control}
                    name="deliveryInstructions"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Delivery Instructions</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
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
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Delivery Note"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <DeliveryNotePreview
            deliveryNote={{
              ...form.getValues(),
              companyDetails: selectedCompany || {},
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
