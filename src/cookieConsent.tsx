// app/components/CookieConsent.tsx
"use client";

import React, { useEffect } from "react";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import * as CookieConsent from "vanilla-cookieconsent";

export default function CookieConsentBanner() {
  const [fallbackVisible, setFallbackVisible] = React.useState(false)
  const [analytics, setAnalytics] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)

  useEffect(() => {
    // Run vanilla-cookieconsent if available; otherwise show fallback modal
    try {
      if (typeof window === "undefined") return

      // If cookie already set, do nothing
      const hasConsent = document.cookie.match(/(?:^|; )cookie_consent=([^;]+)/)
      if (hasConsent) return

      CookieConsent.run({
        categories: {
          necessary: { enabled: true, readOnly: true },
          analytics: {},
          marketing: {},
        },
        language: {
          default: "en",
          translations: {
            en: {
              consentModal: {
                title: "We use cookies",
                description: "We use cookies to improve your experience. Analytics and marketing cookies are optional.",
                acceptAllBtn: "Accept all",
                acceptNecessaryBtn: "Reject non-essential",
                showPreferencesBtn: "Manage preferences",
              },
              preferencesModal: {
                title: "Cookie preferences",
                acceptAllBtn: "Accept all",
                acceptNecessaryBtn: "Reject non-essential",
                savePreferencesBtn: "Save preferences",
                sections: [
                  { title: "Necessary cookies", description: "Required for the store to function.", linkedCategory: "necessary" },
                  { title: "Analytics", linkedCategory: "analytics" },
                  { title: "Marketing", linkedCategory: "marketing" },
                ],
              },
            },
          },
        },
      })
    } catch (e) {
      // If vanilla-cookieconsent fails to initialize, show React fallback modal
      // (useful during development or if bundling blocks the lib)
      // eslint-disable-next-line no-console
      console.warn("vanilla-cookieconsent failed, using fallback", e)
      setFallbackVisible(true)
    }
  }, [])

  // Fallback handlers (persist to same cookie key used by library)
  const setCookie = (value: string) => {
    const expires = new Date()
    expires.setDate(expires.getDate() + 365)
    document.cookie = `cookie_consent=${encodeURIComponent(value)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  }

  const acceptAllFallback = () => {
    setCookie(JSON.stringify({ necessary: true, analytics: true, marketing: true }))
    setFallbackVisible(false)
  }

  const rejectNonEssentialFallback = () => {
    setCookie(JSON.stringify({ necessary: true, analytics: false, marketing: false }))
    setFallbackVisible(false)
  }

  if (!fallbackVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setFallbackVisible(false)} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-[90%] p-6">
        <h3 className="text-lg font-semibold">We use cookies</h3>
        <p className="mt-2 text-sm text-neutral-600">We use cookies to improve your experience. Analytics and marketing cookies are optional.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={acceptAllFallback} className="px-4 py-2 bg-ui-foreground text-white rounded">Accept all</button>
          <button onClick={rejectNonEssentialFallback} className="px-4 py-2 border rounded">Reject non-essential</button>
        </div>
      </div>
    </div>
  )
}
