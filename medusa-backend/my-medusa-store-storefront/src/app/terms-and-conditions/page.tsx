"use client"

import React from "react"
import { Text } from "@medusajs/ui"

export default function TermsAndConditionsPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-semibold mb-4">Terms and Conditions</h1>
      <Text className="mb-6">
        This is the Terms and Conditions page. Replace this copy with your
        full terms and conditions.
      </Text>
      <section>
        <h2 className="text-xl font-medium mb-2">Usage</h2>
        <Text>Describe rules for using your site.</Text>
      </section>
    </main>
  )
}
