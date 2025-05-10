import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="container mx-auto py-6 flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
