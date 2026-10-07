"use client"

import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { AlertComponent } from "@/components/ui/alert-component"

export type ConfirmationDialogVariant = "default" | "destructive" | "success" | "warning" | "info"

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Dialog title */
  title: string
  /** Dialog description */
  description?: string
  /** Confirm button label */
  confirmLabel?: string
  /** Cancel button label */
  cancelLabel?: string
  /** Called when confirm is clicked */
  onConfirm: () => void | Promise<void>
  /** Whether the action is currently loading */
  isLoading?: boolean
  /** Color variant for the confirm button */
  variant?: ConfirmationDialogVariant
  /** Extra classes for the confirm button */
  confirmClassName?: string
  /** Whether the dialog should be disabled */
  disabled?: boolean
  /** Error message to display */
  error?: string | null
}

const variantStyles: Record<ConfirmationDialogVariant, string> = {
  default: "",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-green-600 text-white hover:bg-green-700",
  warning: "bg-yellow-500 text-white hover:bg-yellow-600",
  info: "bg-blue-600 text-white hover:bg-blue-700",
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
  variant = "default",
  confirmClassName,
  disabled = false,
  error,
}: ConfirmationDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {error && <AlertComponent title={error} variant="destructive" />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled || isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(variantStyles[variant], confirmClassName)}
            onClick={handleConfirm}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {confirmLabel}...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
