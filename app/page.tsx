import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, FileText, Receipt, TruckIcon, BarChart3, Settings, CheckCircle } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background pt-16 pb-24">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <div className="mb-8 animate-fade-in">
            <Image src="/LOGO-NO-BG.png" alt="ByteBills Logo" width={180} height={180} className="mx-auto" priority />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 animate-fade-in">
            Welcome to <span className="text-primary">ByteBills</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in">
            The all-in-one solution for creating professional invoices, receipts, delivery notes, and tracking your
            business performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
            <Button asChild size="lg" className="px-8">
              <Link href="/auth/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/reports">
                View Reports <BarChart3 className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-4 md:left-12 w-24 h-24 rounded-full bg-primary/5 -z-10"></div>
        <div className="absolute bottom-1/4 right-4 md:right-12 w-32 h-32 rounded-full bg-primary/5 -z-10"></div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ByteBills provides all the tools you need to manage your business documents efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              title="Invoices"
              description="Create professional invoices for your clients with customizable templates and automatic calculations."
              icon={<FileText className="h-6 w-6" />}
              href="/invoices"
            />
            <FeatureCard
              title="Receipts"
              description="Generate detailed receipts for payments received, with support for multiple payment methods."
              icon={<Receipt className="h-6 w-6" />}
              href="/receipts"
            />
            <FeatureCard
              title="Delivery Notes"
              description="Create delivery notes for your shipments with item tracking and delivery confirmation."
              icon={<TruckIcon className="h-6 w-6" />}
              href="/delivery-notes"
            />
            <FeatureCard
              title="Reports"
              description="View comprehensive statistics and reports of your business activities with visual charts."
              icon={<BarChart3 className="h-6 w-6" />}
              href="/reports"
            />
            <FeatureCard
              title="Settings"
              description="Configure your business details, preferences, and customize your document templates."
              icon={<Settings className="h-6 w-6" />}
              href="/settings"
            />
            <Card className="bg-primary/5 border-primary/20 transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-6 w-6" />
                  <CardTitle>Premium Features</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-foreground/80">
                  Coming soon: Custom branding, advanced analytics, and more premium features.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10">
                  Stay Tuned
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Choose ByteBills?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform offers numerous benefits to streamline your business operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <BenefitCard
              title="Save Time"
              description="Automate document creation and calculations to save hours of manual work."
            />
            <BenefitCard
              title="Professional Image"
              description="Present a professional image to your clients with beautifully designed documents."
            />
            <BenefitCard
              title="Stay Organized"
              description="Keep all your business documents organized in one secure place."
            />
            <BenefitCard
              title="Track Performance"
              description="Monitor your business performance with detailed reports and analytics."
            />
            <BenefitCard
              title="Easy to Use"
              description="Intuitive interface designed for business owners, not accountants."
            />
            <BenefitCard
              title="Accessible Anywhere"
              description="Access your documents from any device, anywhere, anytime."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-b from-background to-primary/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Join thousands of businesses already using ByteBills to streamline their document management.
          </p>
          <Button asChild size="lg" className="px-8">
            <Link href="/auth/login">
              Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
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
    <Card className="transition-all hover:shadow-md hover:translate-y-[-5px] duration-300">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-foreground/70">{description}</CardDescription>
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

function BenefitCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-background rounded-lg p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
