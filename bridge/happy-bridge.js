#!/usr/bin/env node

import axios from "axios";
import { io } from "socket.io-client";
import nacl from "tweetnacl";
import crypto from "node:crypto";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const serverUrl =
  process.env.HAPPY_BRIDGE_SERVER_URL || "https://api.cluster-fluster.com";
const tokenEnv = process.env.HAPPY_BRIDGE_TOKEN || "";
const secretEnv = process.env.HAPPY_BRIDGE_SECRET || "";
const publicKeyEnv = process.env.HAPPY_BRIDGE_PUBLIC_KEY || "";
const machineKeyEnv = process.env.HAPPY_BRIDGE_MACHINE_KEY || "";
const enabled = process.env.HAPPY_BRIDGE_ENABLED || "0";

const DATA_DIR =
  process.env.OPENVIBE_DATA_DIR ||
  process.env.HAPPY_BRIDGE_DATA_DIR ||
  process.cwd();
const STATE_PATH = path.join(DATA_DIR, "happy-bridge.json");
const HAPPY_HOME_DIR =
  process.env.HAPPY_HOME_DIR || path.join(os.homedir(), ".happy");
const ACCESS_KEY_PATH = path.join(HAPPY_HOME_DIR, "access.key");

const mask = (value) => {
  if (!value) return "(empty)";
  if (value.length <= 6) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
};

const log = (message, extra) => {
  if (extra) {
    console.log(`[happy-bridge] ${message}`, extra);
  } else {
    console.log(`[happy-bridge] ${message}`);
  }
};

const emitEvent = (payload) => {
  try {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } catch (error) {
    log("failed to emit event", error);
  }
};

const encodeBase64 = (buffer) => Buffer.from(buffer).toString("base64");

const decodeBase64 = (value) =>
  new Uint8Array(Buffer.from(value, "base64"));

const decodeBase64Flexible = (value) => {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
};

const getRandomBytes = (size) => new Uint8Array(crypto.randomBytes(size));

const encryptLegacy = (data, secretKey) => {
  const nonce = getRandomBytes(nacl.secretbox.nonceLength);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = nacl.secretbox(encoded, nonce, secretKey);
  const result = new Uint8Array(nonce.length + encrypted.length);
  result.set(nonce);
  result.set(encrypted, nonce.length);
  return result;
};

const decryptLegacy = (buffer, secretKey) => {
  const nonce = buffer.slice(0, nacl.secretbox.nonceLength);
  const encrypted = buffer.slice(nacl.secretbox.nonceLength);
  const decrypted = nacl.secretbox.open(encrypted, nonce, secretKey);
  if (!decrypted) return null;
  return JSON.parse(new TextDecoder().decode(decrypted));
};

const encryptWithDataKey = (data, dataKey) => {
  const nonce = getRandomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, nonce);
  const plaintext = Buffer.from(JSON.stringify(data));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const bundle = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(nonce),
    encrypted,
    authTag,
  ]);
  return new Uint8Array(bundle);
};

const decryptWithDataKey = (buffer, dataKey) => {
  if (!buffer || buffer.length < 1 || buffer[0] !== 0) {
    return null;
  }
  if (buffer.length < 1 + 12 + 16) {
    return null;
  }
  const nonce = buffer.slice(1, 13);
  const authTag = buffer.slice(buffer.length - 16);
  const ciphertext = buffer.slice(13, buffer.length - 16);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, nonce);
    decipher.setAuthTag(Buffer.from(authTag));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext)),
      decipher.final(),
    ]);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
};

const encryptPayload = (data, variant, key) => {
  if (variant === "dataKey") {
    return encryptWithDataKey(data, key);
  }
  return encryptLegacy(data, key);
};

const decryptPayload = (buffer, variant, key) => {
  if (variant === "dataKey") {
    return decryptWithDataKey(buffer, key);
  }
  return decryptLegacy(buffer, key);
};

const libsodiumEncryptForPublicKey = (data, recipientPublicKey) => {
  const ephemeralKeyPair = nacl.box.keyPair();
  const nonce = getRandomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    data,
    nonce,
    recipientPublicKey,
    ephemeralKeyPair.secretKey,
  );
  const result = new Uint8Array(
    ephemeralKeyPair.publicKey.length + nonce.length + encrypted.length,
  );
  result.set(ephemeralKeyPair.publicKey, 0);
  result.set(nonce, ephemeralKeyPair.publicKey.length);
  result.set(encrypted, ephemeralKeyPair.publicKey.length + nonce.length);
  return result;
};

const wrapDataKey = (dataKey, publicKey) => {
  const encrypted = libsodiumEncryptForPublicKey(dataKey, publicKey);
  const bundle = new Uint8Array(encrypted.length + 1);
  bundle.set([0], 0);
  bundle.set(encrypted, 1);
  return bundle;
};

const extractText = (message) => {
  if (!message || typeof message !== "object") return null;
  if (message.content && message.content.type === "text") {
    return message.content.text ?? null;
  }
  if (
    message.content &&
    message.content.type === "output" &&
    message.content.data
  ) {
    const data = message.content.data;
    if (data.type === "assistant" && data.message?.content) {
      const textItem = data.message.content.find((item) => item.type === "text");
      return textItem?.text ?? null;
    }
    if (data.type === "user" && data.message?.content) {
      if (typeof data.message.content === "string") return data.message.content;
      const textItem = data.message.content.find((item) => item.type === "text");
      return textItem?.text ?? null;
    }
  }
  return null;
};

const toAppRole = (role) => (role === "agent" ? "assistant" : "user");

const state = {
  machineId: null,
  sessions: {},
};

const sessions = new Map();
let credentials = null;
let machineSocket = null;
let heartbeatTimer = null;

const normalizeSessionEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { sessionId: entry, encryptionKey: null, variant: "legacy" };
  }
  if (typeof entry === "object") {
    const sessionId = entry.sessionId || entry.id;
    if (!sessionId) return null;
    return {
      sessionId,
      encryptionKey: entry.encryptionKey ?? null,
      variant: entry.variant || "legacy",
    };
  }
  return null;
};

const loadState = async () => {
  try {
    const content = await fs.readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(content);
    state.machineId = parsed.machineId ?? null;
    const rawSessions = parsed.sessions ?? {};
    const normalized = {};
    for (const [threadId, entry] of Object.entries(rawSessions)) {
      const normalizedEntry = normalizeSessionEntry(entry);
      if (normalizedEntry) {
        normalized[threadId] = normalizedEntry;
      }
    }
    state.sessions = normalized;
  } catch {
    // ignore
  }
};

const saveState = async () => {
  const payload = {
    machineId: state.machineId,
    sessions: state.sessions,
  };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(payload, null, 2));
};

const createMachineId = () => crypto.randomUUID();

const getSessionKeyFromState = (entry, creds) => {
  if (creds.variant !== "dataKey") {
    return creds.secret;
  }
  if (!entry?.encryptionKey) {
    return null;
  }
  return decodeBase64(entry.encryptionKey);
};

const loadCredentialsFromDisk = async () => {
  try {
    const content = await fs.readFile(ACCESS_KEY_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || !parsed.token) {
      return null;
    }
    if (parsed.secret) {
      return {
        token: parsed.token,
        variant: "legacy",
        secret: decodeBase64Flexible(parsed.secret),
        source: "access.key",
      };
    }
    if (parsed.encryption?.publicKey && parsed.encryption?.machineKey) {
      return {
        token: parsed.token,
        variant: "dataKey",
        publicKey: decodeBase64(parsed.encryption.publicKey),
        machineKey: decodeBase64(parsed.encryption.machineKey),
        source: "access.key",
      };
    }
  } catch {
    return null;
  }
  return null;
};

const resolveCredentials = async () => {
  const fileCredentials = await loadCredentialsFromDisk();
  const forceEnv = ["1", "true", "yes"].includes(
    String(process.env.HAPPY_BRIDGE_FORCE_ENV || "").toLowerCase(),
  );

  if (fileCredentials && !forceEnv) {
    return { ...fileCredentials, source: "access.key" };
  }

  if (secretEnv) {
    const token = tokenEnv || fileCredentials?.token;
    if (!token) {
      return null;
    }
    return {
      token,
      variant: "legacy",
      secret: decodeBase64Flexible(secretEnv),
      source: "env",
    };
  }
  if (publicKeyEnv && machineKeyEnv) {
    const token = tokenEnv || fileCredentials?.token;
    if (!token) {
      return null;
    }
    return {
      token,
      variant: "dataKey",
      publicKey: decodeBase64Flexible(publicKeyEnv),
      machineKey: decodeBase64Flexible(machineKeyEnv),
      source: "env",
    };
  }
  if (fileCredentials) {
    return { ...fileCredentials, source: "access.key" };
  }
  return null;
};

const getMachineMetadata = () => ({
  host: os.hostname(),
  platform: os.platform(),
  happyCliVersion: "openvibe-bridge",
  homeDir: os.homedir(),
  happyHomeDir: DATA_DIR,
  happyLibDir: DATA_DIR,
});

const getDaemonState = () => ({
  status: "running",
  pid: process.pid,
  httpPort: 0,
  startedAt: Date.now(),
});

const ensureMachine = async (creds) => {
  if (!state.machineId) {
    state.machineId = createMachineId();
    await saveState();
  }
  const metadata = getMachineMetadata();
  const daemonState = getDaemonState();
  const encryptionVariant = creds.variant;
  const encryptionKey =
    encryptionVariant === "dataKey" ? creds.machineKey : creds.secret;
  const dataEncryptionKey =
    encryptionVariant === "dataKey"
      ? encodeBase64(wrapDataKey(creds.machineKey, creds.publicKey))
      : null;
  const payload = {
    id: state.machineId,
    metadata: encodeBase64(encryptPayload(metadata, encryptionVariant, encryptionKey)),
    daemonState: encodeBase64(
      encryptPayload(daemonState, encryptionVariant, encryptionKey),
    ),
    dataEncryptionKey,
  };
  const response = await axios.post(`${serverUrl}/v1/machines`, payload, {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  return response.data.machine;
};

const ensureMachineSocket = (machineId, creds) => {
  if (machineSocket) {
    return;
  }
  machineSocket = io(serverUrl, {
    auth: {
      token: creds.token,
      clientType: "machine-scoped",
      machineId,
    },
    path: "/v1/updates",
    transports: ["websocket"],
  });
  machineSocket.on("connect", () => {
    emitEvent({ type: "status", connected: true });
  });
  machineSocket.on("connect_error", (error) => {
    emitEvent({ type: "status", connected: false, reason: error?.message });
  });
  machineSocket.on("disconnect", (reason) => {
    emitEvent({ type: "status", connected: false, reason });
  });
  heartbeatTimer = setInterval(() => {
    machineSocket?.emit("machine-alive", {
      machineId,
      time: Date.now(),
    });
  }, 30_000);
};

const getSessionMetadata = (thread, machineId) => ({
  path: thread.workspacePath,
  host: os.hostname(),
  homeDir: os.homedir(),
  happyHomeDir: DATA_DIR,
  version: "openvibe-bridge",
  name: thread.threadName ?? thread.threadId,
  os: os.platform(),
  machineId,
  startedFromDaemon: true,
  startedBy: "daemon",
  flavor: "codex",
  summary: {
    text: "",
    updatedAt: Date.now(),
  },
});

const ensureSession = async (thread, creds) => {
  const existing = state.sessions[thread.threadId];
  if (existing?.sessionId) {
    if (creds.variant !== "dataKey" || existing.encryptionKey) {
      return existing.sessionId;
    }
  }
  const metadata = getSessionMetadata(thread, state.machineId);
  const encryptionVariant = creds.variant;
  let encryptionKey = creds.secret;
  let dataEncryptionKey = null;
  if (encryptionVariant === "dataKey") {
    encryptionKey = getRandomBytes(32);
    dataEncryptionKey = encodeBase64(wrapDataKey(encryptionKey, creds.publicKey));
  }
  const response = await axios.post(
    `${serverUrl}/v1/sessions`,
    {
      tag: `openvibe:${thread.threadId}`,
      metadata: encodeBase64(
        encryptPayload(metadata, encryptionVariant, encryptionKey),
      ),
      agentState: null,
      dataEncryptionKey,
    },
    {
      headers: { Authorization: `Bearer ${creds.token}` },
    },
  );
  const sessionId = response.data.session.id;
  state.sessions[thread.threadId] = {
    sessionId,
    encryptionKey:
      encryptionVariant === "dataKey" ? encodeBase64(encryptionKey) : null,
    variant: encryptionVariant,
  };
  await saveState();
  emitEvent({ type: "session-mapped", threadId: thread.threadId, sessionId });
  attachSessionSocket(thread.threadId, sessionId, encryptionKey, encryptionVariant, creds);
  return sessionId;
};

const attachSessionSocket = (threadId, sessionId, sessionKey, variant, creds) => {
  if (sessions.has(threadId)) {
    return;
  }
  const socket = io(serverUrl, {
    auth: {
      token: creds.token,
      clientType: "session-scoped",
      sessionId,
    },
    path: "/v1/updates",
    transports: ["websocket"],
  });
  socket.on("update", (data) => {
    if (data?.body?.t !== "new-message") {
      return;
    }
    const encrypted = data.body?.message?.content;
    if (!encrypted || encrypted.t !== "encrypted") {
      return;
    }
    const decrypted = decryptPayload(
      new Uint8Array(Buffer.from(encrypted.c, "base64")),
      variant,
      sessionKey,
    );
    if (!decrypted) return;
    if (decrypted?.meta?.sentFrom === "openvibe") {
      return;
    }
    const text = extractText(decrypted);
    if (!text) {
      return;
    }
    emitEvent({
      type: "remote-message",
      threadId,
      role: toAppRole(decrypted.role),
      content: text,
      createdAt: Date.now(),
    });
  });
  socket.on("connect_error", (error) => {
    emitEvent({ type: "status", connected: false, reason: error?.message });
  });
  sessions.set(threadId, { socket, sessionId, sessionKey, variant });
};

const sendSessionMessage = async (thread, role, content, creds) => {
  const sessionId = await ensureSession(thread, creds);
  const session = sessions.get(thread.threadId);
  const stateEntry = state.sessions[thread.threadId];
  const sessionKey =
    session?.sessionKey ?? getSessionKeyFromState(stateEntry, creds);
  const variant = session?.variant ?? stateEntry?.variant ?? creds.variant;
  if (!sessionKey) {
    log("missing session key, cannot send message");
    return;
  }
  if (!session) {
    attachSessionSocket(thread.threadId, sessionId, sessionKey, variant, creds);
  }
  const message = {
    role: role === "assistant" ? "agent" : "user",
    content: {
      type: "text",
      text: content,
    },
    meta: {
      sentFrom: "openvibe",
    },
  };
  const encrypted = encodeBase64(encryptPayload(message, variant, sessionKey));
  sessions
    .get(thread.threadId)
    ?.socket?.emit("message", { sid: sessionId, message: encrypted });
};

const start = async () => {
  log("starting");
  const isEnabled = ["1", "true", "yes"].includes(String(enabled).toLowerCase());
  log(`enabled=${enabled}`);
  log(`server=${serverUrl}`);
  if (!isEnabled) {
    log("disabled, exiting");
    return;
  }

  const resolved = await resolveCredentials();
  if (!resolved) {
    log("missing credentials, staying idle until configured");
    return;
  }
  credentials = resolved;
  log(`token=${mask(credentials.token)}`);
  log(`variant=${credentials.variant}`);
  log(`credentials=${credentials.source || "env"}`);

  await loadState();

  try {
    const machine = await ensureMachine(credentials);
    ensureMachineSocket(machine.id, credentials);
  } catch (error) {
    emitEvent({
      type: "status",
      connected: false,
      reason: error?.message ?? "machine registration failed",
    });
  }

  for (const [threadId, entry] of Object.entries(state.sessions)) {
    const sessionKey = getSessionKeyFromState(entry, credentials);
    if (credentials.variant === "dataKey" && !sessionKey) {
      log(`missing session key for ${threadId}, skipping attach`);
      continue;
    }
    const variant = entry.variant || credentials.variant;
    attachSessionSocket(threadId, entry.sessionId, sessionKey, variant, credentials);
  }

  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      return;
    }
    if (payload.type === "thread-message") {
      const thread = {
        threadId: payload.threadId,
        workspacePath: payload.workspacePath,
        threadName: payload.threadName ?? null,
      };
      await sendSessionMessage(thread, payload.role, payload.content, credentials);
    } else if (payload.type === "thread-open") {
      const thread = {
        threadId: payload.threadId,
        workspacePath: payload.workspacePath,
        threadName: payload.threadName ?? null,
      };
      await ensureSession(thread, credentials);
    } else if (payload.type === "thread-archive") {
      delete state.sessions[payload.threadId];
      await saveState();
    }
  });

  const shutdown = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    machineSocket?.disconnect();
    for (const session of sessions.values()) {
      session.socket.disconnect();
    }
    log("stopping");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((error) => {
  emitEvent({ type: "status", connected: false, reason: error?.message });
  log("fatal error", error);
  process.exit(1);
});
