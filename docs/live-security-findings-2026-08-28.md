
## Live audit evidence

- MCSV file listing confirms the server has `grimac-bukkit-2.3.74-9e26fd9.jar`, `floodgate-spigot.jar`, Multiverse Core/Inventories/NetherPortals/Portals, WorldEdit, Skript-related plugins, and 111 entries under `/plugins` at the time of audit.
- Recent console evidence showed `KIWIOWO555 issued server command: /weather storm`, followed by repeated `[nv-diagnostic.sk] Night Vision removed` and `[nightvision-gui.sk] [NV-RECOVERY] Restored Night Vision` messages. This confirms the Night Vision removal is external to the GUI script and that at least one non-console player command path must be audited for authorization.
- The live console log also showed `Successfully reloaded nightvision-gui.sk`, so the latest script reload itself did not report a syntax failure.
- `console_send` is blocked by the MCSV Security Guard for permission-management commands such as `op`, `deop`, `lp`, and `luckperms`; permission changes must therefore be performed through the server console/management UI or file-based configuration using the connector's supported file tools.
- The MCSV tools require `files_list` with input field `directory`; its returned names are the ground truth for subsequent file paths. Existing-file edits should use anchor-based `files_edit`, and files are automatically backed up before API edits.

## Latest live configuration evidence

- `/plugins/Skript/scripts/survival-respawn.sk` currently handles `on respawn`, stops when `bed of player exists`, and otherwise chooses a safe random location in `Survival` within X/Z ±25,000, falling back to the Survival spawn point.
- `/plugins/GrimAC/config.yml` is GrimAC config flavor V2 version 11. It has experimental checks enabled, ghost-block building disabled, elytra sprint-jump exploit disabled, packet spam threshold 100, and `update-permission-ticks: -1`. It does not itself grant flight or speed permissions; those must be audited in server/plugin permissions.
- `/config/paper-world-defaults.yml` currently has Paper Anti-Xray enabled with engine mode 3, `max-block-height: -1`, `lava-obscures: true`, update-radius 2, and a broad hidden-block list including ores, containers, obsidian, clay, amethyst, and ancient debris. This is full-height/default coverage rather than a bottom-only setting, subject to world-specific overrides.
- `/plugins/DonutScoreboard/config.yml` currently shows a static `&6&lRITZ SMP` title and fields for time, rank, team, online, K/D, money, coins, ping, and playtime. `/plugins/DonutScoreboard/animations.yml` still defines `ritz_smooth` at interval 1 with eight frames, so animation behavior must be checked against the installed plugin before changing it.
- `/plugins/DonutScoreboard/groups.yml` has only MVP and VIP permission groups in the inspected file; the primary scoreboard rank line uses `%luckperms_prefix%`, so Owner/CEO visibility must be verified in LuckPerms and any rank mapping file separately.
