"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function SensitiveCodeField({
  name,
  label,
  description,
  placeholder,
  disabled,
  autoFocus,
}: {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { control } = useFormContext();
  const descriptionId = useId();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus={autoFocus}
              aria-describedby={description ? descriptionId : undefined}
            />
          </FormControl>
          {description && <FormDescription id={descriptionId}>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
