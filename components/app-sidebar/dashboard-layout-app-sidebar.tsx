"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useGroupRoutes } from "@/routes/groups-routes/groups-routes";
import SidebarHeaderContent from "./sidebar-header-content/sidebar-header-content";
import SidebarGroupNavigation from "./sidebar-group-navigation/sidebar-group-navigation";

export function DashBoardLayoutAppSidebar({
  canAccessAdministration,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  canAccessAdministration: boolean;
}) {
  const { routes: groupRoutes, isLoading } = useGroupRoutes(canAccessAdministration);

  return (
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader className="flex items-center justify-center rounded-xl p-4 ">
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContent className="rounded-xl">
        {isLoading ? (
          <div className="flex flex-col gap-4 p-4">
            {[...Array(3)].map((_, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-2">
                <div className="h-5 w-24 rounded bg-primary/10" />
                <div className="flex flex-col gap-1.5 pl-2">
                  {[...Array(groupIndex === 0 ? 4 : groupIndex === 1 ? 3 : 2)].map((_, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-3 h-9 px-2">
                      <div className="h-5 w-5 rounded-md bg-primary/10" />
                      <div className="h-4 flex-1 rounded bg-primary/10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          groupRoutes.map((groupRoute, index) => (
            <div
              key={index}
              className="flex flex-col justify-center items-center w-full gap-2"
            >
              <SidebarGroupNavigation group={groupRoute} />
            </div>
          ))
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
