import type React from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToastProps = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function generateId() {
  return `${count++}`
}

// Simple toast implementation for the example
export function toast({
  title,
  description,
  variant,
}: {
  title: string
  description: string
  variant?: "default" | "destructive"
}) {
  const id = generateId()

  const toastData = {
    id,
    title,
    description,
    variant,
  }

  // In a real implementation, this would dispatch to a toast store
  console.log("Toast:", toastData)

  // Show a browser alert for demo purposes
  alert(`${title}: ${description}`)

  return toastData
}

