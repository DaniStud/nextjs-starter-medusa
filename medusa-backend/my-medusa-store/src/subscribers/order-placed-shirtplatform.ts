import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { SHIRTPLATFORM_MODULE } from "../modules/shirtplatform"
import ShirtplatformModuleService from "../modules/shirtplatform/service"

/**
 * Forwards a placed Medusa order to Shirtplatform for print-on-demand fulfillment.
 *
 * Flow:
 *   1. Retrieve the Medusa order with all required relations
 *   2. Match the shipping country to a Shirtplatform country ID
 *   3. Create a base order on Shirtplatform
 *   4. Add each line item using usingBaseProduct (pre-designed products, no CreatorSE)
 *   5. Commit the order to production
 *   6. Store the Shirtplatform order ID in Medusa order metadata
 *
 * Errors are logged but never re-thrown — the Medusa order flow must not be blocked.
 */
export default async function shirtplatformOrderForwardingHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger") as any
  const orderId: string = data.id

  logger.info(`[SP Order] Forwarding Medusa order ${orderId} to Shirtplatform`)

  try {
    const orderModule = container.resolve(Modules.ORDER) as any
    const shirtplatform = container.resolve<ShirtplatformModuleService>(SHIRTPLATFORM_MODULE)

    // -----------------------------------------------------------------------
    // 1. Retrieve Medusa order
    // -----------------------------------------------------------------------
    const order = await orderModule.retrieveOrder(orderId, {
      relations: [
        "items",
        "items.variant",
        "items.variant.product",
        "shipping_address",
        "billing_address",
        "customer",
      ],
    })

    if (!order) {
      logger.error(`[SP Order] Order ${orderId} not found`)
      return
    }

    // -----------------------------------------------------------------------
    // 2. Resolve Shirtplatform country ID from customer shipping address
    // -----------------------------------------------------------------------
    const shippingCountryCode = order.shipping_address?.country_code?.toUpperCase()
    let shirtplatformCountryId: number | undefined

    if (shippingCountryCode) {
      try {
        const countries = await shirtplatform.getCountries()
        const match = countries.find(
          (c) => c.code?.toUpperCase() === shippingCountryCode
        )
        shirtplatformCountryId = match?.id
      } catch (err: any) {
        logger.warn(`[SP Order] Could not fetch countries: ${err.message}. Proceeding without country.`)
      }
    }

    // -----------------------------------------------------------------------
    // 3. Build customer and address payload
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
        firstName: shippingAddr?.first_name ?? "",
        lastName: shippingAddr?.last_name ?? "",
        street: shippingAddr?.address_1 ?? "",
        streetNo: shippingAddr?.address_2 ?? "",
        city: shippingAddr?.city ?? "",
        zip: shippingAddr?.postal_code ?? "",
        country: shippingAddr?.country_code?.toUpperCase() ?? "",
        phone: shippingAddr?.phone ?? "",
        email: customer?.email ?? order.email ?? "",
      },
      billingAddress: {
        firstName: billingAddr?.first_name ?? "",
        lastName: billingAddr?.last_name ?? "",
        street: billingAddr?.address_1 ?? "",
        streetNo: billingAddr?.address_2 ?? "",
        city: billingAddr?.city ?? "",
        zip: billingAddr?.postal_code ?? "",
        country: billingAddr?.country_code?.toUpperCase() ?? "",
        phone: billingAddr?.phone ?? "",
        email: customer?.email ?? order.email ?? "",
      },
    }

    // -----------------------------------------------------------------------
    // 4. Create base order on Shirtplatform
    // -----------------------------------------------------------------------
    const orderPayload: any = {
      uniqueId: orderId,
      financialStatus: "PAID",
      customer: customerPayload,
      ...(shirtplatformCountryId ? { country: { id: shirtplatformCountryId } } : {}),
    }

    const spOrder = await shirtplatform.createOrder(orderPayload)
    const spOrderId = spOrder.id
    logger.info(`[SP Order] Created Shirtplatform order ${spOrderId} for Medusa order ${orderId}`)

    // -----------------------------------------------------------------------
    // 5. Add line items to the Shirtplatform order
    // -----------------------------------------------------------------------
    let itemsAdded = 0
    const skippedItems: string[] = []

    for (const item of order.items ?? []) {
      const meta = item.variant?.metadata ?? {}
      const spProductId = meta.shirtplatform_product_id
      const spColorId = meta.shirtplatform_assigned_color_id
      const spSizeId = meta.shirtplatform_assigned_size_id

      if (!spProductId || !spColorId || !spSizeId) {
        skippedItems.push(item.id)
        logger.warn(
          `[SP Order] Skipping item ${item.id} (${item.title}) — missing Shirtplatform metadata`
        )
        continue
      }

      await shirtplatform.addOrderedProduct(
        spOrderId,
        Number(spProductId),
        Number(spColorId),
        Number(spSizeId),
        item.quantity
      )
      itemsAdded++
      logger.info(`[SP Order] Added item ${item.title} (qty ${item.quantity}) to SP order ${spOrderId}`)
    }

    if (itemsAdded === 0) {
      logger.warn(
        `[SP Order] No items could be added to SP order ${spOrderId}. Skipping commit. Skipped: ${skippedItems.join(", ")}`
      )
      return
    }

    // -----------------------------------------------------------------------
    // 6. Commit the order to production
    // -----------------------------------------------------------------------
    await shirtplatform.commitOrder(spOrderId)
    logger.info(`[SP Order] Committed SP order ${spOrderId} to production`)

    // -----------------------------------------------------------------------
    // 7. Save the Shirtplatform order ID back to Medusa order metadata
    // -----------------------------------------------------------------------
    await orderModule.updateOrders([
      {
        id: orderId,
        metadata: {
          ...(order.metadata ?? {}),
          shirtplatform_order_id: spOrderId,
          shirtplatform_order_synced_at: new Date().toISOString(),
        },
      },
    ])

    logger.info(`[SP Order] ✅ Order ${orderId} successfully forwarded as SP order ${spOrderId}`)
  } catch (err: any) {
    // Never re-throw — the Medusa order must be preserved even if SP forwarding fails
    logger.error(`[SP Order] ❌ Failed to forward order ${orderId} to Shirtplatform: ${err.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "shirtplatform-order-forwarding",
  },
}
