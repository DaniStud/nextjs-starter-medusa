import type { CreatorSEDesignInput } from "./service"

/**
 * Shared, side-effect-free mapping from a Medusa order (as returned by
 * query.graph with items.variant.metadata, shipping/billing address and
 * customer) into the inputs the CreatorSE deferred order needs.
 *
 * Used by BOTH the order-placed subscriber (real send) and the admin
 * payload-preview endpoint (dry run), so the previewed payload is byte-for-byte
 * what production would send.
 */

export interface OrderMappingResult {
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
    shippingAddress: Record<string, any>
    billingAddress: Record<string, any>
  }
  shippingCountryCode?: string
  designs: CreatorSEDesignInput[]
  /** Line-item IDs that could not be mapped (missing SP metadata). */
  skippedItems: string[]
}

export function mapOrderToCreatorSEInputs(order: any): OrderMappingResult {
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

  const designs: CreatorSEDesignInput[] = []
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
      continue
    }

    // Build the motive reference: inline attachment, URL, or ID.
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
    // If no motive at all, leave empty (base product — no customization).

    const position: Record<string, string> =
      spPositionLeft && spPositionRight
        ? {
            left: String(spPositionLeft),
            right: String(spPositionRight),
            ...(spPositionTop ? { top: String(spPositionTop) } : {}),
          }
        : { horizontalCenter: "0", verticalCenter: "0" }

    // Optional neck tag (inner-neck label). Placed on the NECKTAG view.
    const ntAttachment = meta.shirtplatform_necktag_attachment
    const ntUrl = meta.shirtplatform_necktag_url
    const ntId = meta.shirtplatform_necktag_motive_id
    const ntFilename = meta.shirtplatform_necktag_filename
    const ntLeft = meta.shirtplatform_necktag_position_left
    const ntRight = meta.shirtplatform_necktag_position_right
    const ntTop = meta.shirtplatform_necktag_position_top

    let neckTag: { motive: Record<string, any>; position?: Record<string, string> } | undefined
    const ntMotive: Record<string, any> = {}
    if (ntAttachment) {
      ntMotive.attachment = String(ntAttachment)
      if (ntFilename) ntMotive.filename = String(ntFilename)
    } else if (ntUrl) {
      ntMotive.url = String(ntUrl)
      if (ntFilename) ntMotive.filename = String(ntFilename)
    } else if (ntId) {
      ntMotive.id = Number(ntId)
    }
    if (Object.keys(ntMotive).length > 0) {
      neckTag = {
        motive: ntMotive,
        position:
          ntLeft && ntRight
            ? {
                left: String(ntLeft),
                right: String(ntRight),
                ...(ntTop ? { top: String(ntTop) } : {}),
              }
            : undefined, // undefined → builder centers it in the neck area
      }
    }

    designs.push({
      productId: Number(spProductId),
      amount: item.quantity,
      assignedColorId: Number(spColorId),
      assignedSizeId: Number(spSizeId),
      viewPosition: String(spViewPosition),
      motive,
      position,
      ...(neckTag ? { neckTag } : {}),
    })
  }

  return {
    customer: customerPayload,
    shippingCountryCode,
    designs,
    skippedItems,
  }
}
