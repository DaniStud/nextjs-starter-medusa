"use client"

import { Button, Heading, Text, Input, Label } from "@medusajs/ui"
import React, { useState } from "react"

const SimplePayment = () => {
    const [amount, setAmount] = useState("50") // Default to 50
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handlePayment = async () => {
        setLoading(true)
        setError(null)

        try {
            const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
            const apiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
            console.log("Debug - Backend URL:", backendUrl)
            console.log("Debug - Using Publishable Key:", apiKey)

            const response = await fetch(`${backendUrl}/store/simpleswap/create-exchange`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "pk_test"
                },
                body: JSON.stringify({
                    amount: parseFloat(amount), // Note: for crypto, 50 ETH is a lot. User might want to lower this.
                    currency_from: "eth",
                    currency_to: "btc"
                }),
            })

            if (!response.ok) {
                const errData = await response.json()
                console.error("FULL ERROR DETAILS:", JSON.stringify(errData, null, 2))
                throw new Error(errData.message || "Failed to create exchange")
            }

            const data = await response.json()
            console.log("SimpleSwap Response:", data)

            // Handle response
            // If SimpleSwap returns a redirect_url (for fiat partners)
            if (data.redirect_url) {
                window.location.href = data.redirect_url
                return
            }

            // If it returns an ID but no redirect (standard crypto flow?), we might need to show instructions
            // But for Fiat (USD), it *should* typically involve a redirect to a processor.
            if (data.id) {
                // Fallback if no direct redirect url is found but we have an ID.
                // Maybe redirect to SimpleSwap tracking page?
                // https://simpleswap.io/exchange?id=...
                window.location.href = `https://simpleswap.io/exchange?id=${data.id}`
                return
            }

            alert("Exchange created but no redirect URL found. check console.")

        } catch (err: any) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 bg-white border rounded-lg shadow-md max-w-sm mx-auto mt-8">
            <Heading level="h2" className="mb-4">Donate / Pay with SimpleSwap</Heading>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Label>Amount (USD)</Label>
                    <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="50"
                    />
                </div>

                {error && <Text className="text-red-500">{error}</Text>}

                <Button
                    onClick={handlePayment}
                    isLoading={loading}
                    className="w-full"
                >
                    Pay with Visa/Mastercard (Crypto Receive)
                </Button>
            </div>
        </div>
    )
}

export default SimplePayment
