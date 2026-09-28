import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { adminProcedure, ownerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import {
  createOrder,
  getAllOrders,
  getOrdersByUser,
  getOrderById,
  getRankById,
  getRanks,
  getUserById,
  getUserByEmail,
  upsertUser,
  getAllUsers,
  updateUserRole,
  updateOrder,
  getUserWallet,
  getUserWalletTransactions,
  adjustUserBalance,
  getManagedServers,
  getEnabledManagedServers,
  getManagedServerConfig,
  createManagedServer,
  updateManagedServer,
  getRecentHealthEvents,
  getPlayerReportDashboardStats,
  getMinecraftPresenceState,
  setMinecraftPresenceScheduleTaskUid,
} from "./db";
import { ENV } from "./_core/env";
import { Rcon } from "rcon-client";
import { storagePut } from "./storage";
import type { Order } from "../drizzle/schema";
import { getRitzSmpAiBotStatus } from "./discordAiBot";
import { getManagedServerRuntimeConfig, runtimeConfigForClient } from "./multiserverRuntime";
import { notifyPurchaseCompleted, notifyTopupSubmitted } from "./discordNotifications";
import { fetchMinecraftServerStatus } from "./minecraftIntegration";
import { createLocalSession, hashPassword, verifyPassword, LOCAL_SESSION_MAX_AGE_MS } from "./_core/localAuth";

const allowedSlipTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const orderStatus = z.enum(["รอตรวจสอบ", "สำเร็จ", "ยกเลิก"]);
const coinRewards = [100, 250, 450, 700, 1000, 1200, 1350, 1420, 1470, 1500] as const;
const getCoinRewardForRank = (rankId: number) => coinRewards[Math.min(Math.max(rankId - 1, 0), coinRewards.length - 1)] ?? 100;
const publicUser = (user: NonNullable<TrpcContext["user"]> | null) => {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

/** รายการสาธารณะหลักของ RitzSMP ใช้เฉพาะเมื่อ owner ยังไม่ได้สร้าง registry row */
const PUBLIC_RITZSMP_DIRECTORY_ENTRY = {
  id: 0,
  slug: "ritzsmp",
  displayName: "RitzSMP",
  minecraftHost: "ritz.mcsv.me",
  minecraftPort: 25565,
  discordGuildId: null,
  enabled: 1,
  updatedAt: new Date(0),
} as const;

const sanitizeFileName = (value: string) => {
  const normalized = value.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-");
  return normalized.slice(-80) || "payment-slip";
};

const decodeSlip = (slipData: string, slipType: (typeof allowedSlipTypes)[number]) => {
  const match = slipData.match(/^data:[^;]+;base64,(.+)$/);
  if (!match?.[1]) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "รูปสลิปไม่ถูกต้อง" });
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > 6 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ไฟล์สลิปต้องมีขนาดไม่เกิน 6 MB" });
  }
  if (buffer.length < 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์สลิปว่างเปล่าหรือไม่สมบูรณ์" });
  }
  return { buffer, slipType };
};

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true, service: "ritz-smp-store" })),
    botStatus: adminProcedure.query(async () => {
      try {
        const status = getRitzSmpAiBotStatus();
        const healthEvents = await getRecentHealthEvents({ limit: 12 });
        return { ...status, healthEvents };
      } catch (e) {
        return {
          status: "offline" as const,
          username: null,
          totalInteractions: 0,
          logs: [{ timestamp: new Date().toISOString(), level: "ERROR" as const, message: String(e) }],
          healthEvents: [],
        };
      }
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => publicUser(opts.ctx.user)),
    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร").max(64),
        email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง").max(320),
        password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        if (await getUserByEmail(normalizedEmail)) {
          throw new TRPCError({ code: "CONFLICT", message: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ" });
        }
        await upsertUser({
          openId: `local_${randomUUID()}`,
          name: input.name.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(input.password),
          loginMethod: "local",
          role: normalizedEmail === ENV.ownerEmail ? "admin" : "user",
          lastSignedIn: new Date(),
        });
        const user = await getUserByEmail(normalizedEmail);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "สร้างบัญชีไม่สำเร็จ" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, createLocalSession(user.id), { ...cookieOptions, sameSite: "lax", maxAge: LOCAL_SESSION_MAX_AGE_MS });
        return publicUser(user);
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง").max(320),
        password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.trim().toLowerCase());
        if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
        }
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const refreshedUser = await getUserByEmail(input.email.trim().toLowerCase());
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, createLocalSession(user.id), { ...cookieOptions, sameSite: "lax", maxAge: LOCAL_SESSION_MAX_AGE_MS });
        return publicUser(refreshedUser ?? user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  servers: router({
    list: publicProcedure.query(async () => {
      const servers = await getEnabledManagedServers();
      const visibleServers = servers.length > 0 ? servers : [PUBLIC_RITZSMP_DIRECTORY_ENTRY];
      return visibleServers.map(server => ({
        id: server.id,
        slug: server.slug,
        displayName: server.displayName,
        minecraftHost: server.minecraftHost,
        minecraftPort: server.minecraftPort,
        discordGuildId: server.discordGuildId,
        enabled: server.enabled === 1,
        updatedAt: server.updatedAt,
      }));
    }),
    status: publicProcedure.query(async () => {
      const status = await fetchMinecraftServerStatus({ timeoutMs: 2500 });
      return {
        online: status.online,
        players: status.players,
        maxPlayers: status.maxPlayers,
        playerNames: status.playerNames,
        playerListKnown: status.playerListKnown,
        version: status.version,
        latency: status.latency,
        motd: status.motd,
        checkedAt: new Date().toISOString(),
      };
    }),
    adminList: ownerProcedure.query(async () => {
      const servers = await getManagedServers();
      return Promise.all(servers.map(async server => {
        const config = await getManagedServerConfig(server.id);
        let channelConfig: Record<string, string> = {};
        try {
          channelConfig = config?.channelConfig ? JSON.parse(config.channelConfig) : {};
        } catch {
          channelConfig = {};
        }
        return {
          ...server,
          enabled: server.enabled === 1,
          config: config ? { ...config, channelConfig } : null,
        };
      }));
    }),
    create: ownerProcedure
      .input(z.object({
        slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, "Slug ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดกลาง"),
        displayName: z.string().trim().min(2).max(128),
        minecraftHost: z.string().trim().min(1).max(255),
        minecraftPort: z.number().int().min(1).max(65535).default(25565),
        discordGuildId: z.string().trim().max(64).nullable().optional(),
        enabled: z.boolean().default(true),
        config: z.object({
          discordTokenEnv: z.string().trim().max(128).nullable().optional(),
          rconHost: z.string().trim().max(255).nullable().optional(),
          rconPort: z.number().int().min(1).max(65535).nullable().optional(),
          rconPasswordEnv: z.string().trim().max(128).nullable().optional(),
          channelConfig: z.record(z.string(), z.string().trim().max(80)).default({}),
        }),
      }))
      .mutation(async ({ input }) => createManagedServer({
        ...input,
        config: { ...input.config, channelConfig: JSON.stringify(input.config.channelConfig) },
      })),
    presenceSchedule: ownerProcedure
      .input(z.object({ action: z.enum(["create", "pause", "resume"]) }))
      .mutation(async ({ ctx, input }) => {
        const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
        const userSession = cookies[COOKIE_NAME] ?? "";
        const state = await getMinecraftPresenceState();
        if (input.action === "create") {
          if (state?.scheduleCronTaskUid) {
            throw new TRPCError({ code: "CONFLICT", message: "ระบบตรวจสถานะเซิร์ฟเวอร์มี schedule อยู่แล้ว" });
          }
          const created = await createHeartbeatJob({
            name: "ritz-smp-minecraft-presence",
            cron: "0 * * * * *",
            path: "/api/scheduled/minecraft-presence",
            method: "POST",
            description: "ตรวจสถานะและผู้เล่น Minecraft RitzSMP ทุก 1 นาที",
          }, userSession);
          await setMinecraftPresenceScheduleTaskUid(created.taskUid);
          return { action: input.action, taskUid: created.taskUid, nextExecutionAt: created.nextExecutionAt ?? null };
        }
        if (!state?.scheduleCronTaskUid) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ยังไม่มี schedule ระบบตรวจสถานะเซิร์ฟเวอร์" });
        }
        const updated = await updateHeartbeatJob(state.scheduleCronTaskUid, { enable: input.action === "resume" }, userSession);
        return { action: input.action, taskUid: state.scheduleCronTaskUid, nextExecutionAt: updated.nextExecutionAt ?? null };
      }),
    presenceScheduleStatus: ownerProcedure.query(async () => {
      const state = await getMinecraftPresenceState();
      let playerCount = 0;
      if (state?.lastPlayerNames) {
        try {
          const parsed = JSON.parse(state.lastPlayerNames);
          playerCount = Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string").length : 0;
        } catch {
          playerCount = 0;
        }
      }
      return {
        configured: Boolean(state?.scheduleCronTaskUid),
        lastOnline: Boolean(state?.lastOnline),
        playerListKnown: Boolean(state?.playerListKnown),
        lastPlayerCount: playerCount,
        lastCheckedAt: state?.lastCheckedAt ?? null,
      };
    }),
    runtime: ownerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const runtime = await getManagedServerRuntimeConfig(input.id);
        if (!runtime) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบเซิร์ฟเวอร์ที่เปิดใช้งานหรือยังไม่ได้ตั้งค่าระบบ" });
        return runtimeConfigForClient(runtime);
      }),
    update: ownerProcedure
      .input(z.object({
        id: z.number().int().positive(),
        displayName: z.string().trim().min(2).max(128),
        minecraftHost: z.string().trim().min(1).max(255),
        minecraftPort: z.number().int().min(1).max(65535),
        discordGuildId: z.string().trim().max(64).nullable().optional(),
        enabled: z.boolean(),
        config: z.object({
          discordTokenEnv: z.string().trim().max(128).nullable().optional(),
          rconHost: z.string().trim().max(255).nullable().optional(),
          rconPort: z.number().int().min(1).max(65535).nullable().optional(),
          rconPasswordEnv: z.string().trim().max(128).nullable().optional(),
          channelConfig: z.record(z.string(), z.string().trim().max(80)).default({}),
        }),
      }))
      .mutation(async ({ input }) => updateManagedServer({
        ...input,
        config: { ...input.config, channelConfig: JSON.stringify(input.config.channelConfig) },
      })),
  }),
  store: router({
    ranks: publicProcedure.query(() => getRanks()),
    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),
    wallet: protectedProcedure.query(async ({ ctx }) => {
      const wallet = await getUserWallet(ctx.user.id);
      const transactions = await getUserWalletTransactions(ctx.user.id);
      return {
        balance: wallet.balance,
        transactions,
      };
    }),
    createTopup: protectedProcedure
      .input(
        z.object({
          amount: z.number().positive("กรุณาระบุจำนวนเงินที่ต้องการเติม"),
          paymentMethod: z.enum(["ธนาคารออมสิน", "PromptPay", "TrueMoney Wallet"]),
          slipData: z.string().min(100).max(8_500_000),
          slipName: z.string().max(160).default("topup-slip"),
          slipType: z.enum(allowedSlipTypes),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const amountNum = Number(input.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "จำนวนเงินเติมไม่ถูกต้อง" });
        }

        const { buffer, slipType } = decodeSlip(input.slipData, input.slipType);
        const fileName = `${Date.now()}-${sanitizeFileName(input.slipName)}`;
        const stored = await storagePut(`topups/${ctx.user.id}/${fileName}`, buffer, slipType);
        
        // Create an order with rankId = 0 representing a top-up
        const order = await createOrder({
          userId: ctx.user.id,
          minecraftIGN: ctx.user.name ?? "TopupUser",
          rankId: 0,
          rankName: `เติมเงินเข้ากระเป๋า (${amountNum} บาท)`,
          amount: amountNum.toFixed(2),
          paymentMethod: input.paymentMethod,
          slipUrl: stored.url,
          slipKey: stored.key,
          status: "รอตรวจสอบ",
        });

        const notificationSent = await notifyOwner({
          title: `RitzSMP: แจ้งเติมเงินใหม่ #${order.id}`,
          content: [
            `ผู้ใช้: ${ctx.user.name ?? "ไม่ระบุชื่อ"}`,
            `ยอดเติม: ${order.amount} บาท`,
            `ช่องทาง: ${order.paymentMethod}`,
            `สถานะ: ${order.status}`,
          ].join("\n"),
        });
        const discordNotification = await notifyTopupSubmitted({
          order,
          userName: ctx.user.name ?? ctx.user.email ?? "ไม่ระบุชื่อ",
          slipType,
        }).catch(error => {
          console.error("[DiscordNotifications] Top-up notification failed:", error);
          return { sent: false, reason: error instanceof Error ? error.message : String(error) };
        });

        return { order, notificationSent, discordNotification };
      }),

    purchaseRank: protectedProcedure
      .input(
        z.object({
          rankId: z.number().int().positive(),
          minecraftIGN: z.string().trim().min(3, "กรุณาระบุชื่อในเกม").max(64),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const rank = await getRankById(input.rankId);
        if (!rank) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบยศที่เลือก" });
        }
        const priceNum = Number(rank.price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ยศนี้ยังไม่ได้กำหนดราคาจริง" });
        }

        const wallet = await getUserWallet(ctx.user.id);
        const currentBalance = Number(wallet.balance);
        if (currentBalance < priceNum) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `ยอดเงินในกระเป๋าของคุณไม่พอ (มีอยู่ ${currentBalance.toLocaleString("th-TH")} บาท, ต้องการ ${priceNum.toLocaleString("th-TH")} บาท) กรุณาเติมเงินก่อนซื้อยศ`,
          });
        }

        // Deduct balance and record purchase
        const refKey = `purchase-rank-${ctx.user.id}-${rank.id}-${Date.now()}-${randomUUID()}`;
        await adjustUserBalance(
          ctx.user.id,
          -priceNum,
          "purchase",
          `ซื้อยศ ${rank.displayName} สำหรับ IGN: ${input.minecraftIGN}`,
          refKey,
        );

        // Execute RCON immediately for both rank and points (เหรียญ)
        const rankCmd = `lp user ${input.minecraftIGN} parent add ${rank.name.toLowerCase()}`;
        // Determine coin/points reward amount based on rank price or rank level
        const coinAmount = getCoinRewardForRank(rank.id);
        const pointsCmd = `points give ${input.minecraftIGN} ${coinAmount}`;

        let rconDetail = "ยังไม่ได้ตั้งค่า RCON จึงรอตรวจสอบการเติมยศ";
        let rconExecuted = false;

        if (ENV.rconHost && ENV.rconPort && ENV.rconPassword) {
          let rcon: Rcon | undefined;
          try {
            rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
            const res1 = await rcon.send(rankCmd);
            const res2 = await rcon.send(pointsCmd);
            rconExecuted = true;
            rconDetail = `${res1 || "มอบยศสำเร็จ"} | ${res2 || `เพิ่มเหรียญ ${coinAmount} แต้มสำเร็จ`}`;
          } catch (err: any) {
            console.error("[RCON] Purchase rank/points auto-fulfillment error:", err);
            rconDetail = `RCON ไม่สำเร็จ (${err?.message ?? String(err)}) หักเงินแล้วและสร้างออเดอร์เป็นรอตรวจสอบเพื่อให้แอดมินดำเนินการต่อ`;
          } finally {
            await rcon?.end().catch(() => undefined);
          }
        }

        const order = await createOrder({
          userId: ctx.user.id,
          minecraftIGN: input.minecraftIGN,
          rankId: rank.id,
          rankName: rank.displayName,
          amount: rank.price,
          paymentMethod: "กระเป๋าเงิน (Wallet)",
          slipUrl: "https://ritzsmp.me/wallet-paid",
          slipKey: "wallet-paid",
          status: rconExecuted ? "สำเร็จ" : "รอตรวจสอบ",
          adminNotes: `หักเงินจากกระเป๋าอัตโนมัติ [${rconDetail}]`,
        });

        await notifyOwner({
          title: `RitzSMP: ซื้อยศ${rconExecuted ? "สำเร็จ" : "รอตรวจสอบ"} #${order.id} (${rank.displayName})`,
          content: [
            `IGN: ${input.minecraftIGN}`,
            `ผู้ซื้อ: ${ctx.user.name ?? "ไม่ระบุชื่อ"}`,
            `ยศ: ${rank.displayName}`,
            `ราคา: ${rank.price} บาท`,
            `สถานะออเดอร์: ${order.status}`,
            `RCON: ${rconExecuted ? "สำเร็จ" : "รอตรวจสอบ/ต้องดำเนินการต่อ"}`,
          ].join("\n"),
        }).catch(() => {});
        const discordNotification = await notifyPurchaseCompleted({
          order,
          userName: ctx.user.name ?? ctx.user.email ?? "ไม่ระบุชื่อ",
          rconExecuted,
        }).catch(error => {
          console.error("[DiscordNotifications] Purchase notification failed:", error);
          return { sent: false, reason: error instanceof Error ? error.message : String(error) };
        });

        return { order, rconExecuted, rconDetail, discordNotification };
      }),
  }),
  admin: router({
    orders: adminProcedure.query(() => getAllOrders()),
    playerReportDashboard: adminProcedure.query(() => getPlayerReportDashboardStats()),
    users: ownerProcedure.query(async () => {
      const allUsers = await getAllUsers();
      return allUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
        isOwner: user.openId === ENV.ownerOpenId,
      }));
    }),
    grantAdminByEmail: ownerProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ input }) => {
        const target = await getUserByEmail(input.email);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบบัญชีนี้ กรุณาให้เจ้าของ Gmail เข้าสู่ระบบเว็บไซต์ก่อน" });
        }
        if (target.openId === ENV.ownerOpenId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "บัญชี Owner มีสิทธิ์สูงสุดอยู่แล้วค่ะ" });
        }
        const updated = await updateUserRole(target.id, "admin");
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่สามารถบันทึกสิทธิ์บัญชีได้" });
        return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, createdAt: updated.createdAt, lastSignedIn: updated.lastSignedIn, isOwner: updated.openId === ENV.ownerOpenId };
      }),
    setUserRole: ownerProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        const target = await getUserById(input.id);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบบัญชีผู้ใช้" });
        }
        if (target.openId === ENV.ownerOpenId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถลดสิทธิ์หรือแก้ไขบัญชี Owner ได้" });
        }
        const updated = await updateUserRole(input.id, input.role);
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่สามารถบันทึกสิทธิ์บัญชีได้" });
        }
        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          createdAt: updated.createdAt,
          lastSignedIn: updated.lastSignedIn,
          isOwner: updated.openId === ENV.ownerOpenId,
        };
      }),
    updateOrderStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: orderStatus,
          adminNotes: z.string().max(2000).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await getOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบออเดอร์" });
        }
        let updated = existing;

        // A successful approval is a side-effecting operation. Complete the side effect first,
        // then persist the final status so a failed RCON call cannot look like a fulfilled order.
        if (input.status === "สำเร็จ" && existing.status !== "สำเร็จ") {
          const rank = await getRankById(existing.rankId);
          let rconDetail = "ไม่ต้องใช้ RCON";
          let rconExecuted = false;

          if (existing.rankId === 0) {
            const walletResult = await adjustUserBalance(
              existing.userId,
              Number(existing.amount),
              "topup",
              `เติมเงินผ่าน ${existing.paymentMethod} (ออเดอร์ #${existing.id})`,
              `order:${existing.id}:topup`,
            );
            rconDetail = walletResult.alreadyApplied ? "ยอดเงินของออเดอร์นี้ถูกบันทึกแล้ว" : "เติมเงินเข้ากระเป๋าสำเร็จ";
          } else {
            if (!rank) {
              throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบยศของออเดอร์นี้" });
            }
            const cmd = `lp user ${existing.minecraftIGN} parent add ${rank.name.toLowerCase()}`;
            const coinAmount = getCoinRewardForRank(rank.id);
            const pointsCmd = `points give ${existing.minecraftIGN} ${coinAmount}`;
            if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: `ยังไม่ได้ตั้งค่า RCON สำหรับมอบยศอัตโนมัติ (คำสั่งที่ต้องรัน: ${cmd})`,
              });
            }
            let rcon: Rcon | undefined;
            try {
              rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
              const rankResult = await rcon.send(cmd);
              const pointsResult = await rcon.send(pointsCmd);
              rconExecuted = true;
              rconDetail = `${rankResult || "RCON มอบยศสำเร็จ"} | ${pointsResult || `เพิ่มเหรียญ ${coinAmount} แต้มสำเร็จ`}`;
            } catch (err: any) {
              throw new TRPCError({ code: "PRECONDITION_FAILED", message: `RCON มอบยศไม่สำเร็จ: ${err?.message ?? String(err)}` });
            } finally {
              await rcon?.end().catch(() => undefined);
            }
          }

          updated = await updateOrder(
            input.id,
            "สำเร็จ",
            `${input.adminNotes ?? existing.adminNotes ?? ""} [อัตโนมัติ: ${existing.rankId === 0 ? "เติมเงินสำเร็จ" : "มอบยศเรียบร้อย"} - ${rconDetail}]`.trim(),
          );
          if (!updated) {
            throw new TRPCError({ code: "NOT_FOUND", message: "ไม่สามารถบันทึกสถานะออเดอร์ได้" });
          }

          await notifyOwner({
            title: `RitzSMP: ออเดอร์ #${updated.id} สำเร็จอัตโนมัติ`,
            content: [
              `✅ ออเดอร์ #${updated.id} ของผู้เล่น ${updated.minecraftIGN} สำเร็จแล้ว`,
              `👑 ยศ: ${updated.rankName}`,
              `⚙️ RCON Status: ${rconExecuted ? "ส่งคำสั่งเข้าเซิร์ฟเวอร์สำเร็จ" : rconDetail}`,
            ].join("\n"),
          }).catch(() => {});
          if (updated.rankId !== 0) {
            const buyer = await getUserById(updated.userId);
            await notifyPurchaseCompleted({
              order: updated,
              userName: buyer?.name ?? buyer?.email ?? "ไม่ระบุชื่อ",
              rconExecuted,
            }).catch(error => console.error("[DiscordNotifications] Admin purchase notification failed:", error));
          }
        }

        return updated;
      }),
  }),
});

export type AppRouter = typeof appRouter;
