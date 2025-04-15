"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BusinessSettings } from "@/components/settings/business-settings"
import { CompanyList } from "@/components/settings/company-list"
import { AccountSettings } from "@/components/settings/account-settings"
import { AppSettings } from "@/components/settings/app-settings"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [loadingUserData, setLoadingUserData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoadingUserData(false)
      }
    }

    if (user) {
      fetchUserData()
    }
  }, [user])

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application settings</p>
        </div>

        <Tabs defaultValue="companies" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="business">Business Details</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="app">App Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Companies</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your companies. Free plan allows up to 3 companies.
                </p>
                <Separator className="my-4" />
              </div>

              {loadingUserData ? (
                <div className="text-center py-4">Loading company data...</div>
              ) : (
                <CompanyList
                  companies={userData?.companies || []}
                  isPremium={userData?.plan === "premium"}
                  userId={user.uid}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="business">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Business Details</h3>
                <p className="text-sm text-muted-foreground">
                  These details will appear on your invoices, receipts, and other documents.
                </p>
                <Separator className="my-4" />
              </div>

              {loadingUserData ? (
                <div className="text-center py-4">Loading business data...</div>
              ) : userData?.companies?.length > 0 ? (
                <BusinessSettings
                  selectedCompany={userData.companies[0]}
                  companies={userData.companies}
                  userId={user.uid}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No companies added yet. Please add a company first.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="account">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Account Settings</h3>
                <p className="text-sm text-muted-foreground">Manage your account details and subscription.</p>
                <Separator className="my-4" />
              </div>

              <AccountSettings user={user} userData={userData} loading={loadingUserData} />
            </div>
          </TabsContent>

          <TabsContent value="app">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">App Settings</h3>
                <p className="text-sm text-muted-foreground">Customize your app experience and preferences.</p>
                <Separator className="my-4" />
              </div>

              <AppSettings />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}

