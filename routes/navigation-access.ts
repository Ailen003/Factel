export function visibleNavigationPaths(
  canAccessAdministration: boolean,
): string[] {
  return canAccessAdministration
    ? ["/dashboard", "/conversations", "/clients", "/requests", "/users", "/settings"]
    : ["/dashboard", "/conversations", "/clients", "/requests"];
}
