"use client"

import { useState } from "react"
import { t } from "@lib/i18n"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000"

const NewsletterForm = () => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setStatus("error")
      setMessage(t("newsletterForm.emailRequired"))
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
          body: JSON.stringify({ name: "", email: email.trim() }),
        }
      )

      const data = await res.json()

      if (res.ok) {
        setStatus("success")
        setMessage(t("newsletterForm.success"))
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.message || t("newsletterForm.error"))
      }
    } catch {
      setStatus("error")
      setMessage(t("newsletterForm.error"))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-y-3">
      <div className="flex flex-col small:flex-row gap-2">
        <input
          type="email"
          required
          placeholder={t("newsletterForm.placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="px-3 py-2 bg-stone-800 border border-stone-600 rounded text-stone-100 txt-compact-small placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400 w-full small:w-64"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 bg-white text-stone-900 rounded txt-compact-small font-semibold hover:bg-stone-200 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {status === "loading" ? t("newsletterForm.loading") : t("newsletterForm.subscribe")}
        </button>
      </div>
      {message && (
        <p
          className={`txt-compact-small ${
            status === "error" ? "text-red-400" : "text-stone-400"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  )
}

export default NewsletterForm
