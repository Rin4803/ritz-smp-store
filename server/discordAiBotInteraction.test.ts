import { describe, expect, it, vi } from "vitest";
import { ensureDeferredReply, safeReply } from "./discordAiBot";

function repliableInteraction(overrides: Record<string, unknown> = {}) {
  return {
    deferred: false,
    replied: false,
    isRepliable: () => true,
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe("Discord interaction acknowledgement safety", () => {
  it("defers a fresh interaction exactly once", async () => {
    const interaction = repliableInteraction();

    await expect(ensureDeferredReply(interaction, { ephemeral: true })).resolves.toBe(true);
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it("continues when Discord reports that another handler acknowledged the interaction", async () => {
    const interaction = repliableInteraction({
      deferReply: vi.fn().mockRejectedValue(Object.assign(new Error("Interaction has already been acknowledged"), { code: 40060 })),
      deferred: false,
      replied: false,
    });

    await expect(ensureDeferredReply(interaction)).resolves.toBe(true);
  });

  it("edits the existing response when the initial reply races with another listener", async () => {
    const interaction = repliableInteraction({
      reply: vi.fn().mockRejectedValue(Object.assign(new Error("Interaction has already been acknowledged"), { code: 40060 })),
    });

    await expect(safeReply(interaction, { content: "พร้อมให้บริการค่ะ" })).resolves.toBe(true);
    expect(interaction.editReply).toHaveBeenCalledWith({ content: "พร้อมให้บริการค่ะ" });
  });

  it("uses editReply for an interaction that was already deferred", async () => {
    const interaction = repliableInteraction({ deferred: true });

    await expect(safeReply(interaction, { content: "ตอบกลับแล้วค่ะ" })).resolves.toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({ content: "ตอบกลับแล้วค่ะ" });
  });

  it("uses editReply when the onboarding handler marked the interaction as deferred", async () => {
    const interaction = repliableInteraction({ __ritzDeferred: true });

    await expect(safeReply(interaction, { content: "ระบบได้บันทึกคำขอแล้วค่ะ" })).resolves.toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({ content: "ระบบได้บันทึกคำขอแล้วค่ะ" });
  });
});
