import { AccessToken, RoomAgentDispatch, RoomServiceClient, type VideoGrant } from "livekit-server-sdk";

export function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim(),
  );
}

function httpHost(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export async function mintRoomToken(input: {
  room: string;
  identity: string;
  metadata: string;
}): Promise<{ url: string; token: string }> {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new Error("LiveKit is not configured");

  const svc = new RoomServiceClient(httpHost(url), key, secret);
  await svc.createRoom({
    name: input.room,
    metadata: input.metadata,
    agents: [
      new RoomAgentDispatch({
        agentName: process.env.OSP_AGENT_NAME ?? "open-sales-practice",
      }),
    ],
  });

  const at = new AccessToken(key, secret, {
    identity: input.identity,
    metadata: input.metadata,
    ttl: "15m",
  });
  const grant: VideoGrant = {
    room: input.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  };
  at.addGrant(grant);
  return { url, token: await at.toJwt() };
}
