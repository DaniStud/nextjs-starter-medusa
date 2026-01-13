"use client"

import React from "react"
import { Text } from "@medusajs/ui"

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-semibold mb-4">Terms & Conditions</h1>
      <Text className="mb-6">
        This is the Terms. Replace this copy with your full
        policy.
      </Text>
      <section>
        <h2 className="text-xl font-medium mb-2">Information We Collect</h2>
        <Text>Describe what you collect and why.</Text>
      </section>
    </main>
  )
}
