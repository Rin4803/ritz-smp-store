# MCSV Night Vision and Ender Chest Audit — 2026-08-26

## Evidence inspected

The live file `/plugins/Skript/scripts/nightvision-gui.sk` defines `/nv`. When enabled it applies Night Vision for `999999 seconds`. It only reapplies the effect on `join`, `respawn`, and `world change`, each after two ticks. Its old recurring reapplication logic is absent; the bottom of the file contains only comments about preventing removal by other plugins.

This means the player-reported flicker on block breaking, air attacks, block placement, or interaction is not explained by a current loop in this Skript alone. The next audit must identify an external plugin, another Skript, or an event handler that removes/replaces effects during these actions.

The live file `/plugins/Skript/scripts/enderchest45.sk` creates a separate five-row inventory through `/ec45`, `/enderchest45`, and `/ec`. It stores contents as `{ec45::<player uuid>::<slot>}` variables when that custom inventory closes. It does not modify the vanilla Ender Chest inventory or delete the saved custom-variable contents. Disabling this file will restore the standard Ender Chest behaviour while leaving legacy custom data untouched.

## Safety decision

Do not delete any `{ec45::*}` variables. Disable the custom script only after confirming no other Skript uses the `/ec` alias, then reload that specific script or reload Skript safely. Preserve the existing backup created before the Minecraft remediation.

## Additional audit — 2026-08-26 22:42 GMT+7

The installed `lobby.sk` applies Night Vision for 999 days after `/lobby`. The inspected `combat.sk`, `afk.sk`, `afk-mob-protection.sk`, and `death-effects.sk` do not clear or replace potion effects. This evidence does **not** yet identify the flicker source; the next step is to inspect the complete Night Vision Skript, plugin settings, and any remaining player-action handlers.

## Live recheck — 2026-08-26 22:45 GMT+7

The live `nightvision-gui.sk` has no active repeating task or player-action handler. It applies `night vision 1` for `999999 seconds` when the player selects the GUI option, then reapplies only after join, respawn, or a world change. The trailing comment claims to protect against removal by other plugins, but no such protection code currently exists. `lobby.sk` separately grants Night Vision for 999 days after `/lobby`; it also has no block-break, attack, placement, or interaction handler.

The live `enderchest45.sk` still only intercepts `/ec45`, `/enderchest45`, and `/ec`; it does not replace vanilla Ender Chest block behaviour. It can therefore be disabled by taking only this Skript out of the loader and reloading Skript, while leaving all `{ec45::*}` data intact. The server inventory contains no dedicated Ender Chest expansion plugin. Installed components relevant to the remaining Night Vision audit include EssentialsX, Multiverse-Inventories, Geyser/Floodgate, GrimAC, and the Skript ecosystem; no conclusion about the flicker source is made until their live configuration or player test is checked.

## Essentials configuration check — 2026-08-26 22:49 GMT+7

The live EssentialsX `config.yml` has `remove-effects-on-heal: true`; this is limited to the Essentials `/heal` workflow and does not explain effect removal on block break, air attack, placement, or ordinary interaction. Its displayed world-change settings concern flight and speed, not potion effects. No Night Vision-specific reset rule was identified in the inspected configuration segment. The remaining likely causes need an event-level test or inspection of other plugin behavior; no configuration was changed from this audit.

## External option check — 2026-08-26

The EssentialsX documentation search did not verify that the installed EssentialsX build exposes a stable `/nv` replacement. A Paper plugin named [NightVision on Hangar](https://hangar.papermc.io/MrFinky/NightVision) advertises continuous Night Vision without particles, but it has **not** been installed. Its compatibility with Paper 26.2 and the live cause of the flicker must be validated before replacing the current Skript.

## Runtime and bridge-configuration recheck — 2026-08-27 05:56–05:59 GMT+7

`skript list` confirms that `nightvision-gui.sk` is enabled and the former five-row Ender Chest script is disabled as `/Skript/scripts/-enderchest45.sk`. No legacy `{ec45::*}` variables were removed. Together with the previously inspected Multiverse-Inventories `ender-chest: 27` setting, this confirms that the custom `/ec` aliases are no longer loaded and the server is configured for the normal 27-slot Ender Chest. A player still needs to open an actual Ender Chest block to validate the user-facing result.

Geyser-Spigot and Floodgate configurations contain connection, account-linking, Bedrock gameplay, and resource-pack settings but no Night Vision or generic potion-effect reset rule. GrimAC has item-usage reset settings for attack, slot changes, and item updates; the inspected configuration does not declare potion-effect removal or a Night Vision handler. This is negative configuration evidence, not proof that packet or client behavior is impossible. There were no online players during this recheck, so the flicker must remain unresolved until a controlled Java-versus-Bedrock live reproduction can capture the player platform, the exact action, and whether the server-side effect is actually removed.
