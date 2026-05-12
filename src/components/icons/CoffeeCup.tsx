import * as React from "react"
import type { SVGProps } from "react"
const SvgCoffeeCup = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 64 64"
    {...props}
  >
    <path d="M44 8H20c-4.4 0-8 3.6-8 8v20c0 4.4 3.6 8 8 8h2v8c0 2.2 1.8 4 4 4h12c2.2 0 4-1.8 4-4v-8h2c4.4 0 8-3.6 8-8V16c0-4.4-3.6-8-8-8M22 28c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4h4v12zm16 20H26v-8h12zm4-12H22V20h20zm4-12c0 2.2-1.8 4-4 4h-4V16h4c2.2 0 4 1.8 4 4z" />
    <path d="M48 6c2 0 4-1 5-2.5C51.5 2 49.5 2 48 2c-3 0-5.5 1.8-5.5 4s2.5 4 5.5 4c1 0 2-.3 2.8-.7" />
  </svg>
)
export default SvgCoffeeCup
