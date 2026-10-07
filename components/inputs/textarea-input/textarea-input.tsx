"use client";
import React from "react";
import { Label } from "../../ui/label";
import { Search } from "lucide-react";
import { Textarea } from "../../ui/textarea";

interface Props {
  id: string;
  label?: string;
  placeHolder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  labelVariant?: "default" | "inside";
}

export default function TextareaInput({
  id,
  label,
  placeHolder = "Escribe tu texto aquí...",
  value,
  onChange,
  rows = 4,
  labelVariant = "default",
}: Props) {
  const showLabelOutside = label && labelVariant === "default";

  return (
    <div className="space-y-2 w-full">
      {showLabelOutside && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        {labelVariant === "inside" && label && value && (
          <span className="absolute left-10 top-3 text-xs text-muted-foreground whitespace-nowrap pointer-events-none">
            {label}
          </span>
        )}
        <Textarea
          id={id}
          placeholder={placeHolder}
          value={value || ""}
          onChange={onChange}
          rows={rows}
          className="pl-10 min-h-20 resize-y"
          style={labelVariant === "inside" && label && value ? { paddingLeft: `${2.5 + label.length * 0.5}rem` } : undefined}
        />
      </div>
    </div>
  );
}
