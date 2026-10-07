import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  editUser: vi.fn(),
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  getUsersStats: vi.fn(),
  setUserStatus: vi.fn(),
  revokeUserSessions: vi.fn(),
  deleteManagedUser: vi.fn(),
}));

vi.mock("../services/user.services", () => serviceMocks);

import {
  createUserAction,
  deleteUserAction,
  editUserAction,
  revokeUserSessionsAction,
  setUserStatusAction,
} from "./user.actions";

describe("user administration actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("strips forged role and password fields before administrative creation", async () => {
    serviceMocks.createUser.mockResolvedValue({ success: true, data: {} });

    await createUserAction({
      name: "Alex Rivera",
      email: "ALEX@example.com",
      locale: "es",
      initialCreditAllocation: 12,
      role: "platform_admin",
      password: "attacker-chosen-password",
    } as never);

    expect(serviceMocks.createUser).toHaveBeenCalledWith({
      name: "Alex Rivera",
      email: "alex@example.com",
      locale: "es",
      initialCreditAllocation: 12,
    });
  });

  it("strips role from generic edits", async () => {
    serviceMocks.editUser.mockResolvedValue({ success: true, data: {} });

    await editUserAction("target", {
      name: "Valid name",
      role: "platform_admin",
      locale: "es",
    } as never);

    expect(serviceMocks.editUser).toHaveBeenCalledWith("target", {
      name: "Valid name",
      locale: "es",
    });
  });

  it("rejects invalid create and edit payloads before calling services", async () => {
    const createResult = await createUserAction({
      name: "A",
      email: "not-an-email",
      locale: "en",
      initialCreditAllocation: 10,
    });
    const editResult = await editUserAction("target", {
      name: "Valid name",
      role: "forged-role",
    } as never);

    expect(createResult).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(editResult).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(serviceMocks.createUser).not.toHaveBeenCalled();
    expect(serviceMocks.editUser).not.toHaveBeenCalled();
  });

  it("validates lifecycle action identifiers and statuses", async () => {
    serviceMocks.setUserStatus.mockResolvedValue({ success: true, data: {} });
    serviceMocks.revokeUserSessions.mockResolvedValue({ success: true, data: {} });
    serviceMocks.deleteManagedUser.mockResolvedValue({ success: true, data: {} });

    await setUserStatusAction(" user-1 ", "suspended");
    await revokeUserSessionsAction("user-1");
    await deleteUserAction("user-1");
    const invalid = await setUserStatusAction("", "deleted");

    expect(serviceMocks.setUserStatus).toHaveBeenCalledWith("user-1", "suspended");
    expect(serviceMocks.revokeUserSessions).toHaveBeenCalledWith("user-1");
    expect(serviceMocks.deleteManagedUser).toHaveBeenCalledWith("user-1");
    expect(invalid).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });
});
