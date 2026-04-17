import * as React from "react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, ...props }, ref) => {
    const handleWheel: React.WheelEventHandler<HTMLInputElement> = (event) => {
      // Prevent browser wheel-step changes (e.g. 200 -> 199) on focused number inputs.
      if (type === "number") {
        event.currentTarget.blur()
      }

      onWheel?.(event)
    }

    return (
      <input
        type={type}
        className={`flex h-10 w-full rounded-2xl border border-border/70 bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        onWheel={handleWheel}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
