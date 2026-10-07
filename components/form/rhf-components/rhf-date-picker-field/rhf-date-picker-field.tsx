"use client";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  fullWidth?: boolean;
  disableFutureDates?: boolean;
  disablePastDates?: boolean;
  minDate?: Date;
  maxDate?: Date;
  fromYear?: number;
  toYear?: number;
}

export function RHFDatePickerField({
  name,
  label,
  placeholder,
  description,
  fullWidth = true,
  disableFutureDates = false,
  disablePastDates = false,
  minDate,
  maxDate,
  fromYear,
  toYear,
}: Props) {
  const { control } = useFormContext();
  const t = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : undefined;

  const isDateDisabled = (date: Date) => {
    if (disableFutureDates && date > new Date()) return true;
    if (disablePastDates && date < new Date()) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`flex flex-col ${fullWidth ? "w-full" : ""}`}>
          {label && <FormLabel>{label}</FormLabel>}
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant={"outline"}
                  className={cn(
                    "pl-3 text-left font-normal",
                    !field.value && "text-muted-foreground",
                    fullWidth && "w-full"
                  )}
                >
                  {field.value ? (
                    format(field.value, "PPP", { locale: dateLocale })
                  ) : (
                    <span>{placeholder || t('selectDate')}</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={isDateDisabled}
                initialFocus
                captionLayout="dropdown"
                fromYear={fromYear}
                toYear={toYear}
              />
            </PopoverContent>
          </Popover>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
