import "server-only";

const pathSegment = (value: string): string => encodeURIComponent(value);

export const widgetApiRoutes = {
  widgets: {
    list: "/widgets",
    getById: (id: string) => `/widgets/${pathSegment(id)}`,
  },
  users: {
    list: "/users",
    getWidgets: (userId: string) =>
      `/users/${pathSegment(userId)}/widgets`,
  },
} as const;
