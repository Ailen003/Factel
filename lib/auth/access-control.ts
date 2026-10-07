import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const authStatements = {
  ...defaultStatements,
} as const;

export const authAccessControl = createAccessControl(authStatements);

export const platformAdminRole = authAccessControl.newRole({
  user: [],
  session: [],
});

export const trialUserRole = authAccessControl.newRole({
  user: [],
  session: [],
});

export const authRoles = {
  platform_admin: platformAdminRole,
  trial_user: trialUserRole,
} as const;
