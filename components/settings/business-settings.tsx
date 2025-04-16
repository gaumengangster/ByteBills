"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { Check, Image, Loader2, Trash2, Upload } from "lucide-react"
import countryList from "react-select-country-list"

type BusinessSettingsProps = {
  selectedCompany: any
  companies: any[]
  userId: string
}

export function BusinessSettings({ selectedCompany, companies, userId }: BusinessSettingsProps) {
  const [company, setCompany] = useState<any>(selectedCompany)
  const [companyId, setCompanyId] = useState(selectedCompany?.id)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(selectedCompany?.logo || null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isLogoDeleteDialogOpen, setIsLogoDeleteDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: selectedCompany?.name || "",
    businessDetails: {
      address: selectedCompany?.businessDetails?.address || "",
      city: selectedCompany?.businessDetails?.city || "",
      country: selectedCompany?.businessDetails?.country || "US",
      email: selectedCompany?.businessDetails?.email || "",
      phone: selectedCompany?.businessDetails?.phone || "",
      website: selectedCompany?.businessDetails?.website || "",
      taxNumber: selectedCompany?.businessDetails?.taxNumber || "",
    },
  })

  const countries = countryList().getData()

  useEffect(() => {
    if (companyId) {
      const selected = companies.find((c) => c.id === companyId)
      if (selected) {
        setCompany(selected)
        setLogoPreview(selected.logo || null)
        setFormData({
          name: selected.name || "",
          businessDetails: {
            address: selected.businessDetails?.address || "",
            city: selected.businessDetails?.city || "",
            country: selected.businessDetails?.country || "UG",
            email: selected.businessDetails?.email || "",
            phone: selected.businessDetails?.phone || "",
            website: selected.businessDetails?.website || "",
            taxNumber: selected.businessDetails?.taxNumber || "",
          },
        })
      }
    }
  }, [companyId, companies])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Logo image must be less than 5MB",
          variant: "destructive",
        })
        return
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive",
        })
        return
      }

      setLogo(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const uploadLogo = async () => {
    if (!logo) return null

    setIsUploading(true)

    try {
      const logoRef = ref(storage, `bytebills-companies/${userId}/${companyId}/logo/${logo.name}`)
      const uploadTask = uploadBytesResumable(logoRef, logo)

      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            setUploadProgress(progress)
          },
          (error) => {
            console.error("Upload error:", error)
            reject(error)
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(downloadURL)
          },
        )
      })
    } catch (error) {
      console.error("Error uploading logo:", error)
      throw error
    }
  }

  const deleteLogo = async () => {
    if (!company.logo) return

    try {
      // Extract the filename from the URL
      const logoUrl = new URL(company.logo)
      const pathWithoutQuery = logoUrl.pathname.split("?")[0]
      const filePath = decodeURIComponent(pathWithoutQuery.replace(/^\/o\//, ""))

      // Create a reference to the file and delete it
      const logoRef = ref(storage, filePath)
      await deleteObject(logoRef)

      return true
    } catch (error) {
      console.error("Error deleting logo:", error)
      throw error
    }
  }

  const handleLogoDelete = async () => {
    try {
      await deleteLogo()

      // Update company data
      const userRef = doc(db, "bytebills-users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const updatedCompanies = userData.companies.map((c: any) => {
          if (c.id === companyId) {
            return {
              ...c,
              logo: null,
            }
          }
          return c
        })

        await updateDoc(userRef, {
          companies: updatedCompanies,
        })

        setLogoPreview(null)
        setLogo(null)

        toast({
          title: "Logo deleted",
          description: "Company logo has been removed successfully.",
        })
      }
    } catch (error) {
      console.error("Error in handleLogoDelete:", error)
      toast({
        title: "Error",
        description: "Failed to delete logo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLogoDeleteDialogOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent as keyof typeof formData],
          [child]: value,
        },
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleSelectChange = (value: string, name: string) => {
    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent as keyof typeof formData],
          [child]: value,
        },
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Upload logo if changed
      let logoUrl = company.logo
      if (logo) {
        logoUrl = await uploadLogo()
      }

      // Update company data
      const userRef = doc(db, "bytebills-users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        const updatedCompanies = userData.companies.map((c: any) => {
          if (c.id === companyId) {
            return {
              ...c,
              name: formData.name,
              logo: logoUrl,
              businessDetails: formData.businessDetails,
            }
          }
          return c
        })

        await updateDoc(userRef, {
          companies: updatedCompanies,
        })

        toast({
          title: "Settings saved",
          description: "Business details have been updated successfully.",
        })

        // Reset logo state
        setLogo(null)
        setUploadProgress(0)
      }
    } catch (error) {
      console.error("Error saving business settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {companies.length > 1 && (
        <div className="mb-6">
          <Label htmlFor="company-select">Select Company</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                  {company.isDefault && " (Default)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <Label>Company Logo</Label>
                <div className="flex items-center mt-2 space-x-4">
                  <div className="relative w-24 h-24 border rounded-md flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview || "/placeholder.svg"}
                        alt="Company logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Image className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          {logoPreview ? "Change Logo" : "Upload Logo"}
                        </label>
                      </Button>
                      <Input
                        id="logo-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoChange}
                      />

                      {logoPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => setIsLogoDeleteDialogOpen(true)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">Recommended: 200x200px. Max 5MB.</p>

                    {isUploading && (
                      <div className="w-full">
                        <div className="h-1 w-full bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Uploading: {Math.round(uploadProgress)}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input id="company-name" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-address">Address</Label>
                <Textarea
                  id="business-address"
                  name="businessDetails.address"
                  value={formData.businessDetails.address}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-city">City</Label>
                  <Input
                    id="business-city"
                    name="businessDetails.city"
                    value={formData.businessDetails.city}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-country">Country</Label>
                  <Select
                    value={formData.businessDetails.country}
                    onValueChange={(value) => handleSelectChange(value, "businessDetails.country")}
                  >
                    <SelectTrigger id="business-country">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-email">Email (optional)</Label>
                  <Input
                    id="business-email"
                    type="email"
                    name="businessDetails.email"
                    value={formData.businessDetails.email}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-phone">Phone</Label>
                  <Input
                    id="business-phone"
                    name="businessDetails.phone"
                    value={formData.businessDetails.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-website">Website (optional)</Label>
                  <Input
                    id="business-website"
                    name="businessDetails.website"
                    value={formData.businessDetails.website}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-tax">Tax/VAT Number (optional)</Label>
                  <Input
                    id="business-tax"
                    name="businessDetails.taxNumber"
                    value={formData.businessDetails.taxNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={isLogoDeleteDialogOpen} onOpenChange={setIsLogoDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete your company logo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

