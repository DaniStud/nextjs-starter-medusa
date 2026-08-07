import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { SHIRTPLATFORM_MODULE } from "../modules/shirtplatform"
import ShirtplatformModuleService from "../modules/shirtplatform/service"
import { mapOrderToCreatorSEInputs } from "../modules/shirtplatform/order-mapper"

/**
 * Forwards a placed Medusa order to Shirtplatform for print-on-demand fulfillment
 * using the **single-call deferred CreatorSE endpoint** (preferred method).
 *
 * Flow:
 *  1. Retrieve the Medusa order with all required relations
 *  2. Build all designs from line items (motive URL/ID/attachment → CreatorSE)
 *  3. Capture Stripe payment
 *  4. POST /orders/usingCreatorSE — one call creates + commits the order
 *  5. Store the Shirtplatform order ID in Medusa order metadata
 *
 * This replaces the deprecated 3-step:
 *  POST /orders → POST /orderedProducts/usingCreatorSE → PUT /commitOrder
 *
 * Errors are logged but never re-thrown — the Medusa order flow must not be blocked.
 */
export default async function shirtplatformOrderForwardingHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger") as any
  const orderId: string = data.id

  logger.info(`[SP Order] Forwarding Medusa order ${orderId} to Shirtplatform (deferred CreatorSE)`)

  try {
    const shirtplatform = container.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)
    const query = container.resolve("query") as any
    const orderModule = container.resolve(Modules.ORDER) as any

    // -----------------------------------------------------------------------
    // 1. Retrieve Medusa order via Query (remote query supports linked data)
    // -----------------------------------------------------------------------
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "metadata",
        "items.*",
        "items.variant.*",
        "items.variant.metadata",
        "shipping_address.*",
        "billing_address.*",
      ],
      filters: { id: orderId },
    })

    if (!order) {
      logger.error(`[SP Order] Order ${orderId} not found`)
      return
    }

    // Idempotency guard — if this order was already forwarded, skip.
    if (order.metadata?.shirtplatform_order_id) {
      logger.info(
        `[SP Order] Order ${orderId} already forwarded as SP order ${order.metadata.shirtplatform_order_id} — skipping`
      )
      return
    }

    // -----------------------------------------------------------------------
    // 2. Build customer + designs from the order (shared mapper — the preview
    //    endpoint uses the exact same code, so a dry-run payload is identical
    //    to what production sends).
    // -----------------------------------------------------------------------
    const { customer: customerPayload, shippingCountryCode, designs, skippedItems } =
      mapOrderToCreatorSEInputs(order)

    for (const skipped of skippedItems) {
      logger.warn(`[SP Order] Skipping item ${skipped} — missing Shirtplatform metadata`)
    }
    for (const d of designs) {
      const motiveType = d.motive?.attachment
        ? "inline"
        : d.motive?.url
        ? "url"
        : d.motive?.id
        ? "motive " + d.motive.id
        : "base (no motive)"
      logger.info(
        `[SP Order] Built design: product ${d.productId} (${motiveType}, qty ${d.amount}, color ${d.assignedColorId}, size ${d.assignedSizeId}, view ${d.viewPosition})`
      )
    }

    if (designs.length === 0) {
      logger.warn(
        `[SP Order] No items could be mapped to SP designs. Skipped: ${skippedItems.join(", ")}`
      )
      return
    }

    // -----------------------------------------------------------------------
    // 3. DRY RUN — when SHIRTPLATFORM_DRY_RUN is enabled, build the exact
    //    payload and store it on the order instead of capturing payment or
    //    sending anything to Shirtplatform. Lets us verify the buy flow and
    //    hand the payload to Shirtplatform before placing a real order.
    // -----------------------------------------------------------------------
    const dryRun = /^(1|true|yes)$/i.test(process.env.SHIRTPLATFORM_DRY_RUN ?? "")
    if (dryRun) {
      const previewPayload = shirtplatform.buildCreatorSEPayload({
        uniqueId: orderId,
        financialStatus: "PAID", // assumed — no capture happens in a dry run
        customer: customerPayload,
        shippingCountryCode,
        designs,
      })
      logger.info(
        `[SP Order] 🧪 DRY RUN — not sending. Payload for order ${orderId}:\n${JSON.stringify(previewPayload, null, 2)}`
      )
      await orderModule.updateOrders(orderId, {
        metadata: {
          ...(order.metadata ?? {}),
          shirtplatform_dry_run: true,
          shirtplatform_dry_run_at: new Date().toISOString(),
          shirtplatform_dry_run_payload: previewPayload,
          shirtplatform_dry_run_skipped_items: skippedItems,
        },
      })
      return
    }

    // -----------------------------------------------------------------------
    // 4. Capture the Stripe payment
    // -----------------------------------------------------------------------
    const paymentModule = container.resolve(Modules.PAYMENT) as any
    let paymentCaptured = false
    let captureDebug = ""

    try {
      const { data: [orderWithPayment] } = await query.graph({
        entity: "order",
        fields: ["id", "payment_collections.id"],
        filters: { id: orderId },
      })

      const paymentCollection = orderWithPayment?.payment_collections?.[0]
      captureDebug += `pc=${paymentCollection?.id ?? "none"};`

      if (paymentCollection?.id) {
        const payments = await paymentModule.listPayments({
          payment_collection_id: paymentCollection.id,
        })

        captureDebug += `payments=${payments.length};`

        for (const payment of payments) {
          captureDebug += `p=${payment.id},status=${payment.status},captured=${!!payment.captured_at},provider=${payment.provider_id},amt=${payment.amount};`
          if (payment.captured_at) {
            paymentCaptured = true
            continue
          }
          try {
            await paymentModule.capturePayment({
              payment_id: payment.id,
              amount: payment.amount,
            })
            paymentCaptured = true
            captureDebug += "capture=ok;"
            logger.info(`[SP Order] Captured payment ${payment.id} (${payment.amount})`)
          } catch (captureErr: any) {
            captureDebug += `capture_err=${captureErr.message};`
            logger.error(`[SP Order] Failed to capture payment ${payment.id}: ${captureErr.message}`)
          }
        }
      }
    } catch (payErr: any) {
      captureDebug += `outer_err=${payErr.message};`
      logger.error(`[SP Order] Error during payment capture: ${payErr.message}`)
    }

    const financialStatus = paymentCaptured ? "PAID" : "PENDING"

    // -----------------------------------------------------------------------
    // 5. Create order via single-call deferred CreatorSE endpoint
    // -----------------------------------------------------------------------
    const spOrder = await shirtplatform.createOrderUsingCreatorSE({
      uniqueId: orderId,
      financialStatus,
      customer: customerPayload,
      shippingCountryCode,
      designs,
    })

    const spOrderId = spOrder.id
    logger.info(`[SP Order] ✅ Created & committed Shirtplatform order ${spOrderId} for Medusa order ${orderId} (1 API call)`)

    // -----------------------------------------------------------------------
    // 6. Save the Shirtplatform order ID back to Medusa order metadata
    // -----------------------------------------------------------------------
    await orderModule.updateOrders(orderId, {
      metadata: {
        ...(order.metadata ?? {}),
        shirtplatform_order_id: spOrderId,
        shirtplatform_order_synced_at: new Date().toISOString(),
        shirtplatform_financial_status: financialStatus,
        shirtplatform_capture_debug: captureDebug,
        shirtplatform_order_method: "deferred-creatorse", // distinguish from old 3-step
      },
    })

    logger.info(`[SP Order] ✅ Order ${orderId} successfully forwarded as SP order ${spOrderId}`)
  } catch (err: any) {
    // Never re-throw — the Medusa order must be preserved even if SP forwarding fails.
    logger.error(`[SP Order] ❌ Failed to forward order ${orderId} to Shirtplatform: ${err.message}`)

    try {
      const orderModule = container.resolve(Modules.ORDER) as any
      await orderModule.updateOrders(orderId, {
        metadata: {
          shirtplatform_error: String(err?.message ?? err),
          shirtplatform_error_at: new Date().toISOString(),
        },
      })
    } catch (metaErr: any) {
      logger.error(
        `[SP Order] Additionally failed to record SP error on order ${orderId}: ${metaErr.message}`
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "shirtplatform-order-forwarding",
  },
}