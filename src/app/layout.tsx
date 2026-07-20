import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Space_Grotesk, Inter } from "next/font/google"
import "styles/globals.css"

import CookieConsentBanner from "../cookieConsent"
import Footer from "@modules/layout/templates/footer"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: process.env.NEXT_PUBLIC_BRAND_NAME || "10SHIRTS",
  icons: {
    icon: process.env.NEXT_PUBLIC_LOGO_URL || "/images/10shirt-logo.png",
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const brandColor = process.env.NEXT_PUBLIC_BRAND_COLOR || "#ed1d27"

  return (
    <html lang="da" className={`${spaceGrotesk.variable} ${inter.variable}`} style={{ "--tenant-brand-color": brandColor } as React.CSSProperties}>
      <body className="flex flex-col min-h-screen font-sans">
        <CookieConsentBanner />
        <main className="flex-grow relative">{props.children}</main>
        <Footer />
      </body>
    </html>
  )
}
