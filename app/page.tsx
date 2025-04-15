/* import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, Receipt, Truck, FileBarChart, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <FileText className="h-6 w-6 text-primary" />
            <span>ByteBills</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="container py-12 md:py-24 lg:py-32">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Create professional invoices and receipts in seconds
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              ByteBills helps you generate invoices, receipts, delivery notes, and proforma invoices with ease. 
              Track your business documents and get detailed reports.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="gap-1.5">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </section>
        
        <section id="features" className="container py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="mx-auto grid max-w-5xl gap-8 md:gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Invoices & Proforma</h3>
              <p className="text-muted-foreground">
                Create professional invoices and proforma invoices with your business details, 
                logo, and custom line items. Download, share, or print instantly.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Receipts</h3>
              <p className="text-muted-foreground">
                Generate receipts with automatic amount-to-words conversion. 
                Keep track of payments and balances for all your clients.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Delivery Notes</h3>
              <p className="text-muted-foreground">
                Create detailed delivery notes with order information, 
                delivery dates, and item quantities for smooth logistics.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileBarChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Reports & Analytics</h3>
              <p className="text-muted-foreground">
                Get insights into your business with detailed reports. 
                Track document generation over custom time periods.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ByteBills. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
 */

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, FileText, Receipt, TruckIcon, BarChart3, Settings } from "lucide-react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to ByteBills</h1>
          <p className="text-muted-foreground">Create invoices, receipts, delivery notes and more</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            title="Invoices"
            description="Create professional invoices for your clients"
            icon={<FileText className="h-6 w-6" />}
            href="/invoices"
          />
          <FeatureCard
            title="Receipts"
            description="Generate receipts for payments received"
            icon={<Receipt className="h-6 w-6" />}
            href="/receipts"
          />
          <FeatureCard
            title="Delivery Notes"
            description="Create delivery notes for your shipments"
            icon={<TruckIcon className="h-6 w-6" />}
            href="/delivery-notes"
          />
          <FeatureCard
            title="Reports"
            description="View statistics and reports of your documents"
            icon={<BarChart3 className="h-6 w-6" />}
            href="/reports"
          />
          <FeatureCard
            title="Settings"
            description="Configure your business details and preferences"
            icon={<Settings className="h-6 w-6" />}
            href="/settings"
          />
        </div>

        <div className="flex justify-center mt-8">
          <Button asChild size="lg">
            <Link href="/auth/login">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

function FeatureCard({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild className="w-full">
          <Link href={href}>
            Explore <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

