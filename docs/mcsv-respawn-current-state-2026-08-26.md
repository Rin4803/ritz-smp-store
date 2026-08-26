# MCSV Respawn and Last-Location State — 2026-08-26

## Verified server facts

The full MCSV backup created immediately before the current respawn and last-location changes completed successfully:

| Backup name | UUID | Completed (UTC) |
|---|---|---|
| `ก่อนแก้ respawn-last-location 2026-08-26` | `cd1db97d-25dd-4db7-970b-77a74af35679` | 2026-08-26 22:18:48 |

The active gameplay worlds confirmed with `mv list` are `Survival`, `survival_nether`, and `survival_the_end`. The current RTP script is explicitly restricted to `Survival`.

## Current scripts read from MCSV

| Script | Confirmed behavior / issue |
|---|---|
| `/plugins/Skript/scripts/survival-respawn.sk` | Now uses `if bed of player exists: stop` to preserve a valid native bed respawn. Only a player without one is sent to the `Survival` spawn, then receives `/rtp`. |
| `/plugins/Skript/scripts/save-location.sk` | Now saves `{survival::lastloc::%player%}` in `Survival`, `survival_nether`, and `survival_the_end` on teleport and quit, then restores it after joining. The `Survival` name was checked against `mv list` and corrected for case sensitivity. |
| `/plugins/Skript/scripts/travel.sk` | `/play` treats a saved location as valid only when it is in `Survival`, so it intentionally does not restore saved Nether or End positions. |
| `/plugins/Skript/scripts/lobby.sk` | Saves only when the current world name equals lowercase `survival`, which does not match the currently configured world `Survival`. |
| `/plugins/Skript/scripts/rtp.sk` | Requires that the player already be in the exact `Survival` world, then selects a random non-water/non-lava highest-solid-block target. |

The next implementation must not alter the currently working `/play` flow. It must preserve native valid-bed respawn and route only no-bed deaths through Survival/RTP. Last-position persistence must cover quit and rejoin for each of the three active gameplay worlds.

## Reload verification

At 2026-08-26 05:36:35 server time, `survival-respawn.sk` reloaded successfully. At 05:38:21, `save-location.sk` also reloaded successfully after its three-world condition was rewritten as separate `if` / `else if` branches; the prior combined `or` condition was rejected by the installed Skript parser. This proves syntax loading only. A player must still verify valid-bed respawn, no-bed RTP, and reconnect location restoration in each gameplay world.
