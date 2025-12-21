import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import crypto from "crypto"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    const { cart_id } = req.body as { cart_id: string }

    if (!cart_id) {
        return res.status(400).json({ message: "cart_id is required" })
    }

    const cartModuleService = req.scope.resolve(Modules.CART)
    const cart = await cartModuleService.retrieveCart(cart_id)

    if (!cart) {
        return res.status(404).json({ message: "Cart not found" })
    }

    const widgetId = process.env.MERCURY_WIDGET_ID || "PLACEHOLDER_WIDGET_ID"
    const secret = process.env.MERCURY_SECRET || "PLACEHOLDER_SECRET"
    const walletAddress = process.env.MERCURY_WALLET_ADDRESS || "PLACEHOLDER_WALLET_ADDRESS"

    // Mercury expects fiat_amount in major units (e.g. 10.50), Medusa stores in minor (e.g. 1050)
    // Assuming the currency has 2 decimal places for simplicity, but ideally use currency definition
    // TODO: Handle currency precision dynamically if needed (Mercury supports specific currencies)
    const amount = (Number(cart.total) / 100).toFixed(2)
    const currency = cart.currency_code.toUpperCase()
    const merchantTransactionId = cart.id

    // Signature parameters: address + secret + Ip + Merchanttransactionid
    // NOTE: In server-side generation, getting the USER'S IP matching what Mercury sees can be tricky behind proxies.
    // Mercury docs say: "Ip: IP address of the user."
    // If we can't get the exact IP, verification might fail if strict checking is enabled.
    // For now, we will try to get it from headers.
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1'

    // Clean IP (handle comma separated lists from proxies)
    const cleanIp = ip.split(',')[0].trim()

    const signatureString = `${walletAddress}${secret}${cleanIp}${merchantTransactionId}`
    const signature = crypto.createHash('sha512').update(signatureString).digest('hex')

    res.json({
        widget_id: widgetId,
        address: walletAddress,
        merchant_transaction_id: merchantTransactionId,
        fiat_amount: amount,
        fiat_currency: currency,
        currency: 'USDT', // Target crypto currency. Could be configurable or selected by user. Defaulting to USDT for now.
        signature: `v2:${signature}`,
        ip: cleanIp // Send back IP used for signature so frontend can debug if needed or if used in URL (though usually not passed in URL explicitly other than implied)
    })
}
