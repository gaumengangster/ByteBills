"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { addDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore"
import type { UseFormReturn } from "react-hook-form"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserPlus, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"

type ClientDetailsProps = {
  form: UseFormReturn<any>
  companies: any[]
  userId: string
}

export function ClientDetails({ form, companies, userId }: ClientDetailsProps) {
  const [clientTab, setClientTab] = useState("new")
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    registrationNumber: "",
    vatNumber: "",
    language: "en",
  })
  const [savedClients, setSavedClients] = useState<any[]>([])

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Load existing clients from Firestore for this user
  useEffect(() => {
    const loadClients = async () => {
      try {
        const clientsQuery = query(
          collection(db, "clients"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
        )

        const snapshot = await getDocs(clientsQuery)
        const clients = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setSavedClients(clients)
      } catch (error) {
        console.error("Error loading clients:", error)
      }
    }

    if (userId) {
      loadClients()
    }
  }, [userId])

  const handleNewClientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewClient({
      ...newClient,
      [e.target.name]: e.target.value,
    })
  }

  const addNewClient = async () => {
    if (!newClient.name) {
      toast({
        title: "Client name required",
        description: "Please provide a name for the client.",
        variant: "destructive",
      })
      return
    }

    try {
      // Persist client to Firestore
      const docRef = await addDoc(collection(db, "clients"), {
        userId,
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        address: newClient.address,
        registrationNumber: newClient.registrationNumber,
        vatNumber: newClient.vatNumber,
        language: newClient.language || "en",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const newClientWithId = {
        ...newClient,
        id: docRef.id,
      }

      // Update local list for the current session
      setSavedClients([...savedClients, newClientWithId])
      setIsAddClientDialogOpen(false)

      toast({
        title: "Success",
        description: `${newClient.name} has been saved to your clients.`,
      })

      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        language: "en",
        registrationNumber: "",
        vatNumber: "",
      })
    } catch (error) {
      console.error("Error saving client:", error)
      toast({
        title: "Error",
        description: "Failed to save client. Please try again.",
        variant: "destructive",
      })
    }
  }

  const selectSavedClient = (clientId: string) => {
    const selectedClient = savedClients.find((client) => client.id === clientId)

    if (selectedClient) {
      form.setValue("clientName", selectedClient.name)
      form.setValue("clientEmail", selectedClient.email)
      form.setValue("clientPhone", selectedClient.phone)
      form.setValue("clientAddress", selectedClient.address)
      form.setValue("clientLanguage", selectedClient.language || "en")
      form.setValue("clientRegistrationNumber", selectedClient.registrationNumber || "")
      form.setValue("clientVatNumber", selectedClient.vatNumber || "")
      setSelectedClientId(clientId)
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Company Information</h3>

          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Company</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                        {company.isDefault && " (Default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Client Information</h3>

            <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Save New Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>Save this client for future invoices.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="client-name" className="text-sm font-medium">
                      Client Name
                    </label>
                    <Input
                      id="client-name"
                      name="name"
                      value={newClient.name}
                      onChange={handleNewClientChange}
                      placeholder="Client name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="client-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="client-email"
                      name="email"
                      type="email"
                      value={newClient.email}
                      onChange={handleNewClientChange}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="client-phone" className="text-sm font-medium">
                      Phone
                    </label>
                    <Input
                      id="client-phone"
                      name="phone"
                      value={newClient.phone}
                      onChange={handleNewClientChange}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="client-registration-number" className="text-sm font-medium">
                        Registration Number
                      </label>
                      <Input
                        id="client-registration-number"
                        name="registrationNumber"
                        value={newClient.registrationNumber}
                        onChange={handleNewClientChange}
                        placeholder="Registration number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="client-vat-number" className="text-sm font-medium">
                        VAT Number
                      </label>
                      <Input
                        id="client-vat-number"
                        name="vatNumber"
                        value={newClient.vatNumber}
                        onChange={handleNewClientChange}
                        placeholder="VAT number"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="client-address" className="text-sm font-medium">
                      Address
                    </label>
                    <Textarea
                      id="client-address"
                      name="address"
                      value={newClient.address}
                      onChange={handleNewClientChange}
                      placeholder="Client address"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="client-language" className="text-sm font-medium">
                      Document Language
                    </label>
                    <Select
                      value={newClient.language}
                      onValueChange={(value) => setNewClient({ ...newClient, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">German (Deutsch)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddClientDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addNewClient}>Add Client</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="new" value={clientTab} onValueChange={setClientTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New Client</TabsTrigger>
              <TabsTrigger value="existing">Existing Client</TabsTrigger>
            </TabsList>
            <TabsContent value="new">
              <div className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="clientAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "en"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="de">German (Deutsch)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientRegistrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Registration number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientVatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VAT Number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="VAT number DE123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="existing">
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 gap-4">
                  {savedClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => selectSavedClient(client.id)}
                      className={cn(
                        "flex items-start p-4 border rounded-md cursor-pointer transition-all duration-200",
                        selectedClientId === client.id ? "bg-primary/10 border-primary shadow-sm" : "hover:bg-accent",
                      )}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{client.name}</h4>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                      </div>
                      {selectedClientId === client.id && <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectSavedClient(client.id)
                        }}
                        className="ml-2"
                      >
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
