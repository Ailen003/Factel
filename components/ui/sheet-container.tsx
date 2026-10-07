"use client";
import { ReactNode, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

interface Props {
  title: string;
  trigger?: ReactNode;
  renderTrigger?: (openSheet: () => void) => ReactNode;
  description?: string;
  children: ReactNode | ((closeSheet: () => void) => ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function SheetContainer({
  title,
  trigger,
  renderTrigger,
  description,
  children,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const openSheet = () => setOpen(true);
  const closeSheet = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {renderTrigger ? renderTrigger(openSheet) : <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent>
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-primary">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          {typeof children === "function" ? children(closeSheet) : children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
