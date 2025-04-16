"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { sendEmail, getEmailTemplate } from "@/lib/email-service"
import { generateInvoicePDF } from "@/lib/pdf-service"
import { Loader2, Mail } from "lucide-react"

type EmailInvoiceDialogProps = {
  isOpen: boolean
  onClose: () => void
  invoice: any
  userId: string
}

export function EmailInvoiceDialog({ isOpen, onClose, invoice, userId }: EmailInvoiceDialogProps) {
  const [emailData, setEmailData] = useState({
    to: invoice.clientDetails.email || "",
    subject: `Invoice ${invoice.invoiceNumber} from ${invoice.companyDetails.name}`,
    message: getEmailTemplate(
      invoice.invoiceNumber,
      invoice.companyDetails.name,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(invoice.total),
    ),
  })
  const [attachPdf, setAttachPdf] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEmailData({
      ...emailData,
      [name]: value,
    })
  }

  const handleSend = async () => {
    if (!emailData.to) {
      toast({
        title: "Email required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)

    try {
      let attachmentUrl = undefined

      if (attachPdf) {
        // In a real app, you would:
        // 1. Generate the PDF
        // 2. Upload it to storage (Firebase Storage, S3, etc.)
        // 3. Get the download URL
        // For now, we'll just simulate this process

        // Generate PDF
        await generateInvoicePDF(invoice)

        // Simulate a URL for the attachment
        attachmentUrl = `https://storage.example.com/invoices/${invoice.id}.pdf`
      }

      // Send the email
      await sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        attachmentUrl,
        invoiceId: invoice.id,
        userId,
      })

      toast({
        title: "Email sent",
        description: `Invoice has been sent to ${emailData.to}.`,
      })

      onClose()
    } catch (error) {
      console.error("Error sending email:", error)
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Invoice to Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">Recipient Email</Label>
            <Input
              id="to"
              name="to"
              type="email"
              value={emailData.to}
              onChange={handleInputChange}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" value={emailData.subject} onChange={handleInputChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              value={emailData.message}
              onChange={handleInputChange}
              rows={8}
              className="min-h-[150px]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="attach-pdf" checked={attachPdf} onCheckedChange={(checked) => setAttachPdf(!!checked)} />
            <Label htmlFor="attach-pdf" className="cursor-pointer">
              Attach invoice as PDF
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
