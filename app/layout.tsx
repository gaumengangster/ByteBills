import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from "@vercel/analytics/next"
import { AppFooter } from "@/components/app-footer"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ByteBills - Quick Invoicing",
  description: "Create or generate invoices, receipts, delivery notes and more with ByteBills",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <AppFooter />
            </div>
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

