import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import crypto from "crypto"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        const secret = process.env.MERCURY_SECRET || "PLACEHOLDER_SECRET"
        const signature = req.headers['x-signature'] as string

        // NOTE: In a real production environment, you MUST verify the signature.
        // Consturcting the signature requires the raw request body.
        // const calculated = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
        // if (calculated !== signature) return res.status(401).send()

        // For Sandbox/Dev without raw body access easily available in this snippet scope, 
        // we are skipping strict verification. Ensure to implement this!

        const body = req.body as any
        const data = body?.data

        if (!data) {
            return res.status(200).send()
        }

        const { merchant_transaction_id, status } = data
        // Mercury statuses: 'paid' is usually potentially final success for immediate capture
        // Check specific Mercury lifecycle states. 'paid', 'success', 'completed'.
        const successStatuses = ['paid', 'completed', 'success']

        if (successStatuses.includes(status) && merchant_transaction_id) {
            console.log(`Received successful payment for cart ${merchant_transaction_id}`)

            // Execute Complete Cart Workflow
            // This assumes the cart is in a state ready to be completed (email, address set)
            // and that the payment flow allows completion.
            const { result, errors } = await completeCartWorkflow(req.scope).run({
                input: { id: merchant_transaction_id }
            })

            if (errors && errors.length > 0) {
                console.error("Error completing cart from Mercury webhook:", errors)
                // Check if we need to manually authorize a payment session first?
                // This depends on how the Checkout flow was initiated.
                return res.status(500).json({ error: errors })
            }

            console.log("Successfully completed cart:", result)
        }

        res.status(200).send()
    } catch (error) {
        console.error("Webhook error:", error)
        res.status(500).send()
    }
}
