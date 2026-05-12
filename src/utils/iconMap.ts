import SvgCoffeeCup from "../components/icons/CoffeeCup"
import SvgSkull from "../components/icons/Skull"
import SvgPlant from "../components/icons/Plant"
import type { SVGProps } from "react"

export type IconComponent = React.FC<SVGProps<SVGSVGElement>>

export const IconDictionary: Record<string, IconComponent> = {
  CoffeeCup: SvgCoffeeCup,
  Skull: SvgSkull,
  Plant: SvgPlant,
}
