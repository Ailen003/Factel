"use client";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { ReactNode } from "react";

interface Props {
  title: string;
  icon: ReactNode;
  path: string;
  scroll?: boolean;
}

export default function SideBarMenuButtonLink({
  title,
  icon,
  path,
  scroll = true,
}: Props) {
  const currentPath = usePathname();
  const isActive = currentPath === path || currentPath.startsWith(`${path}/`);
  return (
    <Link className="flex gap-2 w-full" scroll={scroll} href={path}>
      <SidebarMenuButton
        className="text-[13px] font-bold hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
        isActive={isActive}
        tooltip={title}
      >
        {icon && icon}
        <span className="font-bold text-sm">{title}</span>
      </SidebarMenuButton>
    </Link>
  );
}
