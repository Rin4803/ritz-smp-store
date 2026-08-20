# RitzSMP AI Multi-Server Platform Architecture

## Executive Summary
To transform RitzSMP AI from a single-server bot into a scalable, multi-tenant SaaS platform (akin to advanced community bots like Kanopi), we introduce a **Multi-Server Management Architecture**. This allows server owners and administrators to onboard their own Minecraft and Discord servers, configure unique integrations, manage automated verification, rank fulfillment, and access the complete command suite through a unified web control panel.

---

## 1. Multi-Server Data Schema Design

We extend the Drizzle database schema to support isolated server tenants and configuration settings:

```sql
-- Managed Servers Table
CREATE TABLE managed_servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ownerId INT NOT NULL,
  serverName VARCHAR(128) NOT NULL,
  minecraftHost VARCHAR(255) NOT NULL,
  minecraftRconPort INT DEFAULT 25575,
  minecraftRconPassword VARCHAR(255),
  discordGuildId VARCHAR(64) NOT NULL UNIQUE,
  discordBotToken VARCHAR(255) NOT NULL,
  verifyChannelId VARCHAR(64),
  statusChannelId VARCHAR(64),
  musicChannelId VARCHAR(64),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Server-Specific Verifications & Linkages
ALTER TABLE discord_verifications ADD COLUMN serverId INT DEFAULT 1;
```

---

## 2. Multi-Tenant Bot Management Engine

Each registered server runs an isolated instance of the Discord client lifecycle using its dedicated bot token and RCON credentials:

| Component | Single-Server (Current) | Multi-Server SaaS Architecture |
| :--- | :--- | :--- |
| **Bot Token** | Environment variable (`DISCORD_BOT_TOKEN`) | Dynamic lookup per server from `managed_servers` table |
| **RCON Fulfillment** | Hardcoded target | Dynamically targeted per server based on incoming store purchase or verification |
| **Command Catalog** | Global commands | Guild-scoped dynamic command registration per tenant |
| **Web Dashboard** | RitzSMP single store admin | Server Selector dropdown + multi-server configuration wizard |

---

## 3. Implementation Roadmap & Next Steps

1. **Database Migration:** Apply multi-server schema changes via Drizzle.
2. **Server Management UI:** Add a "Servers" tab in the Admin Dashboard allowing owners to register new Minecraft/Discord server connections.
3. **Dynamic Client Pool:** Refactor `server/discordAiBot.ts` to maintain a map of active Discord clients keyed by `serverId`.
4. **Live Verification & Music Isolation:** Route verification callbacks, music queues, and RCON fulfillment to the active server tenant.

References:
- RitzSMP AI Core Specifications & Documentation
- Discord.js v14 Multi-Client Architecture Guidelines
