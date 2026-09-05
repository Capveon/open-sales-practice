export type MicHandle = {
  stream: MediaStream;
  /** Cut the mic while the buyer is in the earpiece so we cannot hear ourselves. */
  setEarpiece: (playing: boolean) => void;
  stop: () => void;
};

export async function openMic(): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });
  return {
    stream,
    setEarpiece(playing: boolean) {
      for (const track of stream.getAudioTracks()) track.enabled = !playing;
    },
    stop() {
      for (const track of stream.getTracks()) track.stop();
    },
  };
}

function pickRecorderMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

function rmsFromTimeDomain(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = ((data[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}

/**
 * Energy VAD on the live mic stream. Records one utterance at a time.
 * Caller must not invoke this while the buyer is speaking (mic tracks disabled).
 */
export function startUtteranceLoop(opts: {
  stream: MediaStream;
  context: AudioContext;
  shouldListen: () => boolean;
  onUtterance: (blob: Blob) => void;
}): () => void {
  const { stream, context, shouldListen, onUtterance } = opts;
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const time = new Uint8Array(analyser.fftSize);
  const mime = pickRecorderMime();
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let startedAt = 0;
  let lastLoud = 0;
  let raf = 0;
  let dead = false;
  let holding = false;

  const startRec = () => {
    if (recorder || dead || holding || !shouldListen()) return;
    chunks = [];
    startedAt = Date.now();
    lastLoud = startedAt;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    recorder.onerror = () => {
      recorder = null;
      chunks = [];
    };
    recorder.start();
  };

  const finishRec = (send: boolean) => {
    const rec = recorder;
    if (!rec) return;
    recorder = null;
    const duration = Date.now() - startedAt;
    const deliver = send;
    if (send) holding = true;
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      chunks = [];
      holding = false;
      if (deliver && !dead && duration >= 420 && blob.size > 1200) onUtterance(blob);
    };
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      chunks = [];
    }
  };

  const tick = () => {
    if (dead) return;
    raf = window.requestAnimationFrame(tick);
    analyser.getByteTimeDomainData(time);
    const rms = rmsFromTimeDomain(time);
    const now = Date.now();
    if (!shouldListen()) {
      holding = false;
      if (recorder) finishRec(false);
      return;
    }
    const loud = rms > 0.055;
    if (!recorder && loud) startRec();
    if (recorder) {
      if (loud) lastLoud = now;
      if (now - lastLoud > 850) finishRec(true);
      else if (now - startedAt > 14000) finishRec(true);
    }
  };
  raf = window.requestAnimationFrame(tick);

  return () => {
    dead = true;
    window.cancelAnimationFrame(raf);
    finishRec(false);
    try {
      source.disconnect();
      analyser.disconnect();
    } catch {
      /* ignore */
    }
  };
}

export { similarUtterance } from "./text";
