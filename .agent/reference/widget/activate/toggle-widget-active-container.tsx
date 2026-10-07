"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useToggleWidgetActive } from "../lib/hooks/use-toggle-widget-active";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  widgetId: string;
  isActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ToggleWidgetActiveContainer({ widgetId, isActive, open, onOpenChange }: Props) {
  const t = useTranslations("widgetDetails");
  const router = useRouter();

  const { toggleWidgetActive, isLoading } = useToggleWidgetActive({
    onSuccess: () => {
      toast.success(t(isActive ? "deactivateSuccess" : "activateSuccess"), { position: "top-right" });
      onOpenChange(false);
      setTimeout(() => { router.refresh(); }, 300);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? t("deactivateWidget") : t("activateWidget")}</AlertDialogTitle>
          <AlertDialogDescription>
            {isActive ? t("confirmDeactivate") : t("confirmActivate")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => toggleWidgetActive(widgetId, !isActive)}
            disabled={isLoading}
          >
            {isLoading ? t("updating") : isActive ? t("deactivate") : t("activate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
