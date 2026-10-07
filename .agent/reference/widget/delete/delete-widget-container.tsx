"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDeleteWidget } from "../lib/hooks/use-delete-widget";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteWidgetContainer({ widgetId, open, onOpenChange }: Props) {
  const t = useTranslations("widgetDetails");
  const router = useRouter();

  const { deleteWidget, isLoading } = useDeleteWidget({
    onSuccess: () => {
      toast.success(t("deleteSuccess"), { position: "top-right" });
      onOpenChange(false);
      setTimeout(() => { router.refresh(); }, 300);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteWidget")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmDelete")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteWidget(widgetId)}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? t("deleting") : t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
