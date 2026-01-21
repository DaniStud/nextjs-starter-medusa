import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        const { amount, currency_from = "usd", currency_to = "btc" } = req.body as { amount: number, currency_from?: string, currency_to?: string }

        const apiKey = process.env.SIMPLESWAPKEY
        const walletAddress = process.env.WALLET1

        if (!apiKey || !walletAddress) {
            console.error("Missing SimpleSwap configuration: SIMPLESWAPKEY or WALLET1")
            return res.status(500).json({ message: "Server configuration error: Missing API Key or Wallet" })
        }

        if (!amount) {
            return res.status(400).json({ message: "Amount is required" })
        }

        // SimpleSwap create_exchange endpoint
        // https://api.simpleswap.io/#/Exchanges/ExchangesController_createExchange

        // URL based on documentation snippet
        // https://api.simpleswap.io/create_exchange CHECKING V1 vs V3
        // User snippet suggests body has tickerFrom, tickerTo etc.
        const simpleSwapUrl = `https://api.simpleswap.io/create_exchange?api_key=${apiKey}`

        // Payload matches user snippet
        // For USD -> BTC:
        // tickerFrom: "usd"
        // networkFrom: "usd" (or "fiat"?) -> usually same as ticker for many, or specific. 
        // Let's try "usd" for both.
        const payload = {
            fixed: false,
            currencyFrom: currency_from, // "usd"
            currencyTo: currency_to, // "btc"
            amount: amount.toString(),
            addressTo: walletAddress,
            // userRefundAddress: walletAddress, 
        }

        console.log("Calling SimpleSwap:", simpleSwapUrl, JSON.stringify(payload))

        const response = await fetch(simpleSwapUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("SimpleSwap API Error:", response.status, errorText)
            try {
                const errorJson = JSON.parse(errorText)
                return res.status(response.status).json({ message: errorJson.message || "Failed to create exchange", details: errorJson })
            } catch (e) {
                return res.status(response.status).json({ message: "Failed to create exchange", details: errorText })
            }
        }

        const data = await response.json()

        // Return the data to the frontend so it can redirect or show the iframe/widget
        // SimpleSwap API usually returns an 'id' and 'redirect_url' or similar depending on the specific endpoint (standard exchange vs widget).
        // If this is the main API, it returns an exchange ID and we might need to construct the payment URL or use their widget with this ID.
        // However, for "Fiat to Crypto", SimpleSwap often redirects to a partner (Mercuryo, Guardarian, etc).
        // Let's pass the whole response back.
        res.json(data)

    } catch (error) {
        console.error("Internal Error in SimpleSwap route:", error)
        res.status(500).json({ message: "Internal Server Error" })
    }
}
