const channelId = "1540059975064485898";
const guildId = "1525527108854481007";
const token = process.env.DISCORD_AI_BOT_TOKEN?.trim();

if (!token) {
  console.error("DISCORD_AI_BOT_TOKEN is unavailable to this diagnostic process.");
  process.exit(2);
}

const response = await fetch(
  `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
  {
    headers: { Authorization: `Bot ${token}` },
  },
);

if (!response.ok) {
  console.error(`Discord API request failed with HTTP ${response.status}.`);
  process.exit(3);
}

const messages = await response.json();
const panel = messages.find((message) => {
  const customIds = (message.components ?? []).flatMap((row) =>
    (row.components ?? []).map((component) => component.custom_id),
  );
  return customIds.includes("ritz_profile_button");
});

if (!panel) {
  console.error("Account panel message was not found in the latest 100 messages.");
  process.exit(4);
}

const customIds = (panel.components ?? []).flatMap((row) =>
  (row.components ?? []).map((component) => component.custom_id),
);

const membersResponse = await fetch(
  `https://discord.com/api/v10/guilds/${guildId}/members?limit=25`,
  {
    headers: { Authorization: `Bot ${token}` },
  },
);

let guildMembersApi = { status: membersResponse.status, returned: 0 };
if (membersResponse.ok) {
  const members = await membersResponse.json();
  const sample = Array.isArray(members) ? members[0] : undefined;
  guildMembersApi = {
    status: membersResponse.status,
    returned: Array.isArray(members) ? members.length : 0,
    sampleHasTopLevelId: Boolean(sample && typeof sample.id === "string"),
    sampleHasUserId: Boolean(sample && typeof sample.user?.id === "string"),
    nonBotWithUserId: Array.isArray(members)
      ? members.filter((member) => typeof member?.user?.id === "string" && member.user.bot !== true).length
      : 0,
  };
}

console.log(
  JSON.stringify({
    messageId: panel.id,
    applicationId: panel.application_id ?? null,
    authorId: panel.author?.id ?? null,
    authorBot: Boolean(panel.author?.bot),
    customIds,
    guildMembersApi,
  }),
);
