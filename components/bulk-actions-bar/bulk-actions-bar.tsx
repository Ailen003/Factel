"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfirmationDialog, ConfirmationDialogVariant } from "../confirmation-dialog/confirmation-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkActionVariant = "default" | "destructive" | "success" | "warning" | "info"

export interface BulkActionConfirmation {
  /** Dialog title. Defaults to the action label. */
  title?: string
  /** Dialog description. */
  description?: string
  /** Confirm button label. Defaults to the action label. */
  confirmLabel?: string
  /** Extra classes for the confirm button. */
  confirmClassName?: string
}

export interface BulkAction<TId = string> {
  /** Unique key for this action. */
  key: string
  /** Label shown in the bar button. */
  label: string
  /** Lucide icon component. */
  icon: LucideIcon
  /**
   * Handler called with the selected IDs.
   * Return a Promise to show a loading spinner while it resolves.
   */
  onAction: (selectedIds: TId[]) => void | Promise<void>
  /** Color variant for the button. */
  variant?: BulkActionVariant
  /**
   * When provided, the action will show a confirmation dialog before
   * calling `onAction`.
   */
  confirmation?: BulkActionConfirmation
  /** Disable this action regardless of selection. */
  disabled?: boolean
  /** External loading state for this action. When true, shows loading spinner. */
  isLoading?: boolean
}

interface BulkActionsBarProps<TId = string> {
  /** List of currently selected IDs. The bar is hidden when empty. */
  selectedIds: TId[]
  /** Called when the user clicks "Clear selection". */
  onClearSelection: () => void
  /** List of actions available for the selection. */
  actions: BulkAction<TId>[]
  /**
   * Singular / plural display name for the entity.
   * e.g. { singular: "invoice", plural: "invoices" }
   */
  entityName?: { singular: string; plural: string }
}

// ─── Variant styles ───────────────────────────────────────────────────────────

const variantStyles: Record<BulkActionVariant, { button: string; confirmBtn: string }> = {
  default: {
    button: "text-gray-200 hover:text-white hover:bg-white/10",
    confirmBtn: "",
  },
  destructive: {
    button: "text-red-400 hover:text-red-300 hover:bg-red-900/30",
    confirmBtn: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  success: {
    button: "text-green-400 hover:text-green-300 hover:bg-green-900/30",
    confirmBtn: "bg-green-600 text-white hover:bg-green-700",
  },
  warning: {
    button: "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30",
    confirmBtn: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  info: {
    button: "text-blue-400 hover:text-blue-300 hover:bg-blue-900/30",
    confirmBtn: "bg-blue-600 text-white hover:bg-blue-700",
  },
}

// ─── Separator ────────────────────────────────────────────────────────────────

function Separator() {
  return <div className="h-4 w-px bg-gray-600 shrink-0" />
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkActionsBar<TId = string>({
  selectedIds,
  onClearSelection,
  actions,
  entityName = { singular: "item", plural: "items" },
}: BulkActionsBarProps<TId>) {
  // Track which action key is currently pending (loading) and which is open in a dialog
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [dialogKey, setDialogKey] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const count = selectedIds.length
  const label = count === 1 ? entityName.singular : entityName.plural

  const activeDialogAction = actions.find((a) => a.key === dialogKey)

  const handleTrigger = (action: BulkAction<TId>) => {
    if (action.confirmation) {
      setDialogKey(action.key)
    } else {
      runAction(action)
    }
  }

  const runAction = async (action: BulkAction<TId>) => {
    setPendingKey(action.key)
    try {
      await action.onAction(selectedIds)
      // Clear selection after successful action execution
      onClearSelection()
    } finally {
      setPendingKey(null)
      setDialogKey(null)
    }
  }

  return (
    <>
      {/* ── Bar ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/10">
          {/* Count */}
          <span className="text-sm font-medium whitespace-nowrap">
            {count} {label} selected
          </span>

          <Separator />

          {/* Actions */}
          {actions.map((action, index) => {
            const styles = variantStyles[action.variant ?? "default"]
            const isLoading = pendingKey === action.key || action.isLoading

            return (
              <div key={action.key} className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 px-3 text-sm gap-1.5", styles.button)}
                  onClick={() => handleTrigger(action)}
                  disabled={action.disabled || isLoading || pendingKey !== null}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <action.icon className="w-4 h-4" />
                  )}
                  {action.label}
                </Button>
                {index < actions.length - 1 && <Separator />}
              </div>
            )
          })}

          <Separator />

          {/* Clear */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm gap-1.5 text-gray-400 hover:text-gray-200 hover:bg-white/10"
            onClick={onClearSelection}
            disabled={pendingKey !== null}
          >
            <X className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* ── Confirmation dialog ── */}
      {activeDialogAction && (
        <ConfirmationDialog
          open={dialogKey !== null}
          onOpenChange={(open) => !open && setDialogKey(null)}
          title={
            activeDialogAction.confirmation?.title ??
            `${activeDialogAction.label} ${count} ${label}?`
          }
          description={
            activeDialogAction.confirmation?.description ??
            `You are about to ${activeDialogAction.label.toLowerCase()} ${count} ${label}. This action cannot be undone.`
          }
          confirmLabel={activeDialogAction.confirmation?.confirmLabel ?? activeDialogAction.label}
          onConfirm={() => { runAction(activeDialogAction) }}
          isLoading={pendingKey === activeDialogAction.key}
          variant={activeDialogAction.variant as ConfirmationDialogVariant ?? "default"}
          confirmClassName={activeDialogAction.confirmation?.confirmClassName}
          disabled={pendingKey !== null}
        />
      )}
    </>
  )
}
