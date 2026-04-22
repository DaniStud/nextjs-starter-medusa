import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"
import { t } from "@lib/i18n"

export const metadata: Metadata = {
  title: t("meta.login.title"),
  description: t("meta.login.description"),
}

export default function Login() {
  return <LoginTemplate />
}
