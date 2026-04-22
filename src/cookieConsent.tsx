// app/components/CookieConsent.tsx
"use client";

import React, { useEffect } from "react";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import * as CookieConsent from "vanilla-cookieconsent";
import { t } from "@lib/i18n";

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
          default: "da",
          translations: {
            da: {
              consentModal: {
                title: t("cookies.consentModal.title"),
                description: t("cookies.consentModal.description"),
                acceptAllBtn: t("cookies.consentModal.acceptAllBtn"),
                acceptNecessaryBtn: t("cookies.consentModal.acceptNecessaryBtn"),
                showPreferencesBtn: t("cookies.consentModal.showPreferencesBtn"),
              },
              preferencesModal: {
                title: t("cookies.preferencesModal.title"),
                acceptAllBtn: t("cookies.preferencesModal.acceptAllBtn"),
                acceptNecessaryBtn: t("cookies.preferencesModal.acceptNecessaryBtn"),
                savePreferencesBtn: t("cookies.preferencesModal.savePreferencesBtn"),
                sections: [
                  { title: t("cookies.preferencesModal.sections.necessary"), description: t("cookies.preferencesModal.sections.necessaryDesc"), linkedCategory: "necessary" },
                  { title: t("cookies.preferencesModal.sections.analytics"), linkedCategory: "analytics" },
                  { title: t("cookies.preferencesModal.sections.marketing"), linkedCategory: "marketing" },
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
        <h3 className="text-lg font-semibold">{t("cookies.consentModal.title")}</h3>
        <p className="mt-2 text-sm text-neutral-600">{t("cookies.consentModal.description")}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={acceptAllFallback} className="px-4 py-2 bg-ui-foreground text-white rounded">{t("cookies.consentModal.acceptAllBtn")}</button>
          <button onClick={rejectNonEssentialFallback} className="px-4 py-2 border rounded">{t("cookies.consentModal.acceptNecessaryBtn")}</button>
        </div>
      </div>
    </div>
  )
}
