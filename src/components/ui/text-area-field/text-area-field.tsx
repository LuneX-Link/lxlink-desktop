import React, { useId, useState } from "react"
import cn from "classnames"

import "../text-field/text-field.scss"

export interface TextAreaFieldProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  theme?: "primary" | "dark"
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
}

export const TextAreaField = React.forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ theme = "primary", label, hint, error, className, onFocus, onBlur, ...props }, ref) => {
    const id = useId()
    const [isFocused, setIsFocused] = useState(false)

    return (
      <div className="text-field-container">
        {label && <label htmlFor={id}>{label}</label>}
        <div className="text-field-container__text-field-wrapper">
          <div
            className={cn(
              "text-field-container__text-field",
              `text-field-container__text-field--${theme}`,
              {
                "text-field-container__text-field--has-error": Boolean(error),
                "text-field-container__text-field--focused": isFocused,
              },
            )}
          >
            <textarea
              {...props}
              ref={ref}
              id={id}
              className={cn("text-field-container__text-field-input", className)}
              onFocus={(event) => {
                setIsFocused(true)
                onFocus?.(event)
              }}
              onBlur={(event) => {
                setIsFocused(false)
                onBlur?.(event)
              }}
            />
          </div>
        </div>
        {error ? (
          <small className="text-field-container__error-label">{error}</small>
        ) : hint ? (
          <small>{hint}</small>
        ) : null}
      </div>
    )
  },
)

TextAreaField.displayName = "TextAreaField"
