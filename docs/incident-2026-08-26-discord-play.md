# Incident findings — 2026-08-26

## Evidence from MCSV latest.log

- Server loaded `DiscordSRV v1.30.5`, `AuctionHouse v1.5.2`, `Skript v2.16.1`, `RitzAuctionBridge v1.0.0`.
- `RitzAuctionBridge` reached `Enabling` and logged that it reads listing/sold events and sends them to `order-in-game`.
- `Skript` loaded all scripts without errors: 28 scripts / 90 structures.
- DiscordSRV failed initialization at 19:28:57 with the explicit message: `DiscordSRV could not connect to Discord because: The bot token is invalid`.
- DiscordSRV was subsequently disabled at 19:29:07.
- A Floodgate player `_JMEXV` connected at 19:37:27 and disconnected at 19:42:11, confirming the server was online while DiscordSRV was disabled.
- AuctionHouse emitted `Elytra` through STDOUT at 19:38:09; this is not sufficient evidence that a transaction was successful.
- The update-check timeout and zip-file warning occurred after DiscordSRV was disabled and are secondary until the token/jar state is repaired.

## Immediate implication

All Discord channel notifications depending on DiscordSRV are expected to be silent because DiscordSRV is disabled. This explains server-login, chat-game, die-log, advancement, and AuctionHouse order notifications not appearing. `/play` must be investigated separately in player/world/command logs; no conclusion about its root cause is made from this log excerpt.

## Safety constraint

Do not print, commit, or write the Discord token value into logs, source, repository, or documentation. Repair must use the existing secret-management path or the server's protected DiscordSRV config input.
