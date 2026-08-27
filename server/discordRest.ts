export type DiscordRestGuildMember = {
  nick?: string | null;
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    bot?: boolean;
  };
};

export type DiscordGuildMembersResult =
  | { kind: "ok"; members: DiscordRestGuildMember[] }
  | { kind: "unavailable" };

type FetchLike = typeof fetch;

function isDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function escapeDiscordMarkdown(value: string): string {
  return value
    .replace(/[\\`*_~|>]/g, "\\$&")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 80);
}

function memberDisplayName(member: DiscordRestGuildMember, index: number): string {
  const candidate =
    member.nick ||
    member.user?.global_name ||
    member.user?.username ||
    `สมาชิก ${index + 1}`;
  return escapeDiscordMarkdown(candidate) || `สมาชิก ${index + 1}`;
}

function isVisibleMember(member: DiscordRestGuildMember): boolean {
  // `fetchDiscordGuildMembers` already verifies a string `user.id` from the
  // authenticated Discord response. Do not apply a narrower second ID format
  // rule here: the Gateway reference filters only bots, and this display path
  // never exposes the ID itself.
  return (
    typeof member.user?.id === "string" &&
    member.user.id.trim().length > 0 &&
    member.user.bot !== true
  );
}

export function buildDiscordMembersMessage(
  members: DiscordRestGuildMember[],
): string {
  const visibleMembers = members.filter(isVisibleMember).slice(0, 25);
  const list =
    visibleMembers.length > 0
      ? visibleMembers
          .map(
            (member, index) =>
              `**${index + 1}.** ${memberDisplayName(member, index)}`,
          )
          .join("\n")
      : "ยังไม่พบสมาชิกที่แสดงได้ในขณะนี้ค่ะ";

  return [
    "## 👥 สมาชิก Discord RitzSMP",
    list,
    "",
    "แสดงเฉพาะชื่อที่สมาชิกตั้งไว้ ไม่แสดง ID, อีเมล หรือข้อมูลส่วนตัว",
    visibleMembers.length >= 25
      ? "แสดง 25 คนแรก • ดูรายชื่อเต็มได้จากแถบสมาชิกของ Discord"
      : `สมาชิกที่แสดง ${visibleMembers.length} คน`,
  ].join("\n");
}

export async function editDiscordOriginalInteractionResponse(input: {
  applicationId: string;
  interactionToken: string;
  content: string;
  components?: unknown[];
  fetchImpl?: FetchLike;
}): Promise<boolean> {
  if (
    !isDiscordSnowflake(input.applicationId) ||
    !input.interactionToken.trim()
  ) {
    return false;
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(
      `https://discord.com/api/v10/webhooks/${input.applicationId}/${encodeURIComponent(input.interactionToken)}/messages/@original`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input.content,
          ...(input.components ? { components: input.components } : {}),
        }),
        signal: AbortSignal.timeout(4_000),
      },
    );
    return response.ok;
  } catch {
    // Never log the interaction token or response body: either may be private.
    return false;
  }
}

export async function fetchDiscordGuildMembers(input: {
  guildId: string;
  botToken: string;
  fetchImpl?: FetchLike;
}): Promise<DiscordGuildMembersResult> {
  if (!isDiscordSnowflake(input.guildId) || !input.botToken.trim()) {
    return { kind: "unavailable" };
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(
      `https://discord.com/api/v10/guilds/${input.guildId}/members?limit=25`,
      {
        headers: {
          Authorization: `Bot ${input.botToken}`,
        },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!response.ok) return { kind: "unavailable" };

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { kind: "unavailable" };

    const members = payload.filter(
      (member): member is DiscordRestGuildMember =>
        typeof member === "object" &&
        member !== null &&
        typeof (member as { user?: { id?: unknown } }).user?.id === "string",
    );
    return { kind: "ok", members };
  } catch {
    // Do not log request headers or response content: both can contain data
    // that should remain private to Discord and the current interaction.
    return { kind: "unavailable" };
  }
}

export type DiscordCaseChannelResult =
  | { kind: "ok"; channelId: string }
  | { kind: "unavailable"; reason: string };

type DiscordChannelLookup = { id?: string; parent_id?: string | null };

const DISCORD_API_BASE = "https://discord.com/api/v10";
const VIEW_CHANNEL = "1024";
const SEND_MESSAGES = "2048";
const READ_MESSAGE_HISTORY = "65536";
const ATTACH_FILES = "32768";
const EMBED_LINKS = "16384";
const CASE_ALLOW = "117760";

export async function createDiscordPlayerReportCaseChannel(input: {
  guildId: string;
  reportChannelId: string;
  reportId: number;
  reporterDiscordId: string;
  adminRoleId?: string;
  botToken: string;
  targetDiscordId?: string | null;
  fetchImpl?: FetchLike;
}): Promise<DiscordCaseChannelResult> {
  const fetcher = input.fetchImpl ?? fetch;
  if (
    !isDiscordSnowflake(input.guildId) ||
    !isDiscordSnowflake(input.reportChannelId) ||
    !isDiscordSnowflake(input.reporterDiscordId) ||
    !input.botToken.trim() ||
    !Number.isInteger(input.reportId) ||
    input.reportId <= 0
  ) {
    return { kind: "unavailable", reason: "invalid case channel configuration" };
  }

  try {
    const parentResponse = await fetcher(
      `${DISCORD_API_BASE}/channels/${input.reportChannelId}`,
      {
        headers: { Authorization: `Bot ${input.botToken}` },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!parentResponse.ok) {
      return { kind: "unavailable", reason: `report channel lookup failed (${parentResponse.status})` };
    }
    const parent = (await parentResponse.json().catch(() => ({}))) as DiscordChannelLookup;
    // A report room is a durable, per-case discussion record. It is public to
    // members of this guild so anyone can correct or add information. Claim and
    // close buttons remain staff-only in the signed interaction handler.
    const permissionOverwrites = [
      { id: input.guildId, type: 0, allow: CASE_ALLOW, deny: "0" },
      ...(isDiscordSnowflake(input.adminRoleId ?? "")
        ? [{ id: input.adminRoleId!, type: 0, allow: CASE_ALLOW, deny: "0" }]
        : []),
    ];
    const response = await fetcher(`${DISCORD_API_BASE}/guilds/${input.guildId}/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${input.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `report-${input.reportId}`,
        type: 0,
        ...(parent.parent_id ? { parent_id: parent.parent_id } : {}),
        permission_overwrites: permissionOverwrites,
        topic: `RitzSMP Player Report #${input.reportId} • ห้องบันทึกและพูดคุยของสมาชิกทุกคน`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return { kind: "unavailable", reason: `case channel creation failed (${response.status})` };
    }
    const channel = (await response.json().catch(() => ({}))) as { id?: string };
    return channel.id && isDiscordSnowflake(channel.id)
      ? { kind: "ok", channelId: channel.id }
      : { kind: "unavailable", reason: "Discord returned no channel ID" };
  } catch {
    return { kind: "unavailable", reason: "case channel request failed" };
  }
}

export async function postDiscordChannelPayload(input: {
  channelId: string;
  botToken: string;
  payload: Record<string, unknown>;
  fetchImpl?: FetchLike;
}): Promise<boolean> {
  if (!isDiscordSnowflake(input.channelId) || !input.botToken.trim()) return false;
  try {
    const response = await (input.fetchImpl ?? fetch)(
      `${DISCORD_API_BASE}/channels/${input.channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${input.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.payload),
        signal: AbortSignal.timeout(8_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
