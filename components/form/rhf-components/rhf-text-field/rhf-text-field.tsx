"use client";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";
import { ChangeEvent, useCallback } from "react";

/**
 * Mask format characters:
 *   #  → digit (0-9)
 *   A  → letter (a-z, A-Z)
 *   *  → any character
 * Literal characters in the mask are inserted automatically.
 *
 * Examples:
 *   "(###) ###-###-####"  → phone: (123) 456-789-1234
 *   "##/##/####"          → date:  12/31/2024
 *   "AA-#####"            → mixed: AB-12345
 */
function applyMask(raw: string, mask: string): string {
  const maskChars: Record<string, RegExp> = {
    "#": /\d/,
    A: /[a-zA-Z]/,
    "*": /[\s\S]/,
  };

  let result = "";
  let rawIndex = 0;

  for (let i = 0; i < mask.length; i++) {
    if (rawIndex >= raw.length) break;
    const maskChar = mask[i];
    const pattern = maskChars[maskChar];

    if (pattern) {
      if (pattern.test(raw[rawIndex])) {
        result += raw[rawIndex];
        rawIndex++;
      } else {
        rawIndex++;
        i--;
      }
    } else {
      result += maskChar;
      if (raw[rawIndex] === maskChar) rawIndex++;
    }
  }

  return result;
}

function applyTransform(value: string, transform: Props["transform"]): string {
  if (transform === "uppercase") return value.toUpperCase();
  if (transform === "lowercase") return value.toLowerCase();
  if (transform === "capitalize")
    return value.replace(/\b\w/g, (c) => c.toUpperCase());
  return value;
}

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  type?: "text" | "email" | "password" | "tel";
  fullWidth?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Max number of characters allowed (applied before mask) */
  maxLength?: number;
  /**
   * Mask pattern. Placeholder chars: # = digit, A = letter, * = any.
   * Literal characters (spaces, dashes, parentheses, etc.) are auto-inserted.
   * Example: "(###) ###-###-####"
   */
  mask?: string;
  /** Casing transform applied on every keystroke */
  transform?: "uppercase" | "lowercase" | "capitalize";
  /**
   * Regex tested against each raw character before it is accepted.
   * Only characters matching this pattern are allowed through.
   * Example: /^\d+$/ to allow only digits (without a mask).
   */
  allowedPattern?: RegExp;
}

export function RHFTextField({
  name,
  label,
  placeholder,
  description,
  type = "text",
  fullWidth = true,
  disabled,
  readOnly,
  maxLength,
  mask,
  transform,
  allowedPattern,
}: Props) {
  const { control } = useFormContext();

  const handleChange = useCallback(
    (
      e: ChangeEvent<HTMLInputElement>,
      fieldOnChange: (...args: unknown[]) => void
    ) => {
      let value = e.target.value;

      if (allowedPattern) {
        value = value
          .split("")
          .filter((ch) => allowedPattern.test(ch))
          .join("");
      }

      if (mask) {
        const rawOnly = value
          .split("")
          .filter((ch) => /[\dA-Za-z]/.test(ch))
          .join("");
        value = applyMask(rawOnly, mask);
      }

      if (maxLength !== undefined) {
        value = value.slice(0, maxLength);
      }

      if (transform) {
        value = applyTransform(value, transform);
      }

      fieldOnChange(value);
    },
    [allowedPattern, mask, maxLength, transform]
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`${fullWidth ? "w-full" : ""}`}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              type={type}
              className={`${fullWidth ? "w-full" : ""}`}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              {...field}
              onChange={(e) => handleChange(e, field.onChange)}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
