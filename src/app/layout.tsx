import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"
import CookieConsentBanner from "../cookieConsent"



export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <CookieConsentBanner />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
