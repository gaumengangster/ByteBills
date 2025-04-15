"use client"

import { useState } from "react"
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertCircle, Building2, Check, Lock, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"

type Company = {
  id: string
  name: string
  isDefault?: boolean
}

type CompanyListProps = {
  companies: Company[]
  isPremium: boolean
  userId: string
}

export function CompanyList({ companies, isPremium, userId }: CompanyListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [defaultCompanyId, setDefaultCompanyId] = useState(companies.find((c) => c.isDefault)?.id || companies[0]?.id)

  const maxCompanies = isPremium ? 999 : 3

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return

    setIsSubmitting(true)

    try {
      const newCompany = {
        id: Date.now().toString(),
        name: newCompanyName.trim(),
        isDefault: companies.length === 0, // Make default if it's the first company
        logo: null,
        businessDetails: {
          address: "",
          city: "",
          country: "US",
          email: "",
          phone: "",
        },
        createdAt: new Date().toISOString(),
      }

      const userRef = doc(db, "users", userId)
      await updateDoc(userRef, {
        companies: arrayUnion(newCompany),
      })

      toast({
        title: "Company added",
        description: `${newCompanyName} has been added successfully.`,
      })

      setIsDialogOpen(false)
      setNewCompanyName("")

      // Reload the page to refresh companies data
      window.location.reload()
    } catch (error) {
      console.error("Error adding company:", error)
      toast({
        title: "Error",
        description: "Failed to add company. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetDefaultCompany = async (companyId: string) => {
    try {
      if (companyId === defaultCompanyId) return

      setDefaultCompanyId(companyId)

      const userRef = doc(db, "users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const updatedCompanies = userData.companies.map((company: any) => ({
          ...company,
          isDefault: company.id === companyId,
        }))

        await updateDoc(userRef, {
          companies: updatedCompanies,
        })

        toast({
          title: "Default company updated",
          description: "Your default company has been updated successfully.",
        })
      }
    } catch (error) {
      console.error("Error setting default company:", error)
      toast({
        title: "Error",
        description: "Failed to update default company. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCompany = async (companyId: string) => {
    if (companies.length === 1) {
      toast({
        title: "Cannot delete",
        description: "You need at least one company.",
        variant: "destructive",
      })
      return
    }

    try {
      const userRef = doc(db, "users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const deletedCompany = userData.companies.find((c: any) => c.id === companyId)
        const isDefault = deletedCompany.isDefault

        // Filter out the company to delete
        const updatedCompanies = userData.companies.filter((company: any) => company.id !== companyId)

        // If deleted company was default, set a new default
        if (isDefault && updatedCompanies.length > 0) {
          updatedCompanies[0].isDefault = true
        }

        await updateDoc(userRef, {
          companies: updatedCompanies,
        })

        toast({
          title: "Company deleted",
          description: `${deletedCompany.name} has been deleted successfully.`,
        })

        // Reload the page to refresh companies data
        window.location.reload()
      }
    } catch (error) {
      console.error("Error deleting company:", error)
      toast({
        title: "Error",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {companies.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No companies yet</h3>
          <p className="text-muted-foreground mb-4">Add your first company to start creating documents</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Company</DialogTitle>
                <DialogDescription>
                  Enter your company details. You can add up to {maxCompanies} companies with your current plan.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g., Acme Inc"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCompany} disabled={isSubmitting || !newCompanyName.trim()}>
                  {isSubmitting ? "Adding..." : "Add Company"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm">
              {companies.length} of {maxCompanies} companies
            </p>

            {companies.length < maxCompanies ? (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Company
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                    <DialogDescription>
                      Enter your company details. You can add up to {maxCompanies} companies with your current plan.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        placeholder="e.g., Acme Inc"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCompany} disabled={isSubmitting || !newCompanyName.trim()}>
                      {isSubmitting ? "Adding..." : "Add Company"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button disabled>
                <Lock className="mr-2 h-4 w-4" />
                Limit Reached
              </Button>
            )}
          </div>

          {companies.length >= maxCompanies && !isPremium && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Company limit reached</AlertTitle>
              <AlertDescription>
                You've reached the limit of {maxCompanies} companies on the free plan.
                <Button variant="link" className="h-auto p-0 ml-1" asChild>
                  <a href="/settings/account">Upgrade to Premium</a>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <RadioGroup value={defaultCompanyId} onValueChange={handleSetDefaultCompany} className="space-y-4">
            {companies.map((company) => (
              <div key={company.id} className="flex items-start space-x-2">
                <RadioGroupItem value={company.id} id={company.id} className="mt-1" />
                <div className="flex-1">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{company.name}</CardTitle>
                          <CardDescription>
                            {company.isDefault && (
                              <span className="flex items-center text-primary text-xs">
                                <Check className="h-3 w-3 mr-1" /> Default company
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCompany(company.id)}
                          disabled={companies.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete company</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Label
                        htmlFor={company.id}
                        className="flex items-center justify-between cursor-pointer p-2 hover:bg-muted rounded-md"
                      >
                        <span>Set as default company</span>
                        {company.isDefault && <Check className="h-4 w-4 text-primary" />}
                      </Label>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </RadioGroup>
        </>
      )}
    </div>
  )
}

