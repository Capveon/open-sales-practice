/**
 * One AudioContext for the whole SPA so the Start-call click keeps paying for autoplay
 * after we route to the handset. Playback is decode → BufferSource, with a hidden
 * <audio> element as fallback. Intentional stops never surface as "failed to play".
 */

let ctx: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let generation = 0;
let settle: ((cancelled: boolean) => void) | null = null;

function cancelledError(): Error {
  const err = new Error("Playback cancelled");
  err.name = "AbortError";
  return err;
}

export function isPlaybackCancelled(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function getCtx(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx || ctx.state === "closed") {
    ctx = new AC();
  }
  return ctx;
}

export function getPlaybackContext(): AudioContext {
  return getCtx();
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function finishPending(cancelled: boolean) {
  const done = settle;
  settle = null;
  done?.(cancelled);
}

export function attachPlayer(node: HTMLAudioElement | null) {
  element = node;
  if (element) {
    element.setAttribute("playsinline", "true");
    element.preload = "auto";
  }
}

export async function unlockPlayback(): Promise<void> {
  const ac = getCtx();
  if (ac.state === "suspended") await ac.resume();
  const buf = ac.createBuffer(1, 1, 22050);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start(0);
  if (element) {
    element.muted = true;
    try {
      await element.play();
    } catch {
      /* empty src — fine */
    }
    element.pause();
    element.muted = false;
  }
}

export function stopPlayback(): void {
  generation += 1;
  if (sourceNode) {
    try {
      sourceNode.onended = null;
      sourceNode.stop();
    } catch {
      /* already stopped */
    }
    try {
      sourceNode.disconnect();
    } catch {
      /* ignore */
    }
    sourceNode = null;
  }
  if (element) {
    element.onended = null;
    element.onerror = null;
    element.pause();
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  finishPending(true);
}

function playBuffer(buffer: AudioBuffer, myGen: number): Promise<void> {
  const ac = getCtx();
  return new Promise((resolve, reject) => {
    if (myGen !== generation) {
      reject(cancelledError());
      return;
    }
    const src = ac.createBufferSource();
    sourceNode = src;
    src.buffer = buffer;
    src.connect(ac.destination);
    settle = (cancelled) => {
      if (cancelled) reject(cancelledError());
      else resolve();
    };
    src.onended = () => {
      if (sourceNode === src) sourceNode = null;
      if (myGen === generation) finishPending(false);
    };
    try {
      src.start(0);
    } catch (err) {
      sourceNode = null;
      settle = null;
      reject(err);
    }
  });
}

function playElement(bytes: Uint8Array, mime: string, myGen: number): Promise<void> {
  const el = element;
  if (!el) return Promise.reject(new Error("No speaker attached."));
  return new Promise((resolve, reject) => {
    if (myGen !== generation) {
      reject(cancelledError());
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(new Blob([copyToArrayBuffer(bytes)], { type: mime || "audio/mpeg" }));
    settle = (cancelled) => {
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
      if (cancelled) reject(cancelledError());
      else resolve();
    };
    const onEnd = () => {
      if (myGen === generation) finishPending(false);
    };
    const onErr = () => {
      if (myGen !== generation) return;
      settle = null;
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
      reject(new Error("Buyer audio failed to play."));
    };
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onErr);
    el.src = objectUrl;
    el.currentTime = 0;
    void el.play().catch((err) => {
      if (myGen !== generation) return;
      settle = null;
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
      reject(err instanceof Error ? err : new Error("Buyer audio failed to play."));
    });
  });
}

export async function playMpeg(base64: string, mime = "audio/mpeg"): Promise<void> {
  stopPlayback();
  const myGen = generation;
  const bytes = base64ToBytes(base64);
  const ac = getCtx();
  if (ac.state === "suspended") await ac.resume();
  if (myGen !== generation) throw cancelledError();

  try {
    const buffer = await ac.decodeAudioData(copyToArrayBuffer(bytes));
    if (myGen !== generation) throw cancelledError();
    await playBuffer(buffer, myGen);
    return;
  } catch (err) {
    if (isPlaybackCancelled(err)) throw err;
    /* Safari sometimes refuses mp3 decode — fall through to <audio>. */
  }
  if (myGen !== generation) throw cancelledError();
  await playElement(bytes, mime, myGen);
}
