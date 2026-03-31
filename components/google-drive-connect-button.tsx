"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { getGoogleDriveAccessTokenKey, GOOGLE_DRIVE_TOKEN_INVALID_EVENT } from "@/lib/env-public"
import { Cloud, Loader2 } from "lucide-react"

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  const w = window as unknown as { google?: { accounts?: { oauth2?: unknown } } }
  if (w.google?.accounts?.oauth2) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("GSI script failed")))
      return
    }
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("GSI script failed"))
    document.body.appendChild(s)
  })
}

type Props = {
  onConnected?: () => void
  className?: string
}

export function GoogleDriveConnectButton({ onConnected, className }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const [gsiReady, setGsiReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const key = getGoogleDriveAccessTokenKey()
    const sync = () => setConnected(!!sessionStorage.getItem(key))
    sync()
    window.addEventListener(GOOGLE_DRIVE_TOKEN_INVALID_EVENT, sync)
    return () => window.removeEventListener(GOOGLE_DRIVE_TOKEN_INVALID_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!clientId) return
    loadGsiScript()
      .then(() => setGsiReady(true))
      .catch(() => {
        toast({
          title: "Google sign-in",
          description: "Could not load Google script.",
          variant: "destructive",
        })
      })
  }, [clientId])

  const connect = useCallback(() => {
    if (!clientId || !gsiReady) return
    const w = window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (opts: {
              client_id: string
              scope: string
              prompt?: string
              callback: (r: {
                access_token?: string
                error?: string
                error_description?: string
              }) => void
            }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void }
          }
        }
      }
    }
    const oauth2 = w.google?.accounts?.oauth2
    if (!oauth2) {
      toast({ title: "Google Drive", description: "Google script not ready yet.", variant: "destructive" })
      return
    }

    setConnecting(true)
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp) => {
        setConnecting(false)
        if (resp.error) {
          const base = [resp.error_description, resp.error].filter(Boolean).join(" — ") || "OAuth failed"
          const originHint =
            resp.error === "redirect_uri_mismatch" ||
            /redirect_uri|origin|OAuth 2\.0/i.test(String(resp.error_description ?? ""))
              ? ` Add this exact origin under Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client → Authorized JavaScript origins: ${typeof window !== "undefined" ? window.location.origin : "(this page origin)"}. Save and wait ~1 minute.`
              : ""
          toast({
            title: "Google Drive",
            description: base + originHint,
            variant: "destructive",
          })
          return
        }
        if (resp.access_token) {
          sessionStorage.setItem(getGoogleDriveAccessTokenKey(), resp.access_token)
          setConnected(true)
          onConnected?.()
          toast({
            title: "Google Drive connected",
            description: "Uploads to Drive from this app use this browser session (costs, invoices, receipts).",
          })
        }
      },
    })
    client.requestAccessToken()
  }, [clientId, gsiReady, onConnected])

  if (!clientId) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      title={connected ? "Click to refresh your Google session if uploads fail" : undefined}
      onClick={connect}
      disabled={!gsiReady || connecting}
    >
      {connecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting…
        </>
      ) : connected ? (
        <>
          <Cloud className="mr-2 h-4 w-4 text-green-600" />
          Drive linked
        </>
      ) : (
        <>
          <Cloud className="mr-2 h-4 w-4" />
          Connect Google Drive
        </>
      )}
    </Button>
  )
}
