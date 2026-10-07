"use client";
import React from "react";
import { Label } from "../../ui/label";
import { Search } from "lucide-react";
import { Input } from "../../ui/input";

interface Props {
  id: string;
  label?: string;
  placeHolder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  labelVariant?: "default" | "inside";
}

export default function SearchInput({
  id,
  label,
  placeHolder = "Introduzca valor a buscar",
  value,
  onChange,
  labelVariant = "default",
}: Props) {
  const showLabelOutside = label && labelVariant === "default";

  return (
    <div className="space-y-2 w-full">
      {showLabelOutside && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
        {labelVariant === "inside" && label && value && (
          <span className="absolute left-10 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground whitespace-nowrap pointer-events-none">
            {label}
          </span>
        )}
        <Input
          id={id}
          placeholder={placeHolder}
          value={value || ""}
          onChange={onChange}
          className={labelVariant === "inside" && label && value ? `pl-[${10 + label.length * 0.5}rem]` : "pl-10"}
          style={labelVariant === "inside" && label && value ? { paddingLeft: `${2.5 + label.length * 0.5}rem` } : undefined}
        />
      </div>
    </div>
  );
}
