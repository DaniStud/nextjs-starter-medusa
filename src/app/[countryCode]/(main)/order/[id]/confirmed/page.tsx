import { retrieveOrder } from "@lib/data/orders"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@lib/i18n"

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: t("meta.orderConfirmed.title"),
  description: t("meta.orderConfirmed.description"),
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    return notFound()
  }

  return <OrderCompletedTemplate order={order} />
}
