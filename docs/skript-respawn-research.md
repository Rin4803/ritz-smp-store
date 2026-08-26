# Skript Respawn Research — 2026-08-26

Skript 2.16.1 documents `respawn location` as the writable location used within the `on respawn` event. The available Bed expression returns a player's valid bed location (that is, the respawn point if the player slept in a bed and the bed remains usable). Therefore, the server script should test the player's **bed location**, not compare the event's `respawn location` object to a bed.

Sources consulted:

- [Skript 2.16.1 documentation — respawn location](https://docs.skriptlang.org/docs.html)
- [SkriptHub — Bed expression](https://skripthub.net/docs/?id)
