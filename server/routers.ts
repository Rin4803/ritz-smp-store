import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import {
  createOrder,
  getAllOrders,
  getOrdersByUser,
  getOrderById,
  getRankById,
  getRanks,
  updateOrder,
  getUserWallet,
  getUserWalletTransactions,
  adjustUserBalance,
} from "./db";
import { ENV } from "./_core/env";
import { Rcon } from "rcon-client";
import { storagePut } from "./storage";
import type { Order } from "../drizzle/schema";

const allowedSlipTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const orderStatus = z.enum(["รอตรวจสอบ", "สำเร็จ", "ยกเลิก"]);

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
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
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
    createOrder: protectedProcedure
      .input(
        z.object({
          rankId: z.number().int().positive(),
          minecraftIGN: z.string().trim().min(3, "กรุณาระบุชื่อในเกม").max(64),
          paymentMethod: z.enum(["ธนาคารออมสิน", "PromptPay", "TrueMoney Wallet"]),
          slipData: z.string().min(100).max(8_500_000),
          slipName: z.string().max(160).default("payment-slip"),
          slipType: z.enum(allowedSlipTypes),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const rank = await getRankById(input.rankId);
        if (!rank) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบยศที่เลือก" });
        }
        const amount = Number(rank.price);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ยศนี้ยังไม่ได้กำหนดราคาจริง กรุณาติดต่อเจ้าของเซิร์ฟเวอร์",
          });
        }

        const { buffer, slipType } = decodeSlip(input.slipData, input.slipType);
        const fileName = `${Date.now()}-${sanitizeFileName(input.slipName)}`;
        const stored = await storagePut(`orders/${ctx.user.id}/${fileName}`, buffer, slipType);
        const order = await createOrder({
          userId: ctx.user.id,
          minecraftIGN: input.minecraftIGN,
          rankId: rank.id,
          rankName: rank.displayName,
          amount: rank.price,
          paymentMethod: input.paymentMethod,
          slipUrl: stored.url,
          slipKey: stored.key,
          status: "รอตรวจสอบ",
        });

        const notificationSent = await notifyOwner({
          title: `RitzSMP: มีออเดอร์ใหม่ #${order.id}`,
          content: [
            `IGN: ${order.minecraftIGN}`,
            `ยศ: ${order.rankName}`,
            `ยอดชำระ: ${order.amount} บาท`,
            `ช่องทาง: ${order.paymentMethod}`,
            `ผู้สั่งซื้อ: ${ctx.user.name ?? "ไม่ระบุชื่อ"} (${ctx.user.email ?? "ไม่มีอีเมล"})`,
            `สถานะ: ${order.status}`,
          ].join("\n"),
        });

        return { order, notificationSent };
      }),
  }),
  admin: router({
    orders: adminProcedure.query(() => getAllOrders()),
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
        const updated = await updateOrder(input.id, input.status, input.adminNotes);
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบออเดอร์" });
        }

        // If status is updated to 'สำเร็จ', execute Rcon rank assignment automatically and record ledger
        if (input.status === "สำเร็จ" && existing.status !== "สำเร็จ") {
          const rank = await getRankById(existing.rankId);
          let rconDetail = "รอดำเนินการอัตโนมัติ";
          let rconExecuted = false;
          if (rank) {
            const cmd = `lp user ${existing.minecraftIGN} parent add ${rank.name.toLowerCase()}`;
            if (ENV.rconHost && ENV.rconPort && ENV.rconPassword) {
              try {
                const rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
                const res = await rcon.send(cmd);
                await rcon.end();
                rconExecuted = true;
                rconDetail = res || "RCON มอบยศสำเร็จ";
              } catch (err: any) {
                rconDetail = `RCON Error: ${err?.message ?? String(err)}`;
              }
            } else {
              rconDetail = `ยังไม่ได้ตั้งค่า RCON (รันคำสั่งในคอนโซล: ${cmd})`;
            }
          }

          // Adjust user balance if order was topup, or deduct if purchase
          if (existing.rankId === 0) {
            await adjustUserBalance(existing.userId, Number(existing.amount), "topup", `เติมเงินผ่าน ${existing.paymentMethod} (ออเดอร์ #${existing.id})`);
          }

          await updateOrder(input.id, "สำเร็จ", `${existing.adminNotes || ""} [อัตโนมัติ: มอบยศเรียบร้อย - ${rconDetail}]`.trim());

          await notifyOwner({
            title: `RitzSMP: ออเดอร์ #${updated.id} สำเร็จอัตโนมัติ`,
            content: [
              `✅ ออเดอร์ #${updated.id} ของผู้เล่น ${updated.minecraftIGN} สำเร็จแล้ว`,
              `👑 ยศ: ${updated.rankName}`,
              `⚙️ RCON Status: ${rconExecuted ? "ส่งคำสั่งเข้าเซิร์ฟเวอร์สำเร็จ" : rconDetail}`,
            ].join("\n"),
          }).catch(() => {});
        }

        return updated;
      }),
  }),
});

export type AppRouter = typeof appRouter;
