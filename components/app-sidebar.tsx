"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOutIcon, Menu, User } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { paths } from "@/routes/paths";
import { authClient } from "@/lib/auth/auth-client";
import type { AuthActor } from "@/lib/auth/types";

function UserMenu({ actor }: { actor: AuthActor }) {
  const t = useTranslations("user");
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  const handleSignOut = async () => {
    const result = await authClient.signOut();
    if (result.error) {
      toast.error(t("signOutError"));
      return;
    }
    window.location.assign(`/${locale}${paths.authLogin.root}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span className="hidden max-w-[120px] truncate sm:inline">
            {actor.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {actor.email}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          <LogOutIcon className="mr-2 h-4 w-4" />
          <span>{t("signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DesktopHeader({ actor }: { actor: AuthActor }) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-2 border-b bg-background px-4 py-2.5 md:flex">
      <SidebarTrigger>
        <Menu className="h-5 w-5" />
      </SidebarTrigger>
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <UserMenu actor={actor} />
      </div>
    </header>
  );
}

export function MobileHeader({ actor }: { actor: AuthActor }) {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("app");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 py-2.5 md:hidden">
      <SidebarTrigger>
        <Menu className="h-5 w-5" />
      </SidebarTrigger>
      <Link href={`/${locale}${paths.dashboard.root}`} className="flex items-center gap-2.5">
        <span className="text-lg font-semibold tracking-tight">{t("name")}</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <UserMenu actor={actor} />
      </div>
    </header>
  );
}
