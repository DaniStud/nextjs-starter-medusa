import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { SHIRTPLATFORM_MODULE } from "../modules/shirtplatform"
import ShirtplatformModuleService from "../modules/shirtplatform/service"

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
    // 2. Build customer and address payload
    // -----------------------------------------------------------------------
    const shippingAddr = order.shipping_address
    const billingAddr = order.billing_address ?? order.shipping_address
    const customer = order.customer

    const customerPayload = {
      firstName: customer?.first_name ?? shippingAddr?.first_name ?? "",
      lastName: customer?.last_name ?? shippingAddr?.last_name ?? "",
      email: customer?.email ?? order.email ?? "",
      phone: customer?.phone ?? shippingAddr?.phone ?? "",
      shippingAddress: {
        street: shippingAddr?.address_1 ?? "",
        city: shippingAddr?.city ?? "",
        zip: shippingAddr?.postal_code ?? "",
        country: shippingAddr?.country_code?.toUpperCase() ?? "",
        countryCode: shippingAddr?.country_code?.toUpperCase() ?? "",
        firstName: shippingAddr?.first_name ?? "",
        lastName: shippingAddr?.last_name ?? "",
        phone: shippingAddr?.phone ?? "",
        email: customer?.email ?? order.email ?? "",
      },
      billingAddress: {
        street: billingAddr?.address_1 ?? "",
        city: billingAddr?.city ?? "",
        zip: billingAddr?.postal_code ?? "",
        country: billingAddr?.country_code?.toUpperCase() ?? "",
        countryCode: billingAddr?.country_code?.toUpperCase() ?? "",
        firstName: billingAddr?.first_name ?? "",
        lastName: billingAddr?.last_name ?? "",
        phone: billingAddr?.phone ?? "",
        email: customer?.email ?? order.email ?? "",
      },
    }

    const shippingCountryCode = shippingAddr?.country_code?.toUpperCase()

    // -----------------------------------------------------------------------
    // 3. Build the designs array from line items
    // -----------------------------------------------------------------------
    const designs: Array<{
      productId: number
      amount: number
      assignedColorId: number
      assignedSizeId: number
      sku?: string
      viewPosition?: string
      motive?: Record<string, any>
      position?: Record<string, string>
    }> = []

    const skippedItems: string[] = []

    for (const item of order.items ?? []) {
      // Line-item metadata wins over variant metadata.
      const meta: Record<string, any> = {
        ...(item.variant?.metadata ?? {}),
        ...(item.metadata ?? {}),
      }
      const spProductId = meta.shirtplatform_product_id
      const spColorId = meta.shirtplatform_assigned_color_id
      const spSizeId = meta.shirtplatform_assigned_size_id
      const spMotiveId = meta.shirtplatform_motive_id
      const spMotiveAttachment = meta.shirtplatform_motive_attachment
      const spMotiveUrl = meta.shirtplatform_motive_url
      const spMotiveFilename = meta.shirtplatform_motive_filename
      const spViewPosition = meta.shirtplatform_view_position ?? "FRONT"
      const spPositionLeft = meta.shirtplatform_position_left
      const spPositionRight = meta.shirtplatform_position_right
      const spPositionTop = meta.shirtplatform_position_top

      if (!spProductId || !spColorId || !spSizeId) {
        skippedItems.push(item.id)
        logger.warn(
          `[SP Order] Skipping item ${item.id} (${item.title}) — missing Shirtplatform metadata`
        )
        continue
      }

      // Build the motive reference
      const motive: Record<string, any> = {}
      if (spMotiveAttachment) {
        motive.attachment = String(spMotiveAttachment)
        if (spMotiveFilename) motive.filename = String(spMotiveFilename)
      } else if (spMotiveUrl) {
        motive.url = String(spMotiveUrl)
        if (spMotiveFilename) motive.filename = String(spMotiveFilename)
      } else if (spMotiveId) {
        motive.id = Number(spMotiveId)
      }
      // If no motive at all, leave empty (base product — no customization)

      // Build position
      const position: Record<string, string> =
        spPositionLeft && spPositionRight
          ? {
              left: String(spPositionLeft),
              right: String(spPositionRight),
              ...(spPositionTop ? { top: String(spPositionTop) } : {}),
            }
          : { horizontalCenter: "0", verticalCenter: "0" }

      designs.push({
        productId: Number(spProductId),
        amount: item.quantity,
        assignedColorId: Number(spColorId),
        assignedSizeId: Number(spSizeId),
        viewPosition: String(spViewPosition),
        motive,
        position,
      })

      const motiveType = spMotiveAttachment ? "inline" : spMotiveUrl ? "url" : spMotiveId ? "motive " + spMotiveId : "base (no motive)"
      logger.info(
        `[SP Order] Built design: ${item.title} (${motiveType}, qty ${item.quantity}, color ${spColorId}, size ${spSizeId})`
      )
    }

    if (designs.length === 0) {
      logger.warn(
        `[SP Order] No items could be mapped to SP designs. Skipped: ${skippedItems.join(", ")}`
      )
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