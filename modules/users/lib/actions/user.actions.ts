"use server";

import {
  createUser,
  deleteManagedUser,
  editUser,
  getAllUsers,
  getUserById,
  getUsersStats,
  revokeUserSessions,
  setUserStatus,
} from "../services/user.services";
import { z } from "zod";
import { createUserSchema } from "../../form/create/schemas/create-user-schema";
import { editUserSchema } from "../../form/edit/schemas/edit-user-schema";
import {
  userFiltersSchema,
  type CreateUserDto,
  type EditUserDto,
  type UserFiltersDto,
} from "../types/user.types";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid input" },
});

const userIdSchema = z.string().trim().min(1).max(191);
const userStatusSchema = z.enum(["active", "suspended"]);

export async function getAllUsersAction(filters: UserFiltersDto) {
  const parsed = userFiltersSchema.safeParse(filters);
  return parsed.success ? getAllUsers(parsed.data) : validationError();
}

export async function getUserByIdAction(userId: string) {
  return typeof userId === "string" && userId.length > 0
    ? getUserById(userId)
    : validationError();
}

export async function getUsersStatsAction() {
  return getUsersStats();
}

export async function createUserAction(dto: CreateUserDto) {
  const parsed = createUserSchema.safeParse(dto);
  if (!parsed.success) return validationError();
  return createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    locale: parsed.data.locale,
    initialCreditAllocation: parsed.data.initialCreditAllocation,
  });
}

export async function editUserAction(userId: string, dto: EditUserDto) {
  const parsed = editUserSchema.safeParse(dto);
  if (!parsed.success || !userId) return validationError();
  return editUser(userId, {
    name: parsed.data.name,
    locale: parsed.data.locale,
  });
}

export async function setUserStatusAction(userId: string, status: unknown) {
  const parsedId = userIdSchema.safeParse(userId);
  const parsedStatus = userStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return validationError();
  return setUserStatus(parsedId.data, parsedStatus.data);
}

export async function revokeUserSessionsAction(userId: string) {
  const parsed = userIdSchema.safeParse(userId);
  return parsed.success ? revokeUserSessions(parsed.data) : validationError();
}

export async function deleteUserAction(userId: string) {
  const parsed = userIdSchema.safeParse(userId);
  return parsed.success ? deleteManagedUser(parsed.data) : validationError();
}
