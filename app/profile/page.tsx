"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { AccountSettings } from "@/components/settings/account-settings"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { CalendarDays, Mail } from "lucide-react"

export default function ProfilePage() {
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
                const userDoc = await getDoc(doc(db, "bytebills-users", user.uid))
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

    const initials = user.displayName
        ? user.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email?.charAt(0).toUpperCase() || "U"

    const memberSince = user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : null

    const isPremium = userData?.plan === "premium"

    return (
        <>
            <Navbar />
            <main className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">View and manage your account</p>
                </div>

                <Card className="mb-8">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <Avatar className="h-20 w-20 text-2xl">
                                <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-semibold">{user.displayName || "User"}</h2>
                                    <Badge variant={isPremium ? "default" : "secondary"}>
                                        {loadingUserData ? "..." : isPremium ? "Premium" : "Free Plan"}
                                    </Badge>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 text-sm text-muted-foreground mt-2">
                                    <span className="inline-flex items-center justify-center sm:justify-start gap-1.5">
                                        <Mail className="h-4 w-4" />
                                        {user.email}
                                    </span>
                                    {memberSince && (
                                        <span className="inline-flex items-center justify-center sm:justify-start gap-1.5">
                                            <CalendarDays className="h-4 w-4" />
                                            Member since {memberSince}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Separator className="my-8" />

                <AccountSettings user={user} userData={userData} loading={loadingUserData} />
            </main>
        </>
    )
}

