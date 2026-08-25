// server/discordAiBot.ts
import {
  Client as Client2,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField as PermissionsBitField2,
  ChannelType as ChannelType2,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  discordAiBotToken: process.env.DISCORD_AI_BOT_TOKEN ?? "",
  discordAiPublicKey: process.env.DISCORD_AI_PUBLIC_KEY ?? "",
  discordGuildId: process.env.DISCORD_GUILD_ID ?? "",
  discordStoreChannelId: process.env.DISCORD_STORE_CHANNEL_ID ?? "",
  discordSupportChannelId: process.env.DISCORD_SUPPORT_CHANNEL_ID ?? "",
  discordDonateChannelId: process.env.DISCORD_DONATE_CHANNEL_ID ?? "",
  discordDonateLogChannelId: process.env.DISCORD_DONATE_LOG_CHANNEL_ID ?? "",
  discordOrdersChannelId: process.env.DISCORD_ORDERS_CHANNEL_ID ?? "",
  discordAdminRoleId: process.env.DISCORD_ADMIN_ROLE_ID ?? "",
  discordWelcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID ?? "",
  discordVerificationChannelId: process.env.DISCORD_VERIFICATION_CHANNEL_ID ?? "",
  discordOnlineChannelId: process.env.DISCORD_ONLINE_CHANNEL_ID ?? "",
  discordVerifiedRoleId: process.env.DISCORD_VERIFIED_ROLE_ID ?? "",
  discordMemberRoleId: process.env.DISCORD_MEMBER_ROLE_ID ?? "",
  discordClaimRankGroup: process.env.DISCORD_CLAIM_RANK_GROUP ?? "member",
  publicStoreUrl: process.env.PUBLIC_STORE_URL ?? "",
  rconHost: process.env.RCON_HOST ?? "",
  rconPort: Number(process.env.RCON_PORT ?? 0),
  rconPassword: process.env.RCON_PASSWORD ?? ""
};

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/db.ts
import { and, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var ranks = mysqlTable("ranks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: varchar("duration", { length: 64 }).default("\u0E16\u0E32\u0E27\u0E23").notNull(),
  color: varchar("color", { length: 32 }).default("gold").notNull(),
  badge: varchar("badge", { length: 64 }).default("POPULAR").notNull(),
  description: text("description").notNull(),
  features: text("features").notNull(),
  // JSON string array of perks
  roleId: varchar("roleId", { length: 64 }),
  // Discord role ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  minecraftIGN: varchar("minecraftIGN", { length: 64 }).notNull(),
  rankId: int("rankId").notNull(),
  rankName: varchar("rankName", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }).default("PromptPay / \u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19").notNull(),
  slipUrl: text("slipUrl").notNull(),
  slipKey: varchar("slipKey", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A", "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"]).default("\u0E23\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["topup", "purchase", "refund", "admin_adjust"]).notNull(),
  description: text("description").notNull(),
  referenceKey: varchar("referenceKey", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var discordVerifications = mysqlTable("discord_verifications", {
  id: int("id").autoincrement().primaryKey(),
  discordUserId: varchar("discordUserId", { length: 64 }).notNull().unique(),
  minecraftIGN: varchar("minecraftIGN", { length: 16 }).notNull(),
  minecraftUuid: varchar("minecraftUuid", { length: 64 }).notNull().unique(),
  bio: text("bio"),
  playStyle: varchar("playStyle", { length: 128 }),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var discordVerificationCodes = mysqlTable("discord_verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  discordUserId: varchar("discordUserId", { length: 64 }).notNull().unique(),
  code: varchar("code", { length: 4 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var minecraftPresenceState = mysqlTable("minecraft_presence_state", {
  id: int("id").primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastOnline: int("lastOnline").notNull(),
  playerListKnown: int("playerListKnown").notNull(),
  lastPlayerNames: text("lastPlayerNames").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var managedServers = mysqlTable("managed_servers", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  minecraftHost: varchar("minecraftHost", { length: 255 }).notNull(),
  minecraftPort: int("minecraftPort").default(25565).notNull(),
  discordGuildId: varchar("discordGuildId", { length: 64 }),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var managedServerConfigs = mysqlTable("managed_server_configs", {
  id: int("id").autoincrement().primaryKey(),
  managedServerId: int("managedServerId").notNull().unique(),
  discordTokenEnv: varchar("discordTokenEnv", { length: 128 }),
  rconHost: varchar("rconHost", { length: 255 }),
  rconPort: int("rconPort").default(25575),
  rconPasswordEnv: varchar("rconPasswordEnv", { length: 128 }),
  channelConfig: text("channelConfig").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var discordEmbedTemplates = mysqlTable("discord_embed_templates", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guildId", { length: 64 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  color: varchar("color", { length: 16 }).default("EC4899").notNull(),
  imageUrl: varchar("imageUrl", { length: 1024 }),
  footer: varchar("footer", { length: 2048 }),
  defaultChannelId: varchar("defaultChannelId", { length: 64 }),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var healthEvents = mysqlTable("health_events", {
  id: int("id").autoincrement().primaryKey(),
  service: varchar("service", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["ok", "degraded", "down", "error"]).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata").notNull(),
  guildId: varchar("guildId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var playerReports = mysqlTable("player_reports", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guildId", { length: 64 }).notNull(),
  reporterDiscordId: varchar("reporterDiscordId", { length: 64 }).notNull(),
  reporterDisplayName: varchar("reporterDisplayName", { length: 128 }).notNull(),
  targetDiscordId: varchar("targetDiscordId", { length: 64 }),
  targetDiscordName: varchar("targetDiscordName", { length: 128 }).notNull(),
  targetMinecraftIGN: varchar("targetMinecraftIGN", { length: 16 }),
  category: varchar("category", { length: 64 }).notNull(),
  details: text("details").notNull(),
  status: mysqlEnum("status", ["\u0E43\u0E2B\u0E21\u0E48", "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A", "\u0E1B\u0E34\u0E14\u0E41\u0E25\u0E49\u0E27"]).default("\u0E43\u0E2B\u0E21\u0E48").notNull(),
  editCount: int("editCount").default(0).notNull(),
  discordMessageId: varchar("discordMessageId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/db.ts
var _db = null;
var rank = (id, name, price, color, badge, description, features) => ({
  id,
  name,
  displayName: name,
  price,
  duration: "\u0E16\u0E32\u0E27\u0E23",
  color,
  badge,
  description,
  features: JSON.stringify(features),
  roleId: null,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
});
var DEFAULT_RANKS = [
  rank(1, "VIP", "39.00", "silver", "ENTRY", "\u0E22\u0E28\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19 RitzSMP", ["/hat", "/craft", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 3 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 10,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 100 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(2, "VIP+", "79.00", "gold", "POPULAR", "\u0E2D\u0E31\u0E1B\u0E40\u0E01\u0E23\u0E14\u0E08\u0E32\u0E01 VIP \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/enderchest", "/feed", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 5 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 25,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 250 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(3, "Knight", "149.00", "ruby", "ADVENTURE", "\u0E22\u0E28\u0E19\u0E31\u0E01\u0E23\u0E1A\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E04\u0E25\u0E48\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C VIP+ \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/ptime", "/pweather", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 8 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 50,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 450 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(4, "Elite", "249.00", "gold", "ADVANCED", "\u0E22\u0E28\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E44\u0E2D\u0E40\u0E17\u0E21", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Knight \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/repair", "/anvil", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 10 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 80,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 700 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(5, "Noble", "399.00", "silver", "UTILITY", "\u0E22\u0E28\u0E1C\u0E39\u0E49\u0E14\u0E35\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E30\u0E14\u0E27\u0E01\u0E43\u0E19\u0E01\u0E32\u0E23\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Elite \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "/back", "Backpack Lv.1", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 15 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 120,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,000 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(6, "Lord", "599.00", "ruby", "PRESTIGE", "\u0E22\u0E28\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E28\u0E23\u0E35\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E35\u0E41\u0E0A\u0E17\u0E41\u0E25\u0E30 Fly \u0E17\u0E35\u0E48 Spawn", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Noble \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Chat Color", "Fly \u0E17\u0E35\u0E48 Spawn", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 20 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 200,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,200 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(7, "Overlord", "899.00", "gold", "ELITE", "\u0E22\u0E28\u0E0A\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07\u0E1E\u0E23\u0E49\u0E2D\u0E21 Backpack \u0E41\u0E25\u0E30 Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Lord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Backpack Lv.2", "Prefix \u0E44\u0E25\u0E48\u0E2A\u0E35", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 30 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 350,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,350 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(8, "Mythic", "1299.00", "ruby", "MYTHIC", "\u0E22\u0E28 Mythic \u0E1E\u0E23\u0E49\u0E2D\u0E21 Aura \u0E41\u0E25\u0E30 Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Overlord \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Aura \u0E1E\u0E34\u0E40\u0E28\u0E29", "Cosmetic \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 40 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 500,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,420 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(9, "Celestial", "1799.00", "gold", "CELESTIAL", "\u0E22\u0E28 Celestial \u0E1E\u0E23\u0E49\u0E2D\u0E21 Join Message \u0E41\u0E25\u0E30 Chat Tag", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Mythic \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Join Message", "Chat Tag", "\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19 50 \u0E2B\u0E25\u0E31\u0E07", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 800,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,470 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"]),
  rank(10, "Emperor", "2499.00", "ruby", "ULTIMATE", "\u0E22\u0E28\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E02\u0E2D\u0E07 RitzSMP", ["\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "Homes \u0E44\u0E21\u0E48\u0E08\u0E33\u0E01\u0E31\u0E14", "Cosmetic \u0E17\u0E38\u0E01\u0E0A\u0E19\u0E34\u0E14", "Join Message \u0E1E\u0E34\u0E40\u0E28\u0E29", "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E40\u0E01\u0E21 1,500,000", "\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D 1,500 \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D"])
];
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function getDiscordVerification(discordUserId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, discordUserId)).limit(1);
  return result[0];
}
async function getDiscordVerificationByMinecraftUuid(minecraftUuid) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(discordVerifications).where(eq(discordVerifications.minecraftUuid, minecraftUuid)).limit(1);
  return result[0];
}
async function createDiscordVerification(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(discordVerifications).values(input);
  const created = await db.select().from(discordVerifications).where(eq(discordVerifications.discordUserId, input.discordUserId)).limit(1);
  if (!created[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E44\u0E14\u0E49");
  return created[0];
}
var DISCORD_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1e3;
function generateDiscordVerificationCode() {
  return randomInt(0, 1e4).toString().padStart(4, "0");
}
async function createDiscordVerificationCode(discordUserId, forceNew = false) {
  if (!discordUserId) throw new Error("Discord user ID is required");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!forceNew) {
    const existingRows = await db.select().from(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
    const existing = existingRows[0];
    const now = Date.now();
    if (existing && !existing.usedAt && existing.expiresAt.getTime() > now) {
      return existing;
    }
  }
  const code = generateDiscordVerificationCode();
  const expiresAt = new Date(Date.now() + DISCORD_VERIFICATION_CODE_TTL_MS);
  await db.insert(discordVerificationCodes).values({
    discordUserId,
    code,
    expiresAt,
    usedAt: null
  }).onDuplicateKeyUpdate({
    set: { code, expiresAt, usedAt: null }
  });
  const created = await db.select().from(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId)).limit(1);
  if (!created[0]) throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E44\u0E14\u0E49");
  return created[0];
}
async function cancelDiscordVerificationCode(discordUserId) {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}
async function unlinkDiscordVerification(discordUserId) {
  if (!discordUserId) return false;
  const db = await getDb();
  if (!db) return false;
  await db.delete(discordVerifications).where(eq(discordVerifications.discordUserId, discordUserId));
  await db.delete(discordVerificationCodes).where(eq(discordVerificationCodes.discordUserId, discordUserId));
  return true;
}
async function updateDiscordProfile(discordUserId, input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updates = {};
  if (input.bio !== void 0) updates.bio = input.bio;
  if (input.playStyle !== void 0) updates.playStyle = input.playStyle;
  if (Object.keys(updates).length > 0) {
    await db.update(discordVerifications).set(updates).where(eq(discordVerifications.discordUserId, discordUserId));
  }
  return getDiscordVerification(discordUserId);
}
async function getManagedServerById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(managedServers).where(eq(managedServers.id, id)).limit(1);
  return result[0];
}
async function getManagedServerConfig(serverId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(managedServerConfigs).where(eq(managedServerConfigs.managedServerId, serverId)).limit(1);
  return result[0];
}

// server/minecraftIntegration.ts
import { Rcon } from "rcon-client";
function isValidMinecraftIgn(value) {
  return /^[A-Za-z0-9_]{3,16}$/.test(value);
}
function isValidLuckPermsGroup(value) {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value);
}
function getMotd(data) {
  const clean = data?.motd?.clean;
  if (Array.isArray(clean)) return clean.join(" ").trim() || "RitzSMP Minecraft Server";
  if (typeof clean === "string") return clean;
  return "RitzSMP Minecraft Server";
}
async function fetchMinecraftServerStatus(options = {}) {
  const startedAt = Date.now();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.min(4e3, Math.max(500, Math.floor(options.timeoutMs))) : 4e3;
  try {
    const response = await fetch("https://api.mcsrvstat.us/2/ritz.mcsv.me", {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`Minecraft status API returned ${response.status}`);
    const data = await response.json();
    const online = data?.online === true;
    const playerListKnown = online && Array.isArray(data?.players?.list);
    const playerNames = playerListKnown ? data.players.list.filter((name) => typeof name === "string").slice(0, 100) : [];
    return {
      online,
      players: online ? Number(data?.players?.online ?? playerNames.length) : 0,
      maxPlayers: online ? Number(data?.players?.max ?? 0) : 0,
      playerNames,
      playerListKnown,
      version: online ? String(data?.version ?? "\u0E44\u0E21\u0E48\u0E17\u0E23\u0E32\u0E1A\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19") : "\u0E44\u0E21\u0E48\u0E17\u0E23\u0E32\u0E1A\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19",
      latency: Date.now() - startedAt,
      motd: getMotd(data)
    };
  } catch {
    return {
      online: false,
      players: 0,
      maxPlayers: 0,
      playerNames: [],
      playerListKnown: false,
      version: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E14\u0E49",
      latency: null,
      motd: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D API \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E14\u0E49"
    };
  }
}
async function fetchMinecraftProfile(minecraftIGN) {
  if (!isValidMinecraftIgn(minecraftIGN)) return null;
  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftIGN)}`, {
      signal: AbortSignal.timeout(4e3)
    });
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error(`Mojang profile API returned ${response.status}`);
    const data = await response.json();
    if (typeof data.id !== "string" || typeof data.name !== "string") return null;
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}
async function grantMinecraftRank(minecraftIGN, groupName) {
  if (!isValidMinecraftIgn(minecraftIGN)) throw new Error("\u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  if (!isValidLuckPermsGroup(groupName)) throw new Error("\u0E0A\u0E37\u0E48\u0E2D\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07");
  const command = `lp user ${minecraftIGN} parent add ${groupName}`;
  if (!ENV.rconHost || !ENV.rconPort || !ENV.rconPassword) {
    return {
      executed: false,
      command,
      detail: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E43\u0E19\u0E40\u0E01\u0E21 \u0E08\u0E36\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
    };
  }
  const rcon = await Rcon.connect({
    host: ENV.rconHost,
    port: ENV.rconPort,
    password: ENV.rconPassword
  });
  try {
    const response = await rcon.send(command);
    return { executed: true, command, detail: response || "LuckPerms \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27" };
  } finally {
    await rcon.end();
  }
}

// server/discordMinecraftStatusChannel.ts
import { ChannelType, PermissionFlagsBits } from "discord.js";
var MINECRAFT_STATUS_CHANNEL_NAME = "\u{1F4E1}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C";
var LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES = ["\u{1F4E1}\u2502\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"];
var configuredMinecraftStatusChannelId = process.env.DISCORD_ONLINE_CHANNEL_ID?.trim() || "";
async function ensureMinecraftStatusTextChannel(client, guildId) {
  if (configuredMinecraftStatusChannelId) return configuredMinecraftStatusChannelId;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch().catch(() => null);
  const existing = channels?.find(
    (channel) => channel?.type === ChannelType.GuildText && (channel.name === MINECRAFT_STATUS_CHANNEL_NAME || LEGACY_MINECRAFT_STATUS_CHANNEL_NAMES.includes(channel.name))
  );
  if (existing) {
    if (existing.name !== MINECRAFT_STATUS_CHANNEL_NAME && "setName" in existing) {
      await existing.setName(MINECRAFT_STATUS_CHANNEL_NAME, "Standardize RitzSMP Minecraft status channel name").catch(() => void 0);
    }
    if ("setTopic" in existing) {
      await existing.setTopic("\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01").catch(() => void 0);
    }
    configuredMinecraftStatusChannelId = existing.id;
    return existing.id;
  }
  const botMember = await guild.members.fetch(client.user?.id ?? "").catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) return null;
  const created = await guild.channels.create({
    name: MINECRAFT_STATUS_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01",
    reason: "\u0E41\u0E22\u0E01\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E2A\u0E16\u0E32\u0E19\u0E30 Minecraft \u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E41\u0E25\u0E30\u0E0A\u0E48\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07"
  }).catch(() => null);
  if (!created) return null;
  configuredMinecraftStatusChannelId = created.id;
  return created.id;
}

// server/multiserverRuntime.ts
var ENV_KEY = /^[A-Z][A-Z0-9_]*$/;
function readReferencedEnv(name) {
  if (!name || !ENV_KEY.test(name)) return "";
  return process.env[name] ?? "";
}
function parseChannelConfig(raw) {
  try {
    const parsed = JSON.parse(raw);
    const allowedKeys = [
      "welcomeChannelId",
      "leaveChannelId",
      "statusChannelId",
      "musicChannelId",
      "verificationChannelId",
      "memberListChannelId",
      "rankClaimChannelId",
      "verifiedRoleId",
      "memberRoleId",
      "claimRankGroup"
    ];
    return allowedKeys.reduce((result, key) => {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
      return result;
    }, {});
  } catch {
    return {};
  }
}
function buildManagedServerRuntimeConfig(server, config) {
  return {
    serverId: server.id,
    slug: server.slug,
    displayName: server.displayName,
    enabled: server.enabled === 1,
    minecraftHost: server.minecraftHost,
    minecraftPort: server.minecraftPort,
    discordGuildId: server.discordGuildId ?? "",
    discordBotToken: readReferencedEnv(config.discordTokenEnv),
    rconHost: config.rconHost ?? server.minecraftHost,
    rconPort: config.rconPort ?? 25575,
    rconPassword: readReferencedEnv(config.rconPasswordEnv),
    channels: parseChannelConfig(config.channelConfig)
  };
}
async function getManagedServerRuntimeConfig(serverId) {
  const [server, config] = await Promise.all([getManagedServerById(serverId), getManagedServerConfig(serverId)]);
  if (!server || !config || server.enabled !== 1) return void 0;
  return buildManagedServerRuntimeConfig(server, config);
}
async function getActiveManagedServerRuntimeConfig() {
  const rawId = process.env.RITZ_ACTIVE_SERVER_ID?.trim();
  if (!rawId) return void 0;
  const serverId = Number(rawId);
  if (!Number.isInteger(serverId) || serverId <= 0) return void 0;
  return getManagedServerRuntimeConfig(serverId);
}

// server/discordAiCommandRegistry.ts
import {
  PermissionsBitField,
  SlashCommandBuilder
} from "discord.js";
function buildRitzSmpAiCommands() {
  return [
    new SlashCommandBuilder().setName("ask").setDescription("\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E31\u0E1A RitzSMP AI").addStringOption(
      (option) => option.setName("question").setDescription("\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E16\u0E32\u0E21 AI").setRequired(true)
    ),
    new SlashCommandBuilder().setName("status").setDescription("\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft"),
    new SlashCommandBuilder().setName("store").setDescription("\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP"),
    new SlashCommandBuilder().setName("ranks").setDescription("\u0E14\u0E39\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E28\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C"),
    new SlashCommandBuilder().setName("topup").setDescription("\u0E14\u0E39\u0E27\u0E34\u0E18\u0E35\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28"),
    new SlashCommandBuilder().setName("verify").setDescription("\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E01\u0E31\u0E1A Minecraft"),
    new SlashCommandBuilder().setName("players").setDescription("\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C"),
    new SlashCommandBuilder().setName("members").setDescription("\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord"),
    new SlashCommandBuilder().setName("profile").setDescription("\u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C RitzSMP \u0E17\u0E35\u0E48\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E44\u0E27\u0E49"),
    new SlashCommandBuilder().setName("help").setDescription("\u0E14\u0E39\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 RitzSMP AI"),
    new SlashCommandBuilder().setName("setup").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1C\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).addSubcommand(
      (sub) => sub.setName("panel").setDescription("\u0E2A\u0E48\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49")
    ).addSubcommand(
      (sub) => sub.setName("welcome").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed \u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49")
    ).addSubcommand(
      (sub) => sub.setName("leave").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed \u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49")
    ),
    new SlashCommandBuilder().setName("embed").setDescription("\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).addSubcommand(
      (sub) => sub.setName("default").setDescription("\u0E2A\u0E48\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B")
    ).addSubcommand(
      (sub) => sub.setName("create").setDescription("\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed \u0E41\u0E1A\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07").addStringOption(
        (o) => o.setName("title").setDescription("\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28").setRequired(true)
      ).addStringOption(
        (o) => o.setName("description").setDescription("\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28").setRequired(true)
      ).addStringOption(
        (o) => o.setName("color").setDescription("\u0E2A\u0E35 \u0E40\u0E0A\u0E48\u0E19 #ff69b4").setRequired(false)
      ).addStringOption(
        (o) => o.setName("image_url").setDescription("\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A").setRequired(false)
      ).addStringOption(
        (o) => o.setName("button_label").setDescription("\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E19\u0E1B\u0E38\u0E48\u0E21\u0E25\u0E34\u0E07\u0E01\u0E4C").setRequired(false)
      ).addStringOption(
        (o) => o.setName("button_url").setDescription("\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E1B\u0E38\u0E48\u0E21").setRequired(false)
      )
    ).addSubcommand(
      (sub) => sub.setName("edit").setDescription("\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E15\u0E32\u0E21 Message ID").addStringOption(
        (o) => o.setName("message_id").setDescription("Message ID \u0E02\u0E2D\u0E07 Embed").setRequired(true)
      ).addStringOption(
        (o) => o.setName("title").setDescription("\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      ).addStringOption(
        (o) => o.setName("description").setDescription("\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      ).addStringOption(
        (o) => o.setName("color").setDescription("\u0E2A\u0E35\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      ).addStringOption(
        (o) => o.setName("image_url").setDescription("URL \u0E23\u0E39\u0E1B\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      ).addStringOption(
        (o) => o.setName("button_label").setDescription("\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E38\u0E48\u0E21\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      ).addStringOption(
        (o) => o.setName("button_url").setDescription("URL \u0E1B\u0E38\u0E48\u0E21\u0E43\u0E2B\u0E21\u0E48").setRequired(false)
      )
    ).addSubcommand(
      (sub) => sub.setName("delete").setDescription("\u0E25\u0E1A Embed \u0E15\u0E32\u0E21 Message ID").addStringOption(
        (o) => o.setName("message_id").setDescription("Message ID \u0E02\u0E2D\u0E07 Embed").setRequired(true)
      )
    )
  ].map((command) => command.toJSON());
}

// server/discordAiBot.ts
var MAX_LOGS = 100;
var logsBuffer = [];
var botClient = null;
var activeManagedServerRuntime = null;
var totalInteractionsCount = 0;
var botStartTime = null;
function createSingleFlight() {
  let inFlight = null;
  return {
    run(factory) {
      if (inFlight) return inFlight;
      inFlight = factory().catch((error) => {
        inFlight = null;
        throw error;
      });
      return inFlight;
    },
    get promise() {
      return inFlight;
    }
  };
}
var botStartup = createSingleFlight();
function pushLog(level, message) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  logsBuffer.push({ timestamp: timestamp2, level, message });
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
  console.log(`[RitzSmpAI] [${level}] ${message}`);
}
var checkMinecraftServerStatus = fetchMinecraftServerStatus;
function getConfiguredDiscordGuildId() {
  return activeManagedServerRuntime?.discordGuildId || ENV.discordGuildId;
}
function interactionWasAlreadyAcknowledged(error) {
  const code = error?.code;
  return code === 40060 || /already been acknowledged|already acknowledged/i.test(String(error));
}
function interactionWasNotReplied(error) {
  return /InteractionNotReplied|reply to this interaction has not been sent or deferred/i.test(
    String(error)
  );
}
async function ensureDeferredReply(interaction, options = {}) {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable())
    return false;
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply(options);
    interaction.__ritzDeferred = true;
    interaction.__ritzDeferConfirmed = true;
    return true;
  } catch (error) {
    if (interactionWasAlreadyAcknowledged(error) || interaction.deferred || interaction.replied) {
      interaction.__ritzAcknowledgedByRace = true;
      pushLog(
        "INFO",
        "Interaction was acknowledged by another handler; continuing with followUp"
      );
      return true;
    }
    pushLog("ERROR", `Could not defer interaction: ${String(error)}`);
    return false;
  }
}
async function safeReply(interaction, options) {
  if (!interaction) return false;
  if (typeof interaction.isRepliable === "function" && !interaction.isRepliable())
    return false;
  let payload = options;
  if (typeof options === "string") {
    payload = {
      content: options.length > 1950 ? options.slice(0, 1900) + "\n...(\u0E16\u0E39\u0E01\u0E15\u0E31\u0E14\u0E17\u0E2D\u0E19\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27)" : options
    };
  } else if (options && typeof options === "object" && typeof options.content === "string" && options.content.length > 1950) {
    payload = {
      ...options,
      content: options.content.slice(0, 1900) + "\n...(\u0E16\u0E39\u0E01\u0E15\u0E31\u0E14\u0E17\u0E2D\u0E19\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27)"
    };
  }
  try {
    if (interaction.deferred || interaction.replied || interaction.__ritzDeferConfirmed) {
      await interaction.editReply(payload);
    } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
    return true;
  } catch (error) {
    if (interactionWasNotReplied(error)) {
      try {
        await interaction.reply(payload);
        return true;
      } catch (replyError) {
        if (interactionWasAlreadyAcknowledged(replyError) && typeof interaction.followUp === "function") {
          await interaction.followUp(payload);
          return true;
        }
        pushLog(
          "ERROR",
          `safeReply reply recovery failed: ${String(replyError)}`
        );
        return false;
      }
    }
    if (interactionWasAlreadyAcknowledged(error)) {
      try {
        if (interaction.deferred || interaction.replied || interaction.__ritzDeferConfirmed) {
          await interaction.editReply(payload);
        } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
        return true;
      } catch (retryError) {
        pushLog(
          "ERROR",
          `safeReply acknowledged retry failed: ${String(retryError)}`
        );
        return false;
      }
    }
    pushLog("WARN", `safeReply failed: ${String(error)}`);
    try {
      const fallbackPayload = {
        content: "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
        ephemeral: true
      };
      if (!interaction.replied && !interaction.deferred && !interaction.__ritzAcknowledgedByRace) {
        await interaction.reply(fallbackPayload);
      } else if (interaction.__ritzAcknowledgedByRace && typeof interaction.followUp === "function") {
        await interaction.followUp(fallbackPayload);
      } else {
        await interaction.editReply(fallbackPayload);
      }
      return true;
    } catch (fallbackError) {
      pushLog("ERROR", `safeReply fallback failed: ${String(fallbackError)}`);
      return false;
    }
  }
}
var RITZ_WELCOME_COVER_IMAGE_URL = "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/welcome-cover_ec173e6c.png";
var RITZ_RANK_CLAIM_IMAGE_URL = "https://ritzsmpstore-94jhsfkx.manus.space/manus-storage/rank-claim_2909f231.png";
function buildOnboardingComponents() {
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ritz_verify_button").setLabel("\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ritz_cancel_verify_button").setLabel("\u274C \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E23\u0E2B\u0E31\u0E2A / \u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ritz_unlink_button").setLabel("\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ritz_report_button").setLabel("\u{1F4DD} \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19").setStyle(ButtonStyle.Secondary)
  );
  return [actionRow];
}
function buildRankClaimComponents() {
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ritz_claim_rank_button").setLabel("\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19").setStyle(ButtonStyle.Success)
  );
  return [actionRow];
}
function buildRankClaimEmbed() {
  return new EmbedBuilder().setTitle("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E31\u0E19\u0E14\u0E49\u0E27\u0E22\u0E19\u0E49\u0E32\u2728").setDescription(
    "\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP \u0E19\u0E30\u0E04\u0E30 \u{1F496}\\n\\n\u0E2B\u0E32\u0E01\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E43\u0E2B\u0E49\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D\u0E04\u0E48\u0E30"
  ).setColor(16730972).setImage(RITZ_RANK_CLAIM_IMAGE_URL).setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34" }).setTimestamp();
}
var AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED = false;
function parseEmbedColor(input, fallback = 15485081) {
  if (typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 16777215) {
    return input;
  }
  const normalized = String(input ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? parseInt(normalized, 16) : fallback;
}
function isHttpUrl(value) {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function buildManualEmbedPayload(options) {
  const embed = new EmbedBuilder().setTitle(options.title.trim().slice(0, 256)).setDescription(options.description.trim().slice(0, 4096)).setColor(parseEmbedColor(options.color)).setTimestamp().setFooter({
    text: (options.footerText || "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI").slice(
      0,
      2048
    )
  });
  if (isHttpUrl(options.imageUrl)) embed.setImage(options.imageUrl);
  const components = [];
  if (options.buttonLabel?.trim() && isHttpUrl(options.buttonUrl)) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(options.buttonLabel.trim().slice(0, 80)).setStyle(ButtonStyle.Link).setURL(options.buttonUrl)
      )
    );
  }
  return { embeds: [embed], components };
}
function buildManualSystemPanelPayload(kind, overrides = {}) {
  const defaults = kind === "welcome" ? {
    title: "\u{1F44B} \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP",
    description: "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E04\u0E48\u0E30 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u{1F496}",
    color: 15485081,
    imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
    footerText: "RitzSMP AI \u2022 \u0E41\u0E1C\u0E07\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07"
  } : {
    title: "\u0E44\u0E27\u0E49\u0E40\u0E08\u0E2D\u0E01\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E19\u0E30\u0E04\u0E30 \u{1F44B}",
    description: "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E04\u0E48\u0E30",
    color: 16020150,
    imageUrl: RITZ_WELCOME_COVER_IMAGE_URL,
    footerText: "RitzSMP AI \u2022 \u0E41\u0E1C\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07"
  };
  return buildManualEmbedPayload({ ...defaults, ...overrides });
}
function isDiscordAdministrator(interaction) {
  if (!interaction?.guild) return false;
  const permissions = interaction.memberPermissions ?? interaction.member?.permissions;
  if (permissions?.has)
    return permissions.has(PermissionsBitField2.Flags.Administrator);
  return false;
}
function getEmbedData(message) {
  const source = message?.embeds?.[0]?.data ?? message?.embeds?.[0] ?? {};
  return {
    title: String(source.title ?? "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 RitzSMP AI"),
    description: String(source.description ?? ""),
    color: source.color,
    imageUrl: source.image?.url ?? null,
    footerText: source.footer?.text ?? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI"
  };
}
async function requireDiscordAdministrator(interaction) {
  if (isDiscordAdministrator(interaction)) return true;
  await safeReply(interaction, {
    content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30 \u{1F512}",
    ephemeral: true
  });
  return false;
}
function getInteractionTextChannel(interaction) {
  const channel = interaction?.channel;
  return channel?.isTextBased?.() && typeof channel.send === "function" ? channel : null;
}
function isMisroutedWelcomePanelMessage(message) {
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  const customIds = (message.components ?? []).flatMap((row) => row?.components ?? []).map(
    (component) => String(
      component?.customId ?? component?.data?.custom_id ?? component?.custom_id ?? ""
    )
  );
  const isWelcomeTitle = titles.some(
    (title) => title.includes("\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48 RitzSMP")
  );
  const isWelcomeFooter = footers.some(
    (footer) => footer.includes("\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48")
  );
  return (isWelcomeTitle || isWelcomeFooter) && customIds.includes("ritz_verify_button");
}
function planMisroutedWelcomePanelCleanup(messages) {
  return Array.from(messages).filter(isMisroutedWelcomePanelMessage).map((message) => message.id);
}
var ACCOUNT_LIST_PANEL_MARKER = "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35 \u2022 canonical-v1";
var LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME = "\u{1F9FE}\u2502\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08";
var LEGACY_KANOPI_BOT_USER_ID = "1369921212062629939";
function isLegacyKanopiRankLogMessage(message) {
  const authorId = String(message.author?.id ?? "");
  const authorName = String(message.author?.username ?? "").toLowerCase();
  const isLegacyAuthor = authorId === LEGACY_KANOPI_BOT_USER_ID || message.author?.bot === true && (authorName === "botnasa000" || authorName.includes("kanopi"));
  if (!isLegacyAuthor) return false;
  const content = String(message.content ?? "");
  const embedFields = (message.embeds ?? []).flatMap(
    (embed) => embed?.fields ?? embed?.data?.fields ?? []
  );
  const fieldNames = embedFields.map((field) => String(field?.name ?? "")).join(" ");
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  const hasRankLogContent = content.includes("\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27");
  const hasRankLogFields = fieldNames.includes("\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21") && fieldNames.includes("\u0E2A\u0E44\u0E15\u0E25\u0E4C \u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19");
  const hasLegacyIdFooter = footers.some((footer) => /^ID:\s*\d+/.test(footer));
  return hasRankLogContent || hasRankLogFields && hasLegacyIdFooter;
}
function planLegacyKanopiRankLogCleanup(messages) {
  return Array.from(messages).filter(isLegacyKanopiRankLogMessage).map((message) => message.id);
}
var RITZ_SYSTEM_CHANNEL_TARGETS = [
  {
    name: "\u{1F517}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: ["\u2705\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14", "\u{1F517}\u2502\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35-Minecraft"],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E01\u0E31\u0E1A Minecraft \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E23\u0E2B\u0E31\u0E2A /verify 4 \u0E2B\u0E25\u0E31\u0E01"
  },
  {
    name: "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
    legacyNames: [
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\uFE31\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35",
      "\u{1F4CB}\u2502\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D-\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19"
    ],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27"
  },
  {
    name: "\u{1F396}\uFE0F\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E22\u0E28",
    legacyNames: ["\u{1FAAA}\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E21\u0E30", "\u{1F396}\uFE0F\u2502\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19-\u0E23\u0E31\u0E1A\u0E22\u0E28"],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E01\u0E14\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 RitzSMP AI"
  },
  {
    name: "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A",
    legacyNames: [
      "\u{1F44B}\u2502welcome",
      "\u{1F44B}\u2502\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A-\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E2D\u0E01",
      "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A-\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E2D\u0E01",
      "\u{1F91E}\u{1F3FB}\u2502leave"
    ],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  },
  {
    name: "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01",
    legacyNames: ["\u{1F44B}\u2502leave", "\u{1F44B}\u2502\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01", "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"],
    type: ChannelType2.GuildText,
    topic: "\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C"
  }
];
function planManagedSystemChannelCleanup(channels, target) {
  const candidates = Array.from(channels).filter(
    (channel) => (channel.type === void 0 || channel.type === ChannelType2.GuildText) && (channel.name === target.name || target.legacyNames.includes(channel.name))
  ).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id)
  );
  const exactMatches = candidates.filter(
    (channel) => channel.name === target.name
  );
  const canonical = exactMatches[0] ?? candidates[0];
  return {
    canonicalId: canonical?.id ?? null,
    duplicateIds: candidates.filter((channel) => channel.id !== canonical?.id).map((channel) => channel.id)
  };
}
function isAccountListPanelMessage(message, botUserId) {
  if (botUserId && message.author?.id !== botUserId) return false;
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const customIds = (message.components ?? []).flatMap((row) => row?.components ?? []).map(
    (component) => String(component?.customId ?? component?.data?.custom_id ?? "")
  );
  return titles.some((title) => title.includes("\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35")) || customIds.includes("ritz_profile_button");
}
function planAccountListPanelCleanup(messages, botUserId) {
  const panels = Array.from(messages).filter((message) => isAccountListPanelMessage(message, botUserId)).sort(
    (a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) || a.id.localeCompare(b.id)
  );
  return {
    canonicalId: panels[0]?.id ?? null,
    duplicateIds: panels.slice(1).map((message) => message.id)
  };
}
function buildAccountListPanelPayload() {
  const embed = new EmbedBuilder().setTitle("\u{1F4CB} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19").setDescription(
    "\u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 RitzSMP \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E04\u0E48\u0E30 \u2728"
  ).setColor(3900150).setFooter({ text: ACCOUNT_LIST_PANEL_MARKER }).setTimestamp();
  const profileRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ritz_profile_button").setLabel("\u{1FAAA} \u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ritz_discord_members_button").setLabel("\u{1F465} \u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ritz_players_button").setLabel("\u26CF\uFE0F \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 Minecraft \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ritz_unlink_button").setLabel("\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35").setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [profileRow] };
}
async function fetchRecentChannelMessages(channel, limit = 100) {
  const collection = await channel.messages.fetch({ limit });
  return Array.from(collection.values());
}
async function cleanupLegacyKanopiRankLogMessages(client) {
  const rankLogChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!rankLogChannelId) return;
  const channel = await client.channels.fetch(rankLogChannelId).catch(() => null);
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planLegacyKanopiRankLogCleanup(messages);
  for (const message of messages.filter(
    (message2) => staleIds.includes(message2.id)
  )) {
    await message.delete(
      "Remove legacy Kanopi rank-log message from RitzSMP purchase-success channel"
    ).then(() => {
      pushLog(
        "SUCCESS",
        `Removed legacy Kanopi rank-log message ${message.id}`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove legacy Kanopi rank-log message ${message.id}: ${String(error)}`
      );
    });
  }
}
async function cleanupMisroutedWelcomePanels(client) {
  const purchaseChannelId = ENV.discordSupportChannelId?.trim() || "";
  if (!purchaseChannelId) return;
  const channel = await client.channels.fetch(purchaseChannelId).catch(() => null);
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const staleIds = planMisroutedWelcomePanelCleanup(messages);
  for (const message of messages.filter(
    (message2) => staleIds.includes(message2.id)
  )) {
    await message.delete("Remove misrouted welcome panel from purchase-success channel").then(() => {
      pushLog(
        "SUCCESS",
        `Removed misrouted welcome panel ${message.id} from purchase-success channel`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove misrouted welcome panel ${message.id}: ${String(error)}`
      );
    });
  }
}
async function reconcileAccountListPanel(channel, client) {
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const cleanupPlan = planAccountListPanelCleanup(messages, botUserId);
  const canonicalPanel = messages.find(
    (message) => message.id === cleanupPlan.canonicalId
  );
  if (canonicalPanel) {
    await canonicalPanel.edit(buildAccountListPanelPayload());
  } else {
    await channel.send(buildAccountListPanelPayload());
  }
  for (const stalePanel of messages.filter(
    (message) => cleanupPlan.duplicateIds.includes(message.id)
  )) {
    await stalePanel.delete("Remove duplicate RitzSMP AI account-list panel").catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate account-list panel: ${String(error)}`
      );
    });
  }
}
async function cleanupDuplicateAccountListChannel(channel, client) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const duplicatePanels = messages.filter(
    (message) => isAccountListPanelMessage(message, botUserId)
  );
  for (const panel of duplicatePanels) {
    await panel.delete(
      "Remove duplicate RitzSMP AI account-list panel from legacy channel"
    ).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete legacy account-list panel: ${String(error)}`
      );
    });
  }
  const nonPanelMessages = messages.filter(
    (message) => !isAccountListPanelMessage(message, botUserId)
  );
  if (nonPanelMessages.length > 0) {
    if (channel.name !== LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME && typeof channel.setName === "function") {
      const previousName = channel.name;
      await channel.setName(
        LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME,
        "Clarify preserved rank-fulfillment log channel"
      ).then(() => {
        pushLog(
          "SUCCESS",
          `Renamed preserved legacy channel ${previousName} to ${LEGACY_ACCOUNT_LIST_LOG_CHANNEL_NAME}`
        );
      }).catch((error) => {
        pushLog(
          "WARN",
          `Could not rename preserved legacy account-list channel ${channel.id}: ${String(error)}`
        );
      });
    }
    return;
  }
  if (messages.length < 100 && typeof channel.delete === "function") {
    await channel.delete("Remove empty legacy RitzSMP AI account-list channel").catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate account-list channel ${channel.id}: ${String(error)}`
      );
    });
  }
}
async function addConfiguredRole(interaction, roleId, reason) {
  if (!roleId || !interaction.guild) return false;
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }
    return true;
  } catch (error) {
    pushLog(
      "WARN",
      `Could not add configured Discord role ${roleId}: ${String(error)}`
    );
    return false;
  }
}
function getVerificationConflict(existingForDiscord, existingForMinecraft, discordUserId, minecraftUuid) {
  if (existingForMinecraft && existingForMinecraft.discordUserId !== discordUserId)
    return "minecraft-linked-to-other-discord";
  if (existingForDiscord && existingForDiscord.minecraftUuid !== minecraftUuid)
    return "discord-linked-to-other-minecraft";
  return null;
}
async function verifyDiscordNativeAccount(interaction, shouldClaimRank) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  const rawInput = interaction.fields.getTextInputValue("minecraft_ign").trim();
  let minecraftInfo = "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Minecraft (\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E1C\u0E48\u0E32\u0E19 Discord 100%)";
  let verified = await addConfiguredRole(
    interaction,
    ENV.discordVerifiedRoleId,
    "RitzSMP AI Discord-native verification"
  );
  let rankMessage = "";
  if (rawInput && rawInput.length > 0 && !/^none$/i.test(rawInput)) {
    const profile = await fetchMinecraftProfile(rawInput);
    if (profile) {
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id
        );
        const existingForMinecraft = await getDiscordVerificationByMinecraftUuid(profile.id);
        const verificationConflict = getVerificationConflict(
          existingForDiscord,
          existingForMinecraft,
          interaction.user.id,
          profile.id
        );
        if (verificationConflict === "minecraft-linked-to-other-discord") {
          await safeReply(
            interaction,
            "\u0E0A\u0E37\u0E48\u0E2D Minecraft \u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E01\u0E31\u0E1A Discord \u0E2D\u0E37\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E43\u0E19 Discord \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E08\u0E4A\u0E30 \u{1F495}"
          );
          return;
        }
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: profile.name,
            minecraftUuid: profile.id
          });
        }
        minecraftInfo = `**${profile.name}**`;
        if (shouldClaimRank) {
          const rankResult = await grantMinecraftRank(
            profile.name,
            ENV.discordClaimRankGroup
          );
          const memberRoleAdded2 = await addConfiguredRole(
            interaction,
            ENV.discordMemberRoleId,
            "RitzSMP member rank claim"
          );
          rankMessage = rankResult.executed ? `
\u{1F396}\uFE0F \u0E21\u0E2D\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms **${ENV.discordClaimRankGroup}** \u0E43\u0E2B\u0E49\u0E43\u0E19\u0E40\u0E01\u0E21\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30${memberRoleAdded2 ? " \u0E41\u0E25\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E04\u0E49\u0E32" : ""}` : `
\u{1F396}\uFE0F \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14 RCON \u0E43\u0E19\u0E40\u0E01\u0E21${memberRoleAdded2 ? " (\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27\u0E08\u0E49\u0E32)" : ""}`;
        }
      } catch (err) {
        pushLog("WARN", `Optional Minecraft lookup note: ${String(err)}`);
      }
    } else {
      try {
        const existingForDiscord = await getDiscordVerification(
          interaction.user.id
        );
        if (!existingForDiscord) {
          await createDiscordVerification({
            discordUserId: interaction.user.id,
            minecraftIGN: rawInput.slice(0, 16),
            minecraftUuid: `discord-native-${interaction.user.id}`
          });
        }
        minecraftInfo = `**${rawInput}** (Discord-native alias)`;
      } catch (e) {
      }
    }
  } else {
    try {
      const existingForDiscord = await getDiscordVerification(
        interaction.user.id
      );
      if (!existingForDiscord) {
        await createDiscordVerification({
          discordUserId: interaction.user.id,
          minecraftIGN: interaction.user.username.slice(0, 16),
          minecraftUuid: `discord-native-${interaction.user.id}`
        });
      }
    } catch (e) {
    }
  }
  const memberRoleAdded = shouldClaimRank ? await addConfiguredRole(
    interaction,
    ENV.discordMemberRoleId,
    "RitzSMP member role claim"
  ) : false;
  await safeReply(
    interaction,
    `\u0E22\u0E34\u0E19\u0E14\u0E35\u0E14\u0E49\u0E27\u0E22\u0E19\u0E30\u0E04\u0E30! \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E43\u0E19 Discord \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E32 \u2728
\u{1F464} \u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01: **${interaction.user.tag}**
\u26CF\uFE0F Minecraft: ${minecraftInfo}
${verified ? "\u2705 \u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E22\u0E28 Verified \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E19\u0E30\u0E04\u0E30 \u{1F495}" : "\u26A0\uFE0F \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Verified Role \u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A"}`
  );
  pushLog("SUCCESS", `Discord-native verified ${interaction.user.id}`);
}
function buildDiscordMembersEmbed(members) {
  const visibleMembers = members.filter((member) => !member.user?.bot).slice(0, 25);
  const description = visibleMembers.length > 0 ? visibleMembers.map((member, index) => {
    const displayName = member.displayName || member.user?.globalName || member.user?.username || `\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 ${index + 1}`;
    return `**${index + 1}.** ${displayName} (<@${member.id}>)`;
  }).join("\n") : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord \u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30";
  return new EmbedBuilder().setTitle("\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord RitzSMP").setDescription(description).addFields({
    name: "\u{1F512} \u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27",
    value: "\u0E41\u0E2A\u0E14\u0E07\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E0A\u0E37\u0E48\u0E2D Discord \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23 mention \u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C \u0E44\u0E21\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\u0E04\u0E48\u0E30"
  }).setColor(9133302).setFooter({
    text: visibleMembers.length >= 25 ? "\u0E41\u0E2A\u0E14\u0E07 25 \u0E04\u0E19\u0E41\u0E23\u0E01 \u2022 \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E15\u0E47\u0E21\u0E14\u0E39\u0E44\u0E14\u0E49\u0E43\u0E19 Discord" : `\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07 ${visibleMembers.length} \u0E04\u0E19`
  }).setTimestamp();
}
async function replyWithDiscordMembers(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    if (!interaction.guild?.members?.fetch) {
      await safeReply(interaction, {
        content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E20\u0E32\u0E22\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Discord \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
        ephemeral: true
      });
      return;
    }
    const fetched = await interaction.guild.members.fetch();
    const members = Array.from(
      typeof fetched.values === "function" ? fetched.values() : []
    );
    await safeReply(interaction, {
      embeds: [buildDiscordMembersEmbed(members)],
      ephemeral: true
    });
  } catch (error) {
    pushLog("ERROR", `Failed to load Discord member list: ${String(error)}`);
    await safeReply(interaction, {
      content: "\u0E22\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Discord \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
function buildMinecraftPlayersEmbed(status) {
  const playerCount = Number.isFinite(status.players) ? Math.max(0, status.players) : 0;
  const maxPlayers = Number.isFinite(status.maxPlayers) ? Math.max(0, status.maxPlayers) : 0;
  const description = status.online ? playerCount === 0 ? "\u{1F7E2} \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C" : status.playerNames.length > 0 ? status.playerNames.map((name) => `\u2022 ${name}`).join("\n") : "\u{1F7E2} \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C \u0E41\u0E15\u0E48 API \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30" : "\u{1F534} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C\u0E04\u0E48\u0E30 \u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27";
  const statusValue = status.online ? `\u{1F7E2} \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C ${playerCount}/${maxPlayers} \u0E04\u0E19` : "\u{1F534} \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u2022 \u0E41\u0E2A\u0E14\u0E07 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27";
  return new EmbedBuilder().setTitle("\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19 RitzSMP").setDescription(description).addFields({ name: "\u0E2A\u0E16\u0E32\u0E19\u0E30", value: statusValue, inline: true }).setColor(status.online ? 2278750 : 15680580).setTimestamp().setFooter({
    text: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01 Minecraft status API \u2022 \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A"
  });
}
async function replyWithPlayers(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    const mc = await fetchMinecraftServerStatus();
    await safeReply(interaction, {
      embeds: [buildMinecraftPlayersEmbed(mc)],
      ephemeral: true
    });
  } catch (error) {
    pushLog("WARN", `Minecraft player status fallback: ${String(error)}`);
    await safeReply(interaction, {
      content: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Minecraft \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E48\u0E30 \u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19 0 \u0E04\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
async function replyWithVerificationCode(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  try {
    const codeRow = await createDiscordVerificationCode(interaction.user.id);
    const embed = new EmbedBuilder().setTitle("\u{1F517} \u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19 Minecraft").setDescription(
      `\u0E19\u0E35\u0E48\u0E04\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E04\u0E48\u0E30:

# \`${codeRow.code}\`

\u{1F4CC} **\u0E27\u0E34\u0E18\u0E35\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19:**
1. \u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21 Minecraft (ritz.mcsv.me)
2. \u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 \`/verify ${codeRow.code}\` \u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E0A\u0E17
3. \u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E08\u0E30\u0E16\u0E39\u0E01\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30! \u{1F495}`
    ).setColor(15485081).setFooter({
      text: `\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E35\u0E49\u0E08\u0E30\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E43\u0E19 10 \u0E19\u0E32\u0E17\u0E35 (${new Date(codeRow.expiresAt).toLocaleTimeString("th-TH")})`
    }).setTimestamp();
    await safeReply(interaction, { embeds: [embed], ephemeral: true });
    pushLog(
      "SUCCESS",
      `Generated verification code ${codeRow.code} for ${interaction.user.id}`
    );
  } catch (err) {
    pushLog("ERROR", `Failed to generate verification code: ${String(err)}`);
    await safeReply(interaction, {
      content: "\u0E02\u0E2D\u0E2D\u0E20\u0E31\u0E22\u0E04\u0E48\u0E30 \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
      ephemeral: true
    });
  }
}
async function showMinecraftModal(interaction, customId, title) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder().setCustomId("minecraft_ign").setLabel(
    "\u0E0A\u0E37\u0E48\u0E2D Minecraft (\u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C 'none' \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1C\u0E48\u0E32\u0E19 Discord \u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27)"
  ).setPlaceholder("\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E27\u0E49\u0E19\u0E27\u0E48\u0E32\u0E07\u0E44\u0E14\u0E49\u0E08\u0E49\u0E32").setStyle(TextInputStyle.Short).setMinLength(0).setMaxLength(32).setRequired(false);
  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );
  await interaction.showModal(modal);
}
function isProfileOwner(discordUserId, verification) {
  return typeof verification.discordUserId !== "string" || discordUserId === verification.discordUserId;
}
function canEditProfile(discordUserId, verification) {
  return isProfileOwner(discordUserId, verification);
}
function buildProfileEmbed(interaction, verification) {
  if (!isProfileOwner(interaction.user.id, verification)) {
    throw new Error("\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19");
  }
  const skinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(verification.minecraftIGN)}/128`;
  return new EmbedBuilder().setTitle(`\u{1FAAA} \u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 ${interaction.user.username}`).setDescription(
    verification.bio || "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E02\u0E35\u0E22\u0E19\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E04\u0E48\u0E30"
  ).setColor(15485081).setThumbnail(skinUrl).addFields(
    {
      name: "Discord",
      value: `${interaction.user.tag}
ID: \`${interaction.user.id}\``,
      inline: false
    },
    {
      name: "Minecraft",
      value: `**${verification.minecraftIGN}**
UUID: \`${verification.minecraftUuid}\``,
      inline: false
    },
    {
      name: "\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19",
      value: verification.playStyle || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38",
      inline: true
    },
    { name: "\u0E2A\u0E16\u0E32\u0E19\u0E30", value: "\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E49\u0E27", inline: true },
    {
      name: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D",
      value: new Date(verification.verifiedAt).toLocaleString("th-TH"),
      inline: false
    }
  ).setFooter({
    text: "\u0E01\u0E14 \u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E41\u0E25\u0E30\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19"
  }).setTimestamp();
}
async function replyWithProfile(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {
    }
  }
  if (!verification) {
    await interaction.editReply(
      "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14 \u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E19\u0E30\u0E04\u0E30 \u{1F495}"
    );
    return;
  }
  await interaction.editReply({
    embeds: [buildProfileEmbed(interaction, verification)]
  });
}
async function showProfileModal(interaction) {
  let verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    try {
      await createDiscordVerification({
        discordUserId: interaction.user.id,
        minecraftIGN: interaction.user.username.slice(0, 16),
        minecraftUuid: `discord-native-${interaction.user.id}`
      });
      verification = await getDiscordVerification(interaction.user.id);
    } catch (e) {
    }
  }
  if (!verification) {
    await interaction.reply({
      content: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14 \u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
      ephemeral: true
    });
    return;
  }
  const modal = new ModalBuilder().setCustomId("ritz_profile_modal").setTitle("\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C RitzSMP");
  const bioInput = new TextInputBuilder().setCustomId("profile_bio").setLabel("\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E2A\u0E31\u0E49\u0E19 \u0E46").setPlaceholder("\u0E40\u0E0A\u0E48\u0E19 \u0E0A\u0E2D\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E49\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E25\u0E48\u0E19\u0E01\u0E31\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19 \u0E46").setStyle(TextInputStyle.Paragraph).setMaxLength(300).setRequired(false).setValue(verification.bio || "");
  const styleInput = new TextInputBuilder().setCustomId("profile_play_style").setLabel("\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19").setPlaceholder("\u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E32\u0E22\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E49\u0E32\u0E19 / \u0E2A\u0E32\u0E22\u0E1C\u0E08\u0E0D\u0E20\u0E31\u0E22").setStyle(TextInputStyle.Short).setMaxLength(128).setRequired(false).setValue(verification.playStyle || "");
  modal.addComponents(
    new ActionRowBuilder().addComponents(bioInput),
    new ActionRowBuilder().addComponents(styleInput)
  );
  await interaction.showModal(modal);
}
async function updateProfileFromModal(interaction) {
  if (!await ensureDeferredReply(interaction, { ephemeral: true })) return;
  const verification = await getDiscordVerification(interaction.user.id);
  if (!verification) {
    await interaction.editReply(
      "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E01\u0E48\u0E2D\u0E19\u0E19\u0E30\u0E04\u0E30"
    );
    return;
  }
  if (!canEditProfile(interaction.user.id, verification)) {
    await interaction.editReply("\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19\u0E04\u0E48\u0E30");
    return;
  }
  const bio = interaction.fields.getTextInputValue("profile_bio").trim().slice(0, 300) || null;
  const playStyle = interaction.fields.getTextInputValue("profile_play_style").trim().slice(0, 128) || null;
  const updated = await updateDiscordProfile(interaction.user.id, {
    bio,
    playStyle
  });
  if (!updated) {
    await interaction.editReply(
      "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30"
    );
    return;
  }
  await interaction.editReply({
    content: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F496}",
    embeds: [buildProfileEmbed(interaction, updated)]
  });
  pushLog("SUCCESS", `Updated Discord profile for ${interaction.user.id}`);
}
function isWelcomeSystemPanelMessage(message) {
  const titles = (message.embeds ?? []).map(
    (embed) => String(embed?.title ?? embed?.data?.title ?? "")
  );
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  return titles.some(
    (title) => title.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP") || title.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01")
  ) || footers.some(
    (footer) => footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48") || footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01")
  );
}
function isLeaveSystemPanelMessage(message) {
  const footers = (message.embeds ?? []).map(
    (embed) => String(embed?.footer?.text ?? embed?.data?.footer?.text ?? "")
  );
  return footers.some((footer) => footer.includes("\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01"));
}
function buildWelcomeSystemPanelPayload() {
  const embed = new EmbedBuilder().setTitle("\u{1F44B} \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48 RitzSMP").setDescription(
    "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E04\u0E48\u0E30 \u{1F496}"
  ).setColor(15485081).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48" });
  return { embeds: [embed] };
}
function buildLeaveSystemPanelPayload() {
  const embed = new EmbedBuilder().setTitle("\u0E44\u0E27\u0E49\u0E40\u0E08\u0E2D\u0E01\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E19\u0E30\u0E04\u0E30 \u{1F44B}").setDescription(
    "\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP \u0E04\u0E48\u0E30"
  ).setColor(16020150).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01" });
  return { embeds: [embed] };
}
async function cleanupDuplicateMemberEventChannel(channel, client, type) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const stalePanels = messages.filter((message) => {
    if (botUserId && message.author?.id !== botUserId) return false;
    return isWelcomeSystemPanelMessage(message) || isLeaveSystemPanelMessage(message);
  });
  for (const panel of stalePanels) {
    await panel.delete(`Remove duplicate ${type} system panel from legacy channel`).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate ${type} panel from legacy channel: ${String(error)}`
      );
    });
  }
  const userMessages = messages.filter(
    (message) => !stalePanels.some((panel) => panel.id === message.id)
  );
  if (userMessages.length === 0 && typeof channel.delete === "function") {
    await channel.delete(`Remove duplicate ${type} notification channel`).then(() => {
      pushLog(
        "SUCCESS",
        `Removed duplicate ${type} notification channel ${channel.id}`
      );
    }).catch((error) => {
      pushLog(
        "WARN",
        `Could not remove duplicate ${type} notification channel ${channel.id}: ${String(error)}`
      );
    });
  }
}
async function reconcileMemberEventSystemPanel(channel, client, type) {
  if (!channel?.isTextBased?.() || !("messages" in channel)) return;
  const messages = await fetchRecentChannelMessages(channel);
  const botUserId = client.user?.id;
  const detector = type === "welcome" ? isWelcomeSystemPanelMessage : isLeaveSystemPanelMessage;
  const panels = messages.filter(
    (message) => (!botUserId || message.author?.id === botUserId) && detector(message)
  ).sort(
    (a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0) || a.id.localeCompare(b.id)
  );
  const canonicalPanel = panels[0];
  const payload = type === "welcome" ? buildWelcomeSystemPanelPayload() : buildLeaveSystemPanelPayload();
  if (canonicalPanel) {
    await canonicalPanel.edit(payload);
  } else {
    await channel.send(payload);
  }
  for (const duplicate of panels.slice(1)) {
    await duplicate.delete(`Remove duplicate ${type} system panel`).catch((error) => {
      pushLog(
        "WARN",
        `Could not delete duplicate ${type} system panel: ${String(error)}`
      );
    });
  }
}
async function handleOnboardingInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ritz_verify_button") {
        await replyWithVerificationCode(interaction);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_button") {
        const existing = await getDiscordVerification(interaction.user.id);
        if (!existing) {
          await showMinecraftModal(
            interaction,
            "ritz_claim_rank_modal",
            "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28 RitzSMP"
          );
          return true;
        }
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        const rankResult = await grantMinecraftRank(
          existing.minecraftIGN,
          ENV.discordClaimRankGroup
        );
        const memberRoleAdded = await addConfiguredRole(
          interaction,
          ENV.discordMemberRoleId,
          "RitzSMP member rank claim"
        );
        await safeReply(interaction, {
          content: rankResult.executed ? `\u0E21\u0E2D\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms **${ENV.discordClaimRankGroup}** \u0E43\u0E2B\u0E49 **${existing.minecraftIGN}** \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30${memberRoleAdded ? " \u0E41\u0E25\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27" : ""}` : `\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E21\u0E2D\u0E1A\u0E22\u0E28\u0E43\u0E19\u0E40\u0E01\u0E21\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 RCON${memberRoleAdded ? " (\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19 Discord \u0E41\u0E25\u0E49\u0E27)" : ""}`,
          ephemeral: true
        });
        return true;
      }
      if (interaction.customId === "ritz_players_button") {
        await replyWithPlayers(interaction);
        return true;
      }
      if (interaction.customId === "ritz_discord_members_button") {
        await replyWithDiscordMembers(interaction);
        return true;
      }
      if (interaction.customId === "ritz_profile_button") {
        await replyWithProfile(interaction);
        return true;
      }
      if (interaction.customId === "ritz_edit_profile_button") {
        await showProfileModal(interaction);
        return true;
      }
      if (interaction.customId === "ritz_cancel_verify_button") {
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        await cancelDiscordVerificationCode(interaction.user.id);
        await safeReply(interaction, {
          content: "\u274C \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E40\u0E14\u0E34\u0E21\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E43\u0E2B\u0E21\u0E48 4 \u0E2B\u0E25\u0E31\u0E01\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
          ephemeral: true
        });
        return true;
      }
      if (interaction.customId === "ritz_unlink_button") {
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return true;
        await unlinkDiscordVerification(interaction.user.id);
        await safeReply(interaction, {
          content: "\u{1F513} \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft \u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30 \u2728",
          ephemeral: true
        });
        return true;
      }
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "ritz_verify_modal") {
        await verifyDiscordNativeAccount(interaction, false);
        return true;
      }
      if (interaction.customId === "ritz_claim_rank_modal") {
        await verifyDiscordNativeAccount(interaction, true);
        return true;
      }
      if (interaction.customId === "ritz_profile_modal") {
        await updateProfileFromModal(interaction);
        return true;
      }
    }
  } catch (err) {
    pushLog("ERROR", `Error in handleOnboardingInteraction: ${String(err)}`);
    await safeReply(interaction, {
      content: "\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E33\u0E02\u0E2D\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u{1F495} \u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D",
      ephemeral: true
    });
    return true;
  }
  return false;
}
function startRitzSmpAiBot() {
  if (botStartup.promise) {
    pushLog(
      "WARN",
      "RitzSMP AI startup already in progress; reusing the existing startup promise."
    );
  }
  return botStartup.run(async () => {
    try {
      activeManagedServerRuntime = await getActiveManagedServerRuntimeConfig() ?? null;
      if (activeManagedServerRuntime) {
        pushLog(
          "INFO",
          `Using managed-server runtime overlay for ${activeManagedServerRuntime.slug}`
        );
      }
    } catch (error) {
      activeManagedServerRuntime = null;
      pushLog(
        "WARN",
        `Managed-server runtime overlay unavailable; using default environment: ${String(error)}`
      );
    }
    return createRitzSmpAiBot(activeManagedServerRuntime ?? void 0);
  });
}
function resolveRitzSmpAiBotToken(runtime, tokenOverride) {
  if (tokenOverride !== void 0) return tokenOverride.trim();
  return runtime?.discordBotToken?.trim() || process.env.DISCORD_AI_BOT_TOKEN?.trim() || ENV.discordAiBotToken.trim();
}
function createRitzSmpAiBot(runtime, tokenOverride) {
  if (runtime) activeManagedServerRuntime = runtime;
  const token = resolveRitzSmpAiBotToken(runtime, tokenOverride);
  if (!token || token === "102031") {
    pushLog("WARN", "No Discord AI Bot token provided. Bot disabled.");
    return null;
  }
  const client = new Client2({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
    ]
  });
  botClient = client;
  let readyBootstrapStarted = false;
  client.once("ready", async () => {
    if (readyBootstrapStarted) {
      pushLog(
        "WARN",
        "Ignoring duplicate RitzSMP AI ready bootstrap for the same client."
      );
      return;
    }
    readyBootstrapStarted = true;
    botStartTime = Date.now();
    pushLog("SUCCESS", `RitzSMP AI bot logged in as ${client.user?.tag}`);
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";
    const commands = buildRitzSmpAiCommands();
    const rest = new REST({ version: "10" }).setToken(token);
    const clientId = client.user?.id;
    if (!clientId) return;
    try {
      pushLog("INFO", "Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      pushLog(
        "SUCCESS",
        "Successfully registered global slash commands for RitzSMP AI."
      );
      const statusChannelId = await ensureMinecraftStatusTextChannel(
        client,
        getConfiguredDiscordGuildId()
      );
      if (statusChannelId) {
        pushLog(
          "SUCCESS",
          `Dedicated Minecraft status channel ready: ${statusChannelId}`
        );
      } else {
        pushLog(
          "WARN",
          "Minecraft status channel was not created; presence announcements remain disabled until it is configured."
        );
      }
      await cleanupMisroutedWelcomePanels(client);
      await cleanupLegacyKanopiRankLogMessages(client);
      if (AUTO_SYSTEM_PANEL_DEPLOYMENT_ENABLED) {
        try {
          const guild = await client.guilds.fetch(getConfiguredDiscordGuildId()).catch(() => null);
          if (guild) {
            const channelsToEnsure = RITZ_SYSTEM_CHANNEL_TARGETS;
            for (const target of channelsToEnsure) {
              const cleanupPlan = planManagedSystemChannelCleanup(
                guild.channels.cache.values(),
                target
              );
              if (target.name === "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel = guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateAccountListChannel(
                    duplicateChannel,
                    client
                  );
                }
              } else if (target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" || target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01") {
                for (const duplicateId of cleanupPlan.duplicateIds) {
                  const duplicateChannel = guild.channels.cache.get(duplicateId);
                  await cleanupDuplicateMemberEventChannel(
                    duplicateChannel,
                    client,
                    target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"
                  );
                }
              }
              let channel = cleanupPlan.canonicalId ? guild.channels.cache.get(cleanupPlan.canonicalId) : void 0;
              if (channel && channel.name !== target.name) {
                const previousName = channel.name;
                try {
                  await channel.setName(
                    target.name,
                    "Standardize RitzSMP AI system channel name"
                  );
                  pushLog(
                    "SUCCESS",
                    `Renamed legacy channel ${previousName} to ${target.name}`
                  );
                } catch (renameErr) {
                  pushLog(
                    "WARN",
                    `Could not rename legacy channel ${previousName} to ${target.name}: ${String(renameErr)}`
                  );
                }
              }
              if (channel && channel.type === ChannelType2.GuildText && "setTopic" in channel) {
                await channel.setTopic(target.topic).catch((topicErr) => {
                  pushLog(
                    "WARN",
                    `Could not update topic for ${target.name}: ${String(topicErr)}`
                  );
                });
              }
              if (!channel) {
                try {
                  channel = await guild.channels.create({
                    name: target.name,
                    type: target.type,
                    topic: target.topic
                  });
                  pushLog("SUCCESS", `Auto-created channel: ${target.name}`);
                } catch (createErr) {
                  pushLog(
                    "WARN",
                    `Could not create channel ${target.name}: ${String(createErr)}`
                  );
                }
              }
              if (channel && channel.isTextBased()) {
                try {
                  if (target.name === "\u{1F4CB}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                    await reconcileAccountListPanel(channel, client);
                    pushLog(
                      "SUCCESS",
                      `Reconciled one canonical panel in ${target.name}`
                    );
                  } else if (target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" || target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01") {
                    await reconcileMemberEventSystemPanel(
                      channel,
                      client,
                      target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"
                    );
                    pushLog(
                      "SUCCESS",
                      `Reconciled one ${target.name === "\u{1F44B}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A" ? "welcome" : "leave"} panel in ${target.name}`
                    );
                  } else {
                    const messages = await channel.messages.fetch({
                      limit: 100
                    });
                    const existingBotMsg = messages.find(
                      (m) => m.author.id === client.user?.id
                    );
                    if (!existingBotMsg) {
                      if (target.name === "\u{1F517}\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35") {
                        const embed = new EmbedBuilder().setTitle("\u2728 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Minecraft RitzSMP").setDescription(
                          "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48 RitzSMP! \u{1F338}\n\n\u{1F4CC} **\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35:**\n1. \u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 **\u{1F517} \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35** \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01\n2. \u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21 Minecraft \u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 `/verify <\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01>` \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30! \u{1F495}"
                        ).setColor(15485081).setImage(RITZ_WELCOME_COVER_IMAGE_URL).setTimestamp().setFooter({
                          text: "RitzSMP AI \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E21."
                        });
                        await channel.send({
                          embeds: [embed],
                          components: buildOnboardingComponents()
                        });
                      } else if (target.name === "\u{1F396}\uFE0F\u2502\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E22\u0E28") {
                        await channel.send({
                          embeds: [buildRankClaimEmbed()],
                          components: buildRankClaimComponents()
                        });
                      }
                      pushLog(
                        "SUCCESS",
                        `Posted panel to channel ${target.name}`
                      );
                    }
                  }
                } catch (msgErr) {
                  pushLog(
                    "WARN",
                    `Could not post panel to ${target.name}: ${String(msgErr)}`
                  );
                }
              }
            }
          }
        } catch (panelDeployErr) {
          pushLog(
            "WARN",
            `Channel auto-deployment note: ${String(panelDeployErr)}`
          );
        }
      }
    } catch (error) {
      pushLog(
        "ERROR",
        `RitzSMP AI ready bootstrap failed after command registration: ${String(error)}`
      );
    }
  });
  client.on(
    "disconnect",
    () => pushLog("WARN", "RitzSMP AI bot disconnected from Discord")
  );
  client.on(
    "reconnecting",
    () => pushLog("INFO", "RitzSMP AI bot attempting to reconnect...")
  );
  client.on(
    "error",
    (error) => pushLog("ERROR", `Discord client error: ${error.message}`)
  );
  client.on("interactionCreate", async (interaction) => {
    try {
      if (await handleOnboardingInteraction(interaction)) {
        pushLog(
          "SUCCESS",
          `Handled onboarding interaction ${"customId" in interaction ? interaction.customId : "unknown"}`
        );
        return;
      }
    } catch (err) {
      pushLog("ERROR", `Onboarding interaction failed: ${String(err)}`);
      try {
        if (interaction.isRepliable()) {
          await safeReply(interaction, {
            content: "\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E33\u0E25\u0E31\u0E07\u0E02\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E07\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E04\u0E48\u0E30 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
            ephemeral: true
          });
        }
      } catch (replyError) {
        pushLog(
          "WARN",
          `Could not reply to onboarding error: ${String(replyError)}`
        );
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    totalInteractionsCount++;
    const commandName = interaction.commandName;
    const storeUrl = ENV.publicStoreUrl || "https://ritz.mcsv.me";
    pushLog(
      "INFO",
      `Received command /${commandName} from ${interaction.user.tag}`
    );
    try {
      if (commandName === "status" || commandName === "ai-status") {
        if (!await ensureDeferredReply(interaction, { ephemeral: false }))
          return;
        const mc = await checkMinecraftServerStatus();
        const uptimeMin = botStartTime ? Math.floor((Date.now() - botStartTime) / 6e4) : 0;
        const statusEmbed = new EmbedBuilder().setTitle("\u{1F4CA} RitzSMP System & Server Status").setDescription(
          "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft RitzSMP \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C \u2728"
        ).setColor(mc.online ? 2278750 : 15680580).addFields(
          {
            name: "\u{1F916} \u0E1A\u0E2D\u0E17 RitzSMP AI",
            value: `\u{1F7E2} \u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C (${uptimeMin} \u0E19\u0E32\u0E17\u0E35)
\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E35\u0E48\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23: ${totalInteractionsCount} \u0E04\u0E23\u0E31\u0E49\u0E07`,
            inline: false
          },
          {
            name: "\u26CF\uFE0F \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft (ritz.mcsv.me)",
            value: mc.online ? `\u{1F7E2} **\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C**
\u{1F465} \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C: \`${mc.players} / ${mc.maxPlayers}\`
\u{1F4CC} \u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19: \`${mc.version}\`
\u26A1 \u0E04\u0E27\u0E32\u0E21\u0E2B\u0E19\u0E48\u0E27\u0E07 (Latency): \`${mc.latency}ms\`
\u{1F4AC} MOTD: *${mc.motd}*` : "\u{1F534} **\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E1B\u0E34\u0E14\u0E1B\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E38\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27**",
            inline: false
          }
        ).setTimestamp().setFooter({ text: "RitzSMP \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E21." });
        await safeReply(interaction, { embeds: [statusEmbed] });
        pushLog("SUCCESS", `Executed /${commandName} successfully`);
        return;
      }
      if (commandName === "profile") {
        await replyWithProfile(interaction);
        pushLog("SUCCESS", "Executed /profile successfully");
        return;
      }
      if (commandName === "verify") {
        await replyWithVerificationCode(interaction);
        pushLog("SUCCESS", "Executed /verify successfully");
        return;
      }
      if (commandName === "players") {
        await replyWithPlayers(interaction);
        pushLog("SUCCESS", "Executed /players successfully");
        return;
      }
      if (commandName === "members") {
        await replyWithDiscordMembers(interaction);
        pushLog("SUCCESS", "Executed /members successfully");
        return;
      }
      if (commandName === "store") {
        const storeEmbed = new EmbedBuilder().setTitle("\u{1F6D2} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP Store").setDescription(
          "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E40\u0E27\u0E47\u0E1A\u0E2A\u0E42\u0E15\u0E23\u0E4C\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07 RitzSMP!\n\n\u2022 \u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E25\u0E34\u0E1B\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19 (PromptPay / TrueMoney Wallet)\n\u2022 \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E2A\u0E38\u0E14\u0E04\u0E38\u0E49\u0E21 (\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E15\u0E34\u0E21\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E02\u0E49\u0E32\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E17\u0E31\u0E19\u0E17\u0E35\u0E1C\u0E48\u0E32\u0E19 RCON)\n\u2022 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14 24 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07"
        ).setColor(49151).setFooter({ text: "RitzSMP Store \u2022 \u0E2A\u0E30\u0E14\u0E27\u0E01 \u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 100%" });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("\u{1F310} \u0E40\u0E1B\u0E34\u0E14\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP").setStyle(ButtonStyle.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [storeEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /store successfully");
        return;
      }
      if (commandName === "ranks") {
        const ranksEmbed = new EmbedBuilder().setTitle("\u{1F451} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E22\u0E28\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E43\u0E19 RitzSMP").setDescription(
          "\u0E22\u0E01\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19\u0E40\u0E01\u0E21\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E43\u0E19\u0E2D\u0E32\u0E13\u0E32\u0E08\u0E31\u0E01\u0E23 RitzSMP \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E2A\u0E38\u0E14\u0E04\u0E38\u0E49\u0E21\u0E04\u0E48\u0E32:\n\n\u{1F48E} **VIP Tier:** \u0E44\u0E14\u0E49\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E0A\u0E49 `/fly`, `/nv`, `/craft`, \u0E41\u0E25\u0E30 `/hat` \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E02\u0E36\u0E49\u0E19\n\u{1F451} **Royal Tier:** \u0E22\u0E28\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E2A\u0E39\u0E07 \u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E40\u0E15\u0E47\u0E21\u0E1E\u0E34\u0E01\u0E31\u0E14 \u0E1A\u0E34\u0E19\u0E44\u0E14\u0E49 \u0E21\u0E2D\u0E07\u0E43\u0E19\u0E17\u0E35\u0E48\u0E21\u0E37\u0E14 \u0E41\u0E25\u0E30\u0E40\u0E0B\u0E47\u0E15\u0E1A\u0E49\u0E32\u0E19\u0E44\u0E14\u0E49\u0E08\u0E38\u0E43\u0E08\n\n\u0E0B\u0E37\u0E49\u0E2D\u0E44\u0E14\u0E49\u0E07\u0E48\u0E32\u0E22\u0E46 \u0E1C\u0E48\u0E32\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E2A\u0E42\u0E15\u0E23\u0E4C \u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E31\u0E14\u0E40\u0E07\u0E34\u0E19\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E41\u0E25\u0E30\u0E40\u0E15\u0E34\u0E21\u0E22\u0E28\u0E40\u0E02\u0E49\u0E32\u0E40\u0E01\u0E21\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E1C\u0E48\u0E32\u0E19 RCON \u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
        ).setColor(16766720).setFooter({ text: "RitzSMP \u2022 \u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 24 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07" });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("\u{1F6D2} \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E43\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C").setStyle(ButtonStyle.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [ranksEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /ranks successfully");
        return;
      }
      if (commandName === "topup") {
        const topupEmbed = new EmbedBuilder().setTitle("\u{1F4B3} \u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28 RitzSMP Store").setDescription(
          "\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E2A\u0E19\u0E31\u0E1A\u0E2A\u0E19\u0E38\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C:\n\n1\uFE0F\u20E3 **\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32 (\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B):**\n\u2022 \u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19 PromptPay / TrueMoney Wallet: `0930286252`\n\u2022 \u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E21\u0E19\u0E39\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 \u0E01\u0E23\u0E2D\u0E01\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19 \u0E41\u0E25\u0E30\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E25\u0E34\u0E1B\n\u2022 \u0E23\u0E2D\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\n\n2\uFE0F\u20E3 **\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28 (\u0E43\u0E0A\u0E49\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E07\u0E34\u0E19 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E19\u0E1A\u0E2A\u0E25\u0E34\u0E1B):**\n\u2022 \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E22\u0E28\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 \u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E01\u0E21 (Minecraft IGN)\n\u2022 \u0E01\u0E14\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E2B\u0E31\u0E01\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E41\u0E25\u0E30\u0E40\u0E15\u0E34\u0E21\u0E22\u0E28\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
        ).setColor(65484).setFooter({ text: "RitzSMP Store \u2022 \u0E2A\u0E30\u0E14\u0E27\u0E01 \u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E23\u0E27\u0E14\u0E40\u0E23\u0E47\u0E27\u0E17\u0E31\u0E19\u0E43\u0E08" });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("\u{1F4B3} \u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 / \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28").setStyle(ButtonStyle.Link).setURL(storeUrl)
        );
        await safeReply(interaction, {
          embeds: [topupEmbed],
          components: [row],
          ephemeral: false
        });
        pushLog("SUCCESS", "Executed /topup successfully");
        return;
      }
      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder().setTitle("\u{1F4D6} \u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E1A\u0E2D\u0E17 RitzSMP AI").setDescription(
          "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E23\u0E48\u0E27\u0E21\u0E01\u0E31\u0E1A\u0E19\u0E49\u0E2D\u0E07 RitzSMP AI \u0E44\u0E14\u0E49\u0E04\u0E48\u0E30:"
        ).setColor(11032055).addFields(
          {
            name: "/ask <\u0E04\u0E33\u0E16\u0E32\u0E21>",
            value: "\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22 \u0E1B\u0E23\u0E36\u0E01\u0E29\u0E32 \u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E31\u0E1A\u0E19\u0E49\u0E2D\u0E07 AI \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22",
            inline: false
          },
          {
            name: "/status (\u0E2B\u0E23\u0E37\u0E2D /ai-status)",
            value: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1A\u0E2D\u0E17\u0E41\u0E25\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C",
            inline: false
          },
          {
            name: "/store",
            value: "\u0E40\u0E1B\u0E34\u0E14\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07 RitzSMP",
            inline: false
          },
          {
            name: "/ranks",
            value: "\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E1B\u0E23\u0E30\u0E42\u0E22\u0E0A\u0E19\u0E4C\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E22\u0E28",
            inline: false
          },
          {
            name: "/topup",
            value: "\u0E14\u0E39\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19\u0E41\u0E25\u0E30\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28",
            inline: false
          },
          {
            name: "/profile",
            value: "\u0E14\u0E39\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27/\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19",
            inline: false
          },
          {
            name: "/music play <url>",
            value: "\u0E40\u0E25\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E07\u0E08\u0E32\u0E01 YouTube/SoundCloud; \u0E43\u0E0A\u0E49 /music queue, /music skip, /music stop \u0E41\u0E25\u0E30 /music leave \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E04\u0E34\u0E27\u0E04\u0E48\u0E30 (\u0E42\u0E2B\u0E21\u0E14\u0E1F\u0E23\u0E35\u0E2D\u0E32\u0E08\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E23\u0E30\u0E1A\u0E1A\u0E1E\u0E31\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07)",
            inline: false
          },
          {
            name: "/setup panel",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19",
            inline: false
          },
          {
            name: "/setup welcome / /setup leave",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01\u0E40\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E42\u0E1E\u0E2A\u0E15\u0E4C\u0E0B\u0E49\u0E33\u0E15\u0E2D\u0E19\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15",
            inline: false
          },
          {
            name: "/embed default",
            value: "\u0E2A\u0E48\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1B\u0E38\u0E48\u0E21\u0E25\u0E34\u0E07\u0E01\u0E4C",
            inline: false
          },
          {
            name: "/embed create",
            value: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28 Embed \u0E41\u0E1A\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E2D\u0E07",
            inline: false
          },
          {
            name: "/embed edit <message_id>",
            value: "\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E17\u0E35\u0E48 RitzSMP AI \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19",
            inline: false
          },
          {
            name: "/embed delete <message_id>",
            value: "\u0E25\u0E1A Embed \u0E17\u0E35\u0E48 RitzSMP AI \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19",
            inline: false
          }
        ).setTimestamp().setFooter({ text: "RitzSMP AI Bot \u2022 \u0E1E\u0E31\u0E12\u0E19\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E23\u0E31\u0E01\u0E04\u0E48\u0E30 \u{1F496}" });
        await safeReply(interaction, { embeds: [helpEmbed], ephemeral: false });
        pushLog("SUCCESS", "Executed /help successfully");
        return;
      }
      if (commandName === "setup") {
        if (!await requireDiscordAdministrator(interaction)) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (!channel) {
          await safeReply(interaction, {
            content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E04\u0E48\u0E30",
            ephemeral: true
          });
          return;
        }
        if (!await ensureDeferredReply(interaction, { ephemeral: true }))
          return;
        if (subcommand === "panel") {
          const onboardingEmbed = new EmbedBuilder().setTitle("\u2728 \u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1A\u0E31\u0E0D\u0E0A\u0E35 RitzSMP").setDescription(
            "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48\u0E04\u0E2D\u0E21\u0E21\u0E39\u0E19\u0E34\u0E15\u0E35\u0E49 RitzSMP \u0E04\u0E48\u0E30! \u{1F338}\n\n\u2022 **\u2705 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19:** \u0E1C\u0E39\u0E01\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Discord \u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E01\u0E31\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E22\u0E28 Verified \u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1E\u0E34\u0E40\u0E28\u0E29\n\u2022 **\u{1F396}\uFE0F \u0E23\u0E31\u0E1A\u0E22\u0E28\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19:** \u0E01\u0E14\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E38\u0E48\u0E21 LuckPerms \u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft \u0E41\u0E25\u0E30\u0E22\u0E28\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E19\u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14\n\u2022 **\u{1F465} \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F:** \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E2D\u0E19\u0E44\u0E25\u0E19\u0E4C\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C\n\u2022 **\u{1FAAA} \u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19:** \u0E14\u0E39\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E31\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E25\u0E48\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\n\u2022 **\u{1F4DD} \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19:** \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E43\u0E2B\u0E49\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\n\n\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E30! \u{1F495}"
          ).setColor(15485081).setTimestamp().setFooter({ text: "RitzSMP AI \u2022 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19" });
          await channel.send({
            embeds: [onboardingEmbed],
            components: buildOnboardingComponents()
          });
          await channel.send({
            embeds: [buildRankClaimEmbed()],
            components: buildRankClaimComponents()
          });
          await safeReply(interaction, {
            content: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1C\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E1A\u0E31\u0E0D\u0E0A\u0E35 \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19 \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E22\u0E28\u0E25\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u2728",
            ephemeral: true
          });
          pushLog("SUCCESS", "Executed /setup panel successfully");
          return;
        }
        if (subcommand === "welcome" || subcommand === "leave") {
          await channel.send(buildManualSystemPanelPayload(subcommand));
          await safeReply(interaction, {
            content: `\u0E2A\u0E23\u0E49\u0E32\u0E07 Embed ${subcommand === "welcome" ? "\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01" : "\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2D\u0E2D\u0E01"} \u0E25\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 \u0E42\u0E14\u0E22\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E0B\u0E49\u0E33\u0E40\u0E2D\u0E07\u0E15\u0E2D\u0E19\u0E1A\u0E2D\u0E17\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E15\u0E19\u0E30\u0E04\u0E30`,
            ephemeral: true
          });
          pushLog("SUCCESS", `Executed /setup ${subcommand} successfully`);
          return;
        }
      }
      if (commandName === "embed") {
        if (!await requireDiscordAdministrator(interaction)) return;
        const subcommand = interaction.options.getSubcommand();
        const channel = getInteractionTextChannel(interaction);
        if (subcommand === "default") {
          const embed = new EmbedBuilder().setTitle("\u{1F31F} \u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E08\u0E32\u0E01\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C RitzSMP").setDescription(
            "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E38\u0E01\u0E17\u0E48\u0E32\u0E19\u0E2A\u0E39\u0E48 RitzSMP \u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Survival \u0E41\u0E25\u0E30 Economy \u0E2A\u0E38\u0E14\u0E21\u0E31\u0E19\u0E2A\u0E4C!\n\n\u{1F6D2} **\u0E2A\u0E19\u0E43\u0E08\u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19:** \u0E04\u0E25\u0E34\u0E01\u0E1B\u0E38\u0E48\u0E21\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E23\u0E32\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35\u0E04\u0E48\u0E30!"
          ).setColor(15485081).addFields(
            { name: "\u{1F310} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2B\u0E25\u0E31\u0E01", value: storeUrl, inline: true },
            {
              name: "\u{1F4AC} \u0E14\u0E34\u0E2A\u0E04\u0E2D\u0E23\u0E4C\u0E14\u0E04\u0E2D\u0E21\u0E21\u0E39\u0E19\u0E34\u0E15\u0E35\u0E49",
              value: "\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22 \u0E41\u0E08\u0E49\u0E07\u0E1B\u0E31\u0E0D\u0E2B\u0E32 \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E02\u0E48\u0E32\u0E27\u0E2A\u0E32\u0E23\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48",
              inline: true
            }
          ).setTimestamp().setFooter({ text: "RitzSMP Official Announcement" });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("\u{1F310} \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32 RitzSMP").setStyle(ButtonStyle.Link).setURL(storeUrl),
            new ButtonBuilder().setLabel("\u{1F4B3} \u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19 / \u0E0B\u0E37\u0E49\u0E2D\u0E22\u0E28").setStyle(ButtonStyle.Link).setURL(storeUrl)
          );
          await safeReply(interaction, {
            embeds: [embed],
            components: [row],
            ephemeral: false
          });
          pushLog("SUCCESS", "Executed /embed default successfully");
          return;
        }
        if (subcommand === "create") {
          const title = interaction.options.getString("title", true);
          const description = interaction.options.getString(
            "description",
            true
          );
          const colorInput = interaction.options.getString("color") || "#ec4899";
          const imageUrl = interaction.options.getString("image_url");
          const btnLabel = interaction.options.getString("button_label");
          const btnUrl = interaction.options.getString("button_url");
          if (btnLabel && !btnUrl || !btnLabel && btnUrl) {
            await safeReply(interaction, {
              content: "\u0E16\u0E49\u0E32\u0E08\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1B\u0E38\u0E48\u0E21 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E17\u0E31\u0E49\u0E07 button_label \u0E41\u0E25\u0E30 button_url \u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E34\u0E07\u0E01\u0E4C http \u0E2B\u0E23\u0E37\u0E2D https \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          await safeReply(interaction, {
            ...buildManualEmbedPayload({
              title,
              description,
              color: parseEmbedColor(colorInput),
              imageUrl,
              buttonLabel: btnLabel,
              buttonUrl: btnUrl,
              footerText: "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E42\u0E14\u0E22\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19 \u2022 RitzSMP AI"
            }),
            ephemeral: false
          });
          pushLog("SUCCESS", "Executed /embed create successfully");
          return;
        }
        if (subcommand === "edit" || subcommand === "delete") {
          if (!channel) {
            await safeReply(interaction, {
              content: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E21\u0E35 Embed \u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          const messageId = interaction.options.getString("message_id", true);
          if (!await ensureDeferredReply(interaction, { ephemeral: true }))
            return;
          let message;
          try {
            message = await channel.messages.fetch(messageId);
          } catch {
            await safeReply(interaction, {
              content: "\u0E2B\u0E32 Message ID \u0E19\u0E35\u0E49\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E44\u0E21\u0E48\u0E40\u0E08\u0E2D\u0E04\u0E48\u0E30 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A ID \u0E41\u0E25\u0E49\u0E27\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (message.author?.id && message.author.id !== client.user?.id) {
            await safeReply(interaction, {
              content: "\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 \u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E19\u0E35\u0E49\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48 RitzSMP AI \u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          if (subcommand === "delete") {
            await message.delete();
            await safeReply(interaction, {
              content: `\u0E25\u0E1A Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 (Message ID: ${messageId})`,
              ephemeral: true
            });
            pushLog(
              "SUCCESS",
              `Executed /embed delete successfully for message ${messageId}`
            );
            return;
          }
          const existing = getEmbedData(message);
          const title = interaction.options.getString("title") ?? existing.title;
          const description = interaction.options.getString("description") ?? existing.description;
          const colorInput = interaction.options.getString("color");
          const imageUrl = interaction.options.getString("image_url");
          const buttonLabel = interaction.options.getString("button_label");
          const buttonUrl = interaction.options.getString("button_url");
          if (buttonLabel && !buttonUrl || !buttonLabel && buttonUrl) {
            await safeReply(interaction, {
              content: "\u0E16\u0E49\u0E32\u0E08\u0E30\u0E41\u0E01\u0E49\u0E1B\u0E38\u0E48\u0E21 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E2A\u0E48\u0E17\u0E31\u0E49\u0E07 button_label \u0E41\u0E25\u0E30 button_url \u0E19\u0E30\u0E04\u0E30",
              ephemeral: true
            });
            return;
          }
          if (imageUrl && !isHttpUrl(imageUrl)) {
            await safeReply(interaction, {
              content: "image_url \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E34\u0E07\u0E01\u0E4C http \u0E2B\u0E23\u0E37\u0E2D https \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E04\u0E48\u0E30",
              ephemeral: true
            });
            return;
          }
          const payload = buildManualEmbedPayload({
            title,
            description,
            color: colorInput ?? existing.color ?? 15485081,
            imageUrl: imageUrl ?? existing.imageUrl,
            buttonLabel,
            buttonUrl,
            footerText: existing.footerText
          });
          await message.edit({
            embeds: payload.embeds,
            components: buttonLabel || buttonUrl ? payload.components : message.components ?? []
          });
          await safeReply(interaction, {
            content: `\u0E41\u0E01\u0E49\u0E44\u0E02 Embed \u0E02\u0E2D\u0E07 RitzSMP AI \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30 (Message ID: ${messageId})`,
            ephemeral: true
          });
          pushLog(
            "SUCCESS",
            `Executed /embed edit successfully for message ${messageId}`
          );
          return;
        }
      }
      if (commandName === "ask") {
        if (!await ensureDeferredReply(interaction, { ephemeral: false }))
          return;
        const question = interaction.options.getString("question", true);
        const dynamicSeed = Math.random().toString(36).substring(7);
        const systemPrompt = `\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E07 "RitzSMP AI" \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E2A\u0E38\u0E14\u0E19\u0E48\u0E32\u0E23\u0E31\u0E01 \u0E1B\u0E23\u0E30\u0E08\u0E33\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Minecraft "RitzSMP" (\u0E23\u0E2B\u0E31\u0E2A\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C: ritz.mcsv.me)
\u0E1A\u0E38\u0E04\u0E25\u0E34\u0E01\u0E20\u0E32\u0E1E: \u0E1E\u0E39\u0E14\u0E08\u0E32\u0E2A\u0E38\u0E20\u0E32\u0E1E \u0E19\u0E48\u0E32\u0E23\u0E31\u0E01 \u0E40\u0E1B\u0E47\u0E19\u0E01\u0E31\u0E19\u0E40\u0E2D\u0E07 \u0E21\u0E35\u0E2B\u0E32\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07 "\u0E04\u0E48\u0E30", "\u0E19\u0E30\u0E04\u0E30", "\u0E19\u0E30\u0E04\u0E49\u0E32" \u0E40\u0E2A\u0E21\u0E2D \u0E41\u0E25\u0E30\u0E21\u0E31\u0E01\u0E08\u0E30\u0E21\u0E35 emoji \u0E19\u0E48\u0E32\u0E23\u0E31\u0E01\u0E46 \u0E40\u0E0A\u0E48\u0E19 \u2728, \u{1F496}, \u{1F31F} \u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A
\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E33\u0E04\u0E31\u0E0D: \u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E43\u0E0A\u0E49 /store \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E04\u0E49\u0E32, /ranks \u0E14\u0E39\u0E22\u0E28, /topup \u0E27\u0E34\u0E18\u0E35\u0E40\u0E15\u0E34\u0E21\u0E40\u0E07\u0E34\u0E19, /status \u0E14\u0E39\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C
\u0E01\u0E0F\u0E40\u0E2B\u0E25\u0E47\u0E01: \u0E2B\u0E49\u0E32\u0E21\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B\u0E40\u0E14\u0E34\u0E21\u0E0B\u0E49\u0E33\u0E46 \u0E43\u0E2B\u0E49\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E04\u0E33\u0E16\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E15\u0E31\u0E27\u0E08\u0E23\u0E34\u0E07\u0E23\u0E2D\u0E1A\u0E19\u0E35\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u0E15\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19 \u0E2A\u0E14\u0E43\u0E2B\u0E21\u0E48 \u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2A\u0E23\u0E23\u0E04\u0E4C\u0E15\u0E32\u0E21\u0E1A\u0E23\u0E34\u0E1A\u0E17\u0E04\u0E33\u0E16\u0E32\u0E21 (Seed: ${dynamicSeed})`;
        try {
          const aiReply = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question }
            ]
          });
          const finalMessage = aiReply || "\u0E19\u0E49\u0E2D\u0E07 RitzSMP AI \u0E2D\u0E22\u0E39\u0E48\u0E19\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E30! \u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E1E\u0E35\u0E48\u0E2A\u0E32\u0E27\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E14\u0E39\u0E41\u0E25\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E44\u0E2B\u0E19\u0E43\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E1A\u0E2D\u0E01\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E49\u0E32 \u{1F496}\u2728";
          await safeReply(interaction, finalMessage);
          pushLog(
            "SUCCESS",
            `Executed /ask successfully for question: "${question.substring(0, 30)}..."`
          );
        } catch (err) {
          pushLog("ERROR", `Failed to invoke LLM for /ask: ${String(err)}`);
          await safeReply(
            interaction,
            "\u0E41\u0E07... \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E19\u0E49\u0E2D\u0E07 AI \u0E01\u0E33\u0E25\u0E31\u0E07\u0E21\u0E36\u0E19\u0E2B\u0E31\u0E27\u0E19\u0E34\u0E14\u0E2B\u0E19\u0E48\u0E2D\u0E22\u0E04\u0E48\u0E30 \u0E25\u0E2D\u0E07\u0E16\u0E32\u0E21\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C /help \u0E14\u0E39\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u0E19\u0E30\u0E04\u0E49\u0E32 \u{1F97A}\u{1F496}"
          );
        }
      }
    } catch (err) {
      pushLog(
        "ERROR",
        `Error handling command /${commandName}: ${String(err)}`
      );
      await safeReply(interaction, {
        content: "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E30\u0E04\u0E30 \u{1F495}",
        ephemeral: true
      });
    }
  });
  client.login(token).catch((err) => {
    pushLog("ERROR", `Discord login failed: ${err.message}`);
  });
  return client;
}

// server/discordAiBotRunner.ts
void startRitzSmpAiBot().catch((error) => {
  console.error("[RitzSmpAI] Startup failed without exposing credentials:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
