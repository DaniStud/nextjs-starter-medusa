import { declineTransferRequest } from "@lib/data/orders"
import { Heading, Text } from "@medusajs/ui"
import TransferImage from "@modules/order/components/transfer-image"
import { t } from "@lib/i18n"

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string }
}) {
  const { id, token } = params

  const { success, error } = await declineTransferRequest(id, token)

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        {success && (
          <>
            <Heading level="h1" className="text-xl text-zinc-900">
              {t("orderTransfer.declined")}
            </Heading>
            <Text className="text-zinc-600">
              {t("orderTransfer.declinedBody", { id })}
            </Text>
          </>
        )}
        {!success && (
          <>
            <Text className="text-zinc-600">
              {t("orderTransfer.declineError")}
            </Text>
            {error && (
              <Text className="text-red-500">{t("orderTransfer.errorMessage", { error })}</Text>
            )}
          </>
        )}
      </div>
    </div>
  )
}
