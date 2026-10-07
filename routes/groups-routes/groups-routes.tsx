"use client";

import { ReactNode } from "react";
import {
  LayoutDashboard,
  ContactRound,
  ListChecks,
  Users,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { paths } from "../paths";
import { visibleNavigationPaths } from "../navigation-access";

export interface GroupRoute {
  title: string;
  navigationRoutes: NavigationRoute[];
}

export interface NavigationRoute {
  title: string;
  path: string;
  icon?: ReactNode;
  isActive?: boolean;
  children?: NavigationRoute[];
  scroll?: boolean;
}

export function useGroupRoutes(
  canAccessAdministration: boolean,
): { routes: GroupRoute[]; isLoading: boolean } {
  const tGroups = useTranslations("sidebar.groups");
  const tNav = useTranslations("sidebar.navigation");

  const visiblePaths = visibleNavigationPaths(canAccessAdministration);
  const routes: GroupRoute[] = [
    {
      title: tGroups("metrics"),
      navigationRoutes: [
        {
          title: tNav("dashboard"),
          icon: <LayoutDashboard className="text-accent" />,
          path: paths.dashboard.root,
        },
      ],
    },
    {
      title: tGroups("workspace"),
      navigationRoutes: [
        {
          title: tNav("conversations"),
          icon: <MessagesSquare className="text-accent" />,
          path: paths.conversations.root,
        },
        {
          title: tNav("clients"),
          icon: <ContactRound className="text-accent" />,
          path: paths.clients.root,
        },
        {
          title: tNav("requests"),
          icon: <ListChecks className="text-accent" />,
          path: paths.requests.root,
        },
      ],
    },
    ...(visiblePaths.includes(paths.users.root) ? [{
      title: tGroups("admin"),
      navigationRoutes: [
        {
          title: tNav("users"),
          icon: <Users className="text-accent" />,
          path: paths.users.root,
        },
        {
          title: tNav("settings"),
          icon: <Settings className="text-accent" />,
          path: paths.settings.root,
        },
      ],
    }] : []),
  ];

  return { routes, isLoading: false };
}
