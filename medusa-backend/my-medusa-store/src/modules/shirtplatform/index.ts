import { Module } from "@medusajs/framework/utils"
import ShirtplatformModuleService from "./service"

export const SHIRTPLATFORM_MODULE = "shirtplatform"

export default Module(SHIRTPLATFORM_MODULE, {
  service: ShirtplatformModuleService,
})
