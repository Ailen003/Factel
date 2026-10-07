"use client";
import { Badge } from "@/components/ui/badge";
import { XIcon } from "lucide-react";


interface Props {
  filterName: string;
  filterValue: string;
  handleDeleteFilter: () => void;
}

export default function FilterBadge({
  filterName,
  filterValue,
  handleDeleteFilter,
}: Props) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1" multiline>
      <span className="text-xs font-medium">{filterName}:</span>
      <span className="text-xs">{filterValue}</span>
      <button
        type="button"
        onClick={handleDeleteFilter}
        className="ml-1 rounded-sm hover:bg-muted p-0.5 transition-colors"
        aria-label={`Eliminar filtro ${filterName}`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </Badge>
  );
}
