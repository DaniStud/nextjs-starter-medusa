import * as React from "react"
import type { SVGProps } from "react"
const SvgPlant = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 64 64"
    {...props}
  >
    <path d="M32 2c-1.1 0-2 .9-2 2v6c-8.8 0-16 7.2-16 16v2c0 1.1.9 2 2 2h4.3c2.5 9.7 6.7 16.6 9.7 20v6h-6c-1.1 0-2 .9-2 2s.9 2 2 2h16c1.1 0 2-.9 2-2s-.9-2-2-2h-6v-6c3-3.4 7.2-10.3 9.7-20H48c1.1 0 2-.9 2-2v-2c0-8.8-7.2-16-16-16V4c0-1.1-.9-2-2-2m-8 14c0-1 .2-2 .5-3 2.1-1.2 4.6-2 7.5-2s5.4.8 7.5 2c.3 1 .5 2 .5 3v12H24z" />
  </svg>
)
export default SvgPlant
