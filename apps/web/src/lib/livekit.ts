import { AGENT_NAME } from "@osp/core";
import { AccessToken, RoomAgentDispatch, RoomServiceClient, type VideoGrant } from "livekit-server-sdk";
import { HttpError } from "./api";

function keys() {
  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret) {
    throw new HttpError("Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.", 503);
  }
  return { url, key, secret };
}

function httpHost(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export async function mintRoomToken(input: {
  room: string;
  identity: string;
  metadata: string;
}): Promise<{ url: string; token: string }> {
  const { url, key, secret } = keys();
  const svc = new RoomServiceClient(httpHost(url), key, secret);
  try {
    await svc.createRoom({
      name: input.room,
      metadata: input.metadata,
      agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
    });
  } catch {
    // Room already exists from the first dial.
  }

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
