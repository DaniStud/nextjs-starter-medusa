import { Badge } from "@medusajs/ui"
import { t } from "@lib/i18n"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">{t("checkout.testAttention")}</span> {t("checkout.testOnly")}
    </Badge>
  )
}

export default PaymentTest
