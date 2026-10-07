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

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  fullWidth?: boolean;
  min?: number;
  max?: number;
}

export function RHFNumberField({
  name,
  label,
  placeholder,
  description,
  fullWidth = true,
  min,
  max,
}: Props) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`${fullWidth ? "w-full" : ""}`}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              className={`${fullWidth ? "w-full" : ""}`}
              placeholder={placeholder}
              {...field}
              value={field.value ?? ""}
              onKeyDown={(e) => {
                const input = e.currentTarget;
                const { value } = input;
                const key = e.key;

                if (
                  e.ctrlKey ||
                  e.metaKey ||
                  ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter"].includes(key)
                ) {
                  return;
                }

                if (key === "-") {
                  e.preventDefault();
                  const newValue = value.startsWith("-") ? value.slice(1) : "-" + value.replace(/^-/, "");
                  const numValue = newValue === "" || newValue === "-" ? null : Number(newValue);
                  
                  let finalValue = newValue;
                  if (numValue !== null) {
                    if (min !== undefined && numValue < min) {
                      finalValue = min.toString();
                    } else if (max !== undefined && numValue > max) {
                      finalValue = max.toString();
                    }
                  }
                  
                  e.currentTarget.value = finalValue;
                  field.onChange(finalValue === "" || finalValue === "-" ? "" : Number(finalValue));
                  return;
                }

                if (!/^\d$/.test(key)) {
                  e.preventDefault();
                  return;
                }
              }}
              onChange={(e) => {
                let val = e.target.value;

                val = val.replace(/[^0-9\-]/g, "");

                if (val.includes("-")) {
                  val = "-" + val.replace(/-/g, "");
                }

                if (/^-?0\d/.test(val)) {
                  val = val.replace(/^(-?)0+(\d)/, "$1$2");
                }

                const numVal = val === "" || val === "-" ? null : Number(val);
                
                if (numVal !== null) {
                  if (min !== undefined && numVal < min) {
                    val = min.toString();
                  } else if (max !== undefined && numVal > max) {
                    val = max.toString();
                  }
                }

                e.target.value = val;
                field.onChange(val === "" || val === "-" ? "" : Number(val));
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
