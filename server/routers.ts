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
  getUserById,
  updateOrder,
  getUserWallet,
  getUserWalletTransactions,
  adjustUserBalance,
} from "./db";
import { ENV } from "./_core/env";
import { Rcon } from "rcon-client";
import { storagePut } from "./storage";
import type { Order } from "../drizzle/schema";
import { getRitzSmpAiBotStatus } from "./discordAiBot";
import { notifyPurchaseCompleted, notifyTopupSubmitted } from "./discordNotifications";

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
    botStatus: adminProcedure.query(() => {
      try {
        return getRitzSmpAiBotStatus();
      } catch (e) {
        return {
          status: "offline" as const,
          username: null,
          totalInteractions: 0,
          logs: [{ timestamp: new Date().toISOString(), level: "ERROR" as const, message: String(e) }],
        };
      }
    }),
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
        const refKey = `purchase-rank-${ctx.user.id}-${rank.id}-${Date.now()}`;
        await adjustUserBalance(
          ctx.user.id,
          -priceNum,
          "purchase",
          `ซื้อยศ ${rank.displayName} สำหรับ IGN: ${input.minecraftIGN}`,
          refKey,
        );

        // Execute RCON immediately or create an auto-approved order
        const cmd = `lp user ${input.minecraftIGN} parent add ${rank.name.toLowerCase()}`;
        let rconDetail = "ไม่ต้องใช้ RCON";
        let rconExecuted = false;

        if (ENV.rconHost && ENV.rconPort && ENV.rconPassword) {
          let rcon: Rcon | undefined;
          try {
            rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
            const res = await rcon.send(cmd);
            rconExecuted = true;
            rconDetail = res || "RCON มอบยศสำเร็จ";
          } catch (err: any) {
            console.error("[RCON] Purchase rank auto-fulfillment error:", err);
            rconDetail = `RCON ไม่สำเร็จ (${err?.message ?? String(err)} แต่หักเงินและบันทึกออเดอร์แล้ว)`;
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
          status: "สำเร็จ",
          adminNotes: `หักเงินจากกระเป๋าอัตโนมัติ [${rconDetail}]`,
        });

        await notifyOwner({
          title: `RitzSMP: ซื้อยศสำเร็จ #${order.id} (${rank.displayName})`,
          content: [
            `IGN: ${input.minecraftIGN}`,
            `ผู้ซื้อ: ${ctx.user.name ?? "ไม่ระบุชื่อ"}`,
            `ยศ: ${rank.displayName}`,
            `ราคา: ${rank.price} บาท`,
            `RCON: ${rconExecuted ? "สำเร็จ" : "รอดำเนินการ"}`,
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
            if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: `ยังไม่ได้ตั้งค่า RCON สำหรับมอบยศอัตโนมัติ (คำสั่งที่ต้องรัน: ${cmd})`,
              });
            }
            let rcon: Rcon | undefined;
            try {
              rcon = await Rcon.connect({ host: ENV.rconHost, port: ENV.rconPort, password: ENV.rconPassword });
              const res = await rcon.send(cmd);
              rconExecuted = true;
              rconDetail = res || "RCON มอบยศสำเร็จ";
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
