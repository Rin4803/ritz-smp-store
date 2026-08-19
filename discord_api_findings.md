# Discord API findings

Discord's official documentation confirms that application commands and message components are delivered as Interactions, which can be received and responded to by an application. Official references:

- Receiving and Responding to Interactions: https://docs.discord.com/developers/interactions/receiving-and-responding
- Interactions Overview: https://docs.discord.com/developers/interactions/overview
- Application Commands: https://docs.discord.com/developers/interactions/application-commands
- Webhook Resource: https://docs.discord.com/developers/resources/webhook
- Permissions: https://docs.discord.com/developers/topics/permissions

Design implication: the existing incoming Discord webhook can post order notifications, but interactive Approve/Reject controls require a Discord application/bot or interaction endpoint with authenticated command permissions. A webhook URL alone is not sufficient for receiving admin button clicks.
