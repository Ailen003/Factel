"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type MaxWidth =
  | "xs"    // 20rem  / 320px
  | "sm"    // 24rem  / 384px
  | "md"    // 28rem  / 448px
  | "lg"    // 32rem  / 512px
  | "xl"    // 36rem  / 576px
  | "2xl"   // 42rem  / 672px
  | "3xl"   // 48rem  / 768px
  | "4xl"   // 56rem  / 896px
  | "5xl"   // 64rem  / 1024px
  | "full"  // 100%

type MaxHeight =
  | "sm"    // 40vh
  | "md"    // 60vh
  | "lg"    // 75vh
  | "xl"    // 85vh
  | "full"  // 95vh

export interface ModalProps {
  /** Controls whether the modal is open */
  open: boolean
  /** Callback fired when the modal requests to be closed */
  onOpenChange: (open: boolean) => void
  /** Optional title rendered in the modal header */
  title?: React.ReactNode
  /** Optional subtitle / description rendered below the title */
  description?: React.ReactNode
  /** Optional icon rendered in the modal header */
  icon?: React.ReactNode
  /** Main content of the modal */
  children: React.ReactNode
  /** Optional footer content (action buttons, etc.) */
  footer?: React.ReactNode
  /** Maximum width of the modal. Defaults to "lg" */
  maxWidth?: MaxWidth
  /** Maximum height of the scrollable body. When set, the body becomes scrollable */
  maxHeight?: MaxHeight
  /** Whether to show the close (X) button in the top-right corner. Defaults to true */
  showCloseButton?: boolean
  /** Localized accessible label for the close button. */
  closeLabel?: string
  /** Whether clicking the overlay closes the modal. Defaults to true */
  closeOnOverlayClick?: boolean
  /** Additional class names applied to the dialog content wrapper */
  className?: string
  /** Additional class names applied to the inner body (children wrapper) */
  bodyClassName?: string
  /** Additional class names applied to the footer wrapper */
  footerClassName?: string
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

const maxWidthMap: Record<MaxWidth, string> = {
  xs:    "max-w-xs",
  sm:    "max-w-sm",
  md:    "max-w-md",
  lg:    "max-w-lg",
  xl:    "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full:  "max-w-full",
}

const maxHeightMap: Record<MaxHeight, string> = {
  sm:   "max-h-[40vh]",
  md:   "max-h-[60vh]",
  lg:   "max-h-[75vh]",
  xl:   "max-h-[88vh]",
  full: "max-h-[95vh]",
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal — a standardised dialog wrapper built on top of the Radix Dialog
 * primitive.  Pass any content via `children`; configure it through props.
 *
 * @example
 * <Modal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Confirm action"
 *   description="This cannot be undone."
 *   maxWidth="md"
 *   footer={<Button onClick={() => setIsOpen(false)}>Accept</Button>}
 * >
 *   <p>Modal body goes here.</p>
 * </Modal>
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = "lg",
  maxHeight,
  showCloseButton = true,
  closeLabel = "Close modal",
  closeOnOverlayClick = true,
  className,
  bodyClassName,
  footerClassName,
}: ModalProps) {
  const hasHeader = Boolean(title || description)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
          // Prevent overlay click from closing when closeOnOverlayClick is false
          onClick={closeOnOverlayClick ? undefined : (e) => e.stopPropagation()}
        />

        {/* Content */}
        <DialogPrimitive.Content
          onInteractOutside={
            closeOnOverlayClick ? undefined : (e) => e.preventDefault()
          }
          className={cn(
            // Positioning & animation
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            // Layout
            "flex flex-col w-full overflow-hidden",
            "rounded-lg bg-background shadow-lg duration-200",
            maxWidthMap[maxWidth],
            className,
          )}
        >
          {/*
            DialogPrimitive.Title and DialogPrimitive.Description must always
            be present in the DOM so Radix can set aria-labelledby /
            aria-describedby on the Content and suppress its a11y warnings.
            When there is no user-facing title or description we render them
            hidden with the sr-only utility class.
          */}

          {/* ── Header ──────────────────────────────────────────── */}
          {hasHeader ? (
            <div className="px-6 pt-6 pb-4 bg-accent/15 border-b border-border">
              <div className="flex items-center gap-3">
                {icon && icon}
                <div className="flex-1 min-w-0">
                  {/* Title — always in DOM; visually hidden when not provided */}
                  <DialogPrimitive.Title
                    className={cn(
                      "text-base font-semibold leading-tight text-foreground sm:text-lg",
                      !title && "sr-only",
                    )}
                  >
                    {title ?? "Dialog"}
                  </DialogPrimitive.Title>

                  {/* Description — always in DOM; visually hidden when not provided */}
                  <DialogPrimitive.Description
                    className={cn(
                      "text-xs text-foreground sm:text-sm",
                      !description ? "sr-only" : "mt-1",
                    )}
                  >
                    {description ?? "Dialog content"}
                  </DialogPrimitive.Description>
                </div>
              </div>
            </div>
          ) : (
            /* No visible header — still keep both elements in DOM, hidden */
            <>
              <DialogPrimitive.Title className="sr-only">
                Dialog
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Dialog content
              </DialogPrimitive.Description>
            </>
          )}

          {/* ── Close button ────────────────────────────────────── */}
          {showCloseButton && (
            <DialogPrimitive.Close
              className={cn(
                "absolute right-4 top-4 z-10",
                "rounded-sm p-1",
                "text-foreground",
                "transition-opacity hover:opacity-70",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:pointer-events-none",
              )}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}

          {/* ── Body ────────────────────────────────────────────── */}
          <div
            className={cn(
              "flex-1 px-6 py-5",
              maxHeight && [maxHeightMap[maxHeight], "overflow-y-auto"],
              bodyClassName,
            )}
          >
            {children}
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          {footer && (
            <div
              className={cn(
                "flex flex-col-reverse gap-2 px-6 py-4",
                "border-t border-border bg-muted/40",
                "sm:flex-row sm:justify-end",
                footerClassName,
              )}
            >
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
