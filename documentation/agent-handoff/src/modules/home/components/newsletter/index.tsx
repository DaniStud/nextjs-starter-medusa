"use client"

import { useState } from "react"
import { t } from "@lib/i18n"
import Image from "next/image"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000"

const Newsletter = () => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim()) {
      setStatus("error")
      setMessage(t("home.newsletter.fillBothFields"))
      return
    }

    setStatus("loading")
    setMessage("")

    try {
      const res = await fetch(
        `${MEDUSA_BACKEND_URL}/store/newsletter/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key":
              process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
          },
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        }
      )

      const data = await res.json()

      if (res.ok) {
        setStatus("success")
        setMessage(t("home.newsletter.success"))
        setName("")
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.message || t("home.newsletter.error"))
      }
    } catch {
      setStatus("error")
      setMessage(t("home.newsletter.error"))
    }
  }
  return (
    <section className="mb-32 mt-24 w-full max-w-[90vw] md:max-w-[66vw] mx-auto border-t border-ui-border-base flex flex-col small:flex-row small:grid small:grid-cols-2">
      {/* Left Column – Image Pane */}
      <div className="w-full overflow-hidden">
        <Image
          src="/images/newsletter-bg.png"
          alt={t("home.newsletter.imageAlt")}
          width={800}
          height={1200}
          className="w-full h-full object-cover max-h-[66vh] md:min-h-[1100px]"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>

      {/* Right Column – Form Pane */}
      <div className="flex flex-col justify-center p-8 small:p-16 bg-[#f6f6f6]">
        <div className="mx-auto">


        <h2 className="text-3xl small:text-4xl font-heading font-bold text-black mb-4">
          {t("home.newsletter.heading")}
        </h2>
        <p className="text-base text-gray-800 mb-8 max-w-md">
          {t("home.newsletter.body")}
        </p>

        <form className="w-full max-w-md" onSubmit={handleSubmit}>
          {/* Name Field */}
          <div className="mb-4">
            <label
              htmlFor="newsletter-name"
              className="block text-sm font-bold text-gray-900 mb-2"
            >
              {t("home.newsletter.nameLabel")}
            </label>
            <input
              type="text"
              id="newsletter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === "loading"}
              className="w-full border border-gray-300 bg-white p-3 text-sm outline-none focus:border-black transition-colors disabled:opacity-50"
            />
          </div>

          {/* Email Field */}
          <div className="mb-6">
            <label
              htmlFor="newsletter-email"
              className="block text-sm font-bold text-gray-900 mb-2"
            >
              {t("home.newsletter.emailLabel")}
            </label>
            <input
              type="email"
              id="newsletter-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              className="w-full border border-gray-300 bg-white p-3 text-sm outline-none focus:border-black transition-colors disabled:opacity-50"
            />
          </div>

          {/* Feedback Message */}
          {message && (
            <p
              className={`mb-4 text-sm ${
                status === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full sm:w-auto bg-brand text-white px-10 py-3 text-sm font-medium border border-brand rounded-full hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" ? t("home.newsletter.subscribing") : t("home.newsletter.subscribe")}
          </button>
        </form>
      </div>
              </div>
    </section>
  )
}

export default Newsletter
