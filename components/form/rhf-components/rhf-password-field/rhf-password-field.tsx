"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function RHFPasswordField({
  name,
  label,
  placeholder,
  description,
  autoComplete,
  fullWidth = true,
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
}: {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  fullWidth?: boolean;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}) {
  const { control } = useFormContext();
  const [showPassword, setShowPassword] = useState(false);
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={fullWidth ? "w-full" : undefined}>
          {label && <FormLabel>{label}</FormLabel>}
          <div className="relative">
            <FormControl>
              <Input
                type={showPassword ? "text" : "password"}
                className={`${fullWidth ? "w-full" : ""} pr-10`}
                placeholder={placeholder}
                autoComplete={autoComplete}
                {...field}
              />
            </FormControl>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span className="sr-only">{showPassword ? hidePasswordLabel : showPasswordLabel}</span>
            </Button>
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
