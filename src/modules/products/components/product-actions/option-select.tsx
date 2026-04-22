import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <div
      className="flex flex-row flex-wrap gap-2"
      data-testid={dataTestId}
    >
      {filteredOptions.map((v) => {
        return (
          <button
            onClick={() => updateOption(option.id, v)}
            key={v}
            className={clx(
              "flex-1 border border-stone-300 bg-white text-small-regular h-10 rounded-none px-5 py-2 transition-colors min-w-[3rem]",
              {
                "border-black text-black font-semibold z-10": v === current,
                "hover:border-stone-400":
                  v !== current,
              }
            )}
            disabled={disabled}
            data-testid="option-button"
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

export default OptionSelect
