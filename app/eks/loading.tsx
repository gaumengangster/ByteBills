import { Navbar } from "@/components/navbar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function EksLoading() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-8" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[420px] w-full" />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
