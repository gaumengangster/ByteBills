"use client"

import type React from "react"

import { useState } from "react"
import {
  type User,
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Check, CreditCard, Loader2, Shield, UserIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type AccountSettingsProps = {
  user: User
  userData: any
  loading: boolean
}

export function AccountSettings({ user, userData, loading }: AccountSettingsProps) {
  const [formData, setFormData] = useState({
    displayName: user.displayName || "",
    email: user.email || "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("")
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)

  const isPremium = userData?.plan === "premium"

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData({
      ...passwordData,
      [name]: value,
    })
  }

  const saveProfileChanges = async () => {
    if (!formData.displayName.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter your name.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, {
          displayName: formData.displayName,
        })
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const changeEmail = async () => {
    if (!user.email) return

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPasswordForEmail)
      await reauthenticateWithCredential(user, credential)

      await updateEmail(user, formData.email)

      // Update email in Firestore
      if (user.uid) {
        const userRef = doc(db, "bytebills-users", user.uid)
        await updateDoc(userRef, {
          email: formData.email,
        })
      }

      setEmailDialogOpen(false)
      setCurrentPasswordForEmail("")

      toast({
        title: "Email updated",
        description: "Your email has been updated successfully.",
      })
    } catch (error: any) {
      console.error("Error changing email:", error)
      if (error.code === "auth/wrong-password") {
        toast({
          title: "Incorrect password",
          description: "The password you entered is incorrect.",
          variant: "destructive",
        })
      } else if (error.code === "auth/email-already-in-use") {
        toast({
          title: "Email already in use",
          description: "This email is already associated with another account.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update email. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const changePassword = async () => {
    if (!user.email) return

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password should be at least 6 characters.",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword)
      await reauthenticateWithCredential(user, credential)

      await updatePassword(user, passwordData.newPassword)

      setPasswordDialogOpen(false)
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      })
    } catch (error: any) {
      console.error("Error changing password:", error)
      if (error.code === "auth/wrong-password") {
        toast({
          title: "Incorrect password",
          description: "Your current password is incorrect.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update password. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const upgradeToPremium = () => {
    // This would be connected to your payment gateway in production
    setSubscriptionDialogOpen(false)
    toast({
      title: "Premium upgrade",
      description: "This is a demo feature. In a real application, this would connect to a payment gateway.",
    })
  }

  if (loading) {
    return <div className="text-center py-4">Loading account data...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            <CardTitle>Profile Information</CardTitle>
          </div>
          <CardDescription>Update your account profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Full Name</Label>
            <Input id="display-name" name="displayName" value={formData.displayName} onChange={handleInputChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled
              />
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Change</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Email</DialogTitle>
                    <DialogDescription>Enter your new email address and current password to confirm.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-email">New Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="current-password-for-email">Current Password</Label>
                      <Input
                        id="current-password-for-email"
                        type="password"
                        value={currentPasswordForEmail}
                        onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={changeEmail} disabled={!formData.email || !currentPasswordForEmail}>
                      Update Email
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveProfileChanges} disabled={isSaving}>
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
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Update your security settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Password</h4>
                <p className="text-sm text-muted-foreground">Change your account password</p>
              </div>
              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Change Password</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>Enter your current password and a new password.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordInputChange}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={changePassword}
                      disabled={
                        isChangingPassword ||
                        !passwordData.currentPassword ||
                        !passwordData.newPassword ||
                        !passwordData.confirmPassword
                      }
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Subscription</CardTitle>
          </div>
          <CardDescription>Manage your subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Current Plan</h4>
              <p className="text-sm text-muted-foreground">{isPremium ? "Premium Plan" : "Free Plan"}</p>
            </div>

            {!isPremium && (
              <Alert>
                <AlertTitle>Free Plan Limitations</AlertTitle>
                <AlertDescription>
                  Your free plan includes up to 3 companies. Upgrade to Premium for unlimited companies and additional
                  features.
                </AlertDescription>
              </Alert>
            )}

            {isPremium ? (
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Premium Features</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-1">
                    <li>Unlimited companies</li>
                    <li>Advanced reporting</li>
                    <li>Priority support</li>
                    <li>Custom branding</li>
                  </ul>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Cancel Subscription</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Canceling your subscription will downgrade your account to the free plan at the end of your
                        current billing period.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Nevermind</AlertDialogCancel>
                      <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Premium Features</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-1">
                    <li>Unlimited companies</li>
                    <li>Advanced reporting</li>
                    <li>Priority support</li>
                    <li>Custom branding</li>
                  </ul>
                </div>
                <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>Upgrade to Premium</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upgrade to Premium</DialogTitle>
                      <DialogDescription>
                        Upgrade to our Premium plan for unlimited companies and additional features.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="rounded-lg border p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">Premium Plan</h3>
                          <p className="font-bold">$9.99/month</p>
                        </div>
                        <ul className="text-sm space-y-1">
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            Unlimited companies
                          </li>
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            Advanced reporting
                          </li>
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            Priority support
                          </li>
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            Custom branding
                          </li>
                        </ul>
                      </div>
                      <p className="text-sm text-muted-foreground">You can cancel your subscription at any time.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSubscriptionDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={upgradeToPremium}>Upgrade Now</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

