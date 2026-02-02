import * as React from "react"
import { ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, config, children, style, ...props }, ref) => {
    const colorVars = Object.entries(config).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value?.color) {
          acc[`--color-${key}`] = value.color
        }
        return acc
      },
      {},
    )

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full items-center justify-center text-xs [&_.recharts-text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          className,
        )}
        style={{ ...colorVars, ...style } as React.CSSProperties}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    )
  },
)
ChartContainer.displayName = "ChartContainer"

export { ChartContainer }
