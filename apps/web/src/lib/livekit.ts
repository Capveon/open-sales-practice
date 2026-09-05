import { AGENT_NAME } from "@osp/core";
import {
  AccessToken,
  AgentDispatchClient,
  RoomAgentDispatch,
  RoomConfiguration,
  RoomServiceClient,
  type VideoGrant,
} from "livekit-server-sdk";
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

function alreadyThere(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already|exist/i.test(message);
}

export async function mintRoomToken(input: {
  room: string;
  identity: string;
  metadata: string;
}): Promise<{ url: string; token: string }> {
  const { url, key, secret } = keys();
  const host = httpHost(url);
  const rooms = new RoomServiceClient(host, key, secret);
  const dispatch = new AgentDispatchClient(host, key, secret);
  const agent = new RoomAgentDispatch({
    agentName: AGENT_NAME,
    metadata: input.metadata,
  });

  try {
    await rooms.createRoom({
      name: input.room,
      metadata: input.metadata,
      agents: [agent],
    });
  } catch (err) {
    if (!alreadyThere(err)) throw err;
  }

  try {
    const current = await dispatch.listDispatch(input.room);
    const named = current.some((d) => d.agentName === AGENT_NAME);
    if (!named) {
      await dispatch.createDispatch(input.room, AGENT_NAME, { metadata: input.metadata });
    }
  } catch (err) {
    if (!alreadyThere(err)) throw err;
  }

  const at = new AccessToken(key, secret, {
    identity: input.identity,
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
  at.roomConfig = new RoomConfiguration({
    agents: [agent],
  });
  return { url, token: await at.toJwt() };
}
