interface Path {
  root: string;
  isProtected: boolean;
}

interface ApplicationPath {
  dashboard: Path;
  conversations: Path;
  clients: Path;
  requests: Path;
  users: Path;
  settings: Path;
  authLogin: Path;
}

export const paths: ApplicationPath = {
  dashboard: {
    root: "/dashboard",
    isProtected: true,
  },
  conversations: {
    root: "/conversations",
    isProtected: true,
  },
  clients: {
    root: "/clients",
    isProtected: true,
  },
  requests: {
    root: "/requests",
    isProtected: true,
  },
  users: {
    root: "/users",
    isProtected: true,
  },
  settings: {
    root: "/settings",
    isProtected: true,
  },
  authLogin: {
    root: "/auth/login",
    isProtected: false,
  },
} as const;
