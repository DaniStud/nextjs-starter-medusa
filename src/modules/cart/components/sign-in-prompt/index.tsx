import { Button, Heading, Text } from "@medusajs/ui"
import { t } from "@lib/i18n"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="bg-white flex items-center justify-between">
      <div>
        <Heading level="h2" className="txt-xlarge">
          {t("signInPrompt.welcome")}
        </Heading>
        <Text className="txt-medium text-ui-fg-subtle mt-2">
          {t("signInPrompt.continue")}
        </Text>
      </div>
      {/* Account sign-in link removed */}
      <div></div>
    </div>
  )
}

export default SignInPrompt
