import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;

const OWNER_OPEN_ID = "owner-open-id";
const users = [
  {
    id: 1,
    openId: OWNER_OPEN_ID,
    name: "Tun Op",
    email: "optun2264@gmail.com",
    role: "admin" as const,
    loginMethod: "oauth",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-08-20T00:00:00Z"),
  },
  {
    id: 2,
    openId: "staff-open-id",
    name: "Ritz Staff",
    email: "staff@ritzsmp.test",
    role: "user" as const,
    loginMethod: "oauth",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    lastSignedIn: new Date("2026-08-19T00:00:00Z"),
  },
];

vi.mock("./_core/env", () => ({
  ENV: {
    ownerOpenId: "owner-open-id",
  },
}));

vi.mock("./db", () => ({
  getAllUsers: vi.fn(async () => users),
  getUserById: vi.fn(async (id: number) => users.find(user => user.id === id)),
  updateUserRole: vi.fn(async (id: number, role: "user" | "admin") => {
    const user = users.find(item => item.id === id);
    if (!user) return undefined;
    user.role = role;
    return user;
  }),
}));

function contextFor(openId: string, role: TestUser["role"]): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: openId === OWNER_OPEN_ID ? 1 : 2,
      openId,
      email: openId === OWNER_OPEN_ID ? "optun2264@gmail.com" : "staff@ritzsmp.test",
      name: openId === OWNER_OPEN_ID ? "Tun Op" : "Ritz Staff",
      loginMethod: "test",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("owner-only admin management", () => {
  it("lets the canonical owner list accounts and promote a user", async () => {
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));

    const listed = await caller.admin.users();
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: "optun2264@gmail.com", isOwner: true, role: "admin" }),
      expect.objectContaining({ email: "staff@ritzsmp.test", isOwner: false, role: "user" }),
    ]));

    const promoted = await caller.admin.setUserRole({ id: 2, role: "admin" });
    expect(promoted).toMatchObject({ id: 2, role: "admin", isOwner: false });
  });

  it("lets the owner remove admin from a non-owner account", async () => {
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    await caller.admin.setUserRole({ id: 2, role: "admin" });
    const demoted = await caller.admin.setUserRole({ id: 2, role: "user" });
    expect(demoted).toMatchObject({ id: 2, role: "user", isOwner: false });
  });

  it("blocks non-owner admins from managing accounts", async () => {
    const caller = appRouter.createCaller(contextFor("staff-open-id", "admin"));
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setUserRole({ id: 2, role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("protects the owner account from demotion", async () => {
    const caller = appRouter.createCaller(contextFor(OWNER_OPEN_ID, "admin"));
    await expect(caller.admin.setUserRole({ id: 1, role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
