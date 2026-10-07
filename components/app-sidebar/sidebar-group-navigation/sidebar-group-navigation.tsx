import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GroupRoute } from "@/routes/groups-routes/groups-routes";
import SidebarMenuCollapsible from "../sidebar-menu-collapsible/sidebar-menu-collapsible";
import SideBarMenuButtonLink from "../sidebar-menu-button-link/sidebar-menu-button-link";

interface Props {
  group: GroupRoute;
}

export default function SidebarGroupNavigation({ group }: Props) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sm font-bold text-primary">
        {group.title}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-0.5 font-semibold text-foreground/80">
        {group.navigationRoutes.map((navigationRoute, index) =>
          navigationRoute.children ? (
            <SidebarMenuCollapsible key={index} item={navigationRoute} />
          ) : (
            <SidebarMenuItem key={index}>
              <SideBarMenuButtonLink
                title={navigationRoute.title}
                icon={navigationRoute.icon}
                path={navigationRoute.path}
                scroll={navigationRoute.scroll}
              />
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
