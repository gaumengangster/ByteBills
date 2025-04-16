import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

type EmailData = {
  to: string
  subject: string
  message: string
  attachmentUrl?: string
  invoiceId?: string
  userId: string
}

export async function sendEmail(emailData: EmailData): Promise<string> {
  try {
    // In a real app, you would integrate with an email service like SendGrid, Mailgun, etc.
    // For now, we'll just store the email in Firestore to simulate sending

    const emailRef = await addDoc(collection(db, "bytebills-emails"), {
      ...emailData,
      status: "pending",
      createdAt: serverTimestamp(),
    })

    // In production, you would trigger a cloud function or API route to send the actual email

    return emailRef.id
  } catch (error) {
    console.error("Error sending email:", error)
    throw new Error("Failed to send email")
  }
}

export function getEmailTemplate(invoiceNumber: string, companyName: string, amount: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #4f46e5;">
        <h2 style="margin: 0; color: #333;">Invoice ${invoiceNumber}</h2>
      </div>
      
      <div style="padding: 20px;">
        <p>Dear Client,</p>
        
        <p>Please find attached the invoice ${invoiceNumber} from ${companyName} for the amount of ${amount}.</p>
        
        <p>If you have any questions regarding this invoice, please don't hesitate to contact us.</p>
        
        <p>Thank you for your business!</p>
        
        <p>Best regards,<br>${companyName}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated email. Please do not reply directly to this message.</p>
      </div>
    </div>
  `
}
