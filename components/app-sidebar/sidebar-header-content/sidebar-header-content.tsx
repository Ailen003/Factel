"use client";
import { useSidebar } from "@/components/ui/sidebar";
import { Logo } from "@/modules/landing/components/logo";

export default function SidebarHeaderContent() {
  const { open } = useSidebar();
  return (
    <div className="flex items-center justify-center text-foreground">
      <Logo compact={!open} />
    </div>
  );
}
