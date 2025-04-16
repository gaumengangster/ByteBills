"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Facebook, Linkedin, Twitter, PhoneIcon as WhatsApp } from "lucide-react"

type ShareInvoiceDialogProps = {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
}

export function ShareInvoiceDialog({ isOpen, onClose, invoiceId, invoiceNumber }: ShareInvoiceDialogProps) {
  // In a real app, this would be a public URL to view the invoice
  const shareUrl = `https://bytebills.app/view/${invoiceId}`

  const [activeTab, setActiveTab] = useState("link")

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    toast({
      title: "Link copied",
      description: "The invoice link has been copied to your clipboard.",
    })
  }

  const shareOnSocialMedia = (platform: string) => {
    let url = ""
    const text = `Check out invoice ${invoiceNumber}`

    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
        break
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
        break
      case "linkedin":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
        break
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(`${text}: ${shareUrl}`)}`
        break
    }

    if (url) {
      window.open(url, "_blank")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Invoice</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Copy Link</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-link">Share Link</Label>
                <div className="flex gap-2">
                  <Input id="share-link" value={shareUrl} readOnly className="flex-1" />
                  <Button onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Anyone with this link can view the invoice without logging in.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="social" className="py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => shareOnSocialMedia("twitter")}
              >
                <Twitter className="h-5 w-5" />
                Twitter
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => shareOnSocialMedia("facebook")}
              >
                <Facebook className="h-5 w-5" />
                Facebook
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => shareOnSocialMedia("linkedin")}
              >
                <Linkedin className="h-5 w-5" />
                LinkedIn
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => shareOnSocialMedia("whatsapp")}
              >
                <WhatsApp className="h-5 w-5" />
                WhatsApp
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
