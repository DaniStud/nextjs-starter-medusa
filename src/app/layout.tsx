import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

import CookieConsentBanner from "../cookieConsent"
import Footer from "@modules/layout/templates/footer"



export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body className="flex flex-col min-h-screen">
        <CookieConsentBanner />
        <main className="flex-grow relative">{props.children}</main>
        <Footer />
      </body>
    </html>
  )
}
