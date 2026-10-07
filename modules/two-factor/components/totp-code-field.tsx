"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function TotpCodeField({
  name,
  label,
  description,
  disabled,
  autoFocus,
}: {
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { control } = useFormContext();
  const labelId = useId();
  const descriptionId = useId();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel id={labelId}>{label}</FormLabel>
          <FormControl>
            <InputOTP
              {...field}
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus={autoFocus}
              disabled={disabled}
              aria-labelledby={labelId}
              aria-describedby={description ? descriptionId : undefined}
              aria-invalid={fieldState.invalid}
              containerClassName="justify-center sm:justify-start"
              onChange={(value) => field.onChange(value.replace(/\D/g, "").slice(0, 6))}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </FormControl>
          {description && <FormDescription id={descriptionId}>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
