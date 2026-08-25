export function shouldRunAiGateway(runtime = process.env.DISCORD_AI_GATEWAY_RUNTIME): boolean {
  return runtime === "persistent";
}
