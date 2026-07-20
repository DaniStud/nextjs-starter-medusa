"use client"

import { useState } from "react"
import { t } from "@lib/i18n"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000"

/**
 * Newsletter signup, restyled to Veon's clean centered aesthetic.
 * Submission logic and i18n keys are unchanged — still posts name + email
 * to the Medusa backend `/store/newsletter/subscribe` endpoint.
 */
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
    <section className="w-full bg-[#f6f6f6] py-20 small:py-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 text-center">
        <h2 className="mb-4 font-heading text-3xl font-bold uppercase tracking-tight text-gray-900 small:text-4xl">
          {t("home.newsletter.heading")}
        </h2>
        <p className="mb-10 max-w-lg text-base text-gray-600">
          {t("home.newsletter.body")}
        </p>

        <form className="w-full" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 small:flex-row">
            <div className="flex-1">
              <label htmlFor="newsletter-name" className="sr-only">
                {t("home.newsletter.nameLabel")}
              </label>
              <input
                type="text"
                id="newsletter-name"
                value={name}
                placeholder={t("home.newsletter.nameLabel")}
                onChange={(e) => setName(e.target.value)}
                disabled={status === "loading"}
                className="w-full rounded-full border border-gray-200 bg-white px-6 py-3.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="newsletter-email" className="sr-only">
                {t("home.newsletter.emailLabel")}
              </label>
              <input
                type="email"
                id="newsletter-email"
                value={email}
                placeholder={t("home.newsletter.emailLabel")}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                className="w-full rounded-full border border-gray-200 bg-white px-6 py-3.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full bg-brand px-10 py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading"
                ? t("home.newsletter.subscribing")
                : t("home.newsletter.subscribe")}
            </button>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm ${
                status === "success" ? "text-green-600" : "text-red-600"
              }`}
              role="status"
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

export default Newsletter
