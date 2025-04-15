"use client"

import type React from "react"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserPlus } from "lucide-react"
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

type ClientDetailsProps = {
  form: UseFormReturn<any>
  companies: any[]
}

export function ClientDetails({ form, companies }: ClientDetailsProps) {
  const [clientTab, setClientTab] = useState("new")
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  })
  const [savedClients, setSavedClients] = useState<any[]>([
    {
      id: "1",
      name: "Acme Corporation",
      email: "billing@acme.com",
      phone: "+1 234 567 890",
      address: "123 Business Ave, New York, NY 10001",
    },
    {
      id: "2",
      name: "Tech Innovators LLC",
      email: "accounts@techinnovators.com",
      phone: "+1 987 654 321",
      address: "456 Startup Blvd, San Francisco, CA 94107",
    },
  ])

  const handleNewClientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewClient({
      ...newClient,
      [e.target.name]: e.target.value,
    })
  }

  const addNewClient = () => {
    if (!newClient.name) {
      toast({
        title: "Client name required",
        description: "Please provide a name for the client.",
        variant: "destructive",
      })
      return
    }

    const newClientWithId = {
      ...newClient,
      id: Date.now().toString(),
    }

    setSavedClients([...savedClients, newClientWithId])
    setIsAddClientDialogOpen(false)

    toast({
      title: "Client added",
      description: `${newClient.name} has been added to your clients.`,
    })

    // Reset form
    setNewClient({
      name: "",
      email: "",
      phone: "",
      address: "",
    })
  }

  const selectSavedClient = (clientId: string) => {
    const selectedClient = savedClients.find((client) => client.id === clientId)

    if (selectedClient) {
      form.setValue("clientName", selectedClient.name)
      form.setValue("clientEmail", selectedClient.email)
      form.setValue("clientPhone", selectedClient.phone)
      form.setValue("clientAddress", selectedClient.address)
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Input {...field} />
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
                          <Input type="email" {...field} />
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
                          <Input {...field} />
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
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>
            <TabsContent value="existing">
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 gap-4">
                  {savedClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-start p-4 border rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => selectSavedClient(client.id)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{client.name}</h4>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectSavedClient(client.id)
                        }}
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

