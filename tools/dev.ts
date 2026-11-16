import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { createServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import { JsonMessage, MessageType } from "../lib/globcon-web-sdk/src/index";

type JsonValue = null | boolean | number | string | JsonValue[] |
  { [key: string]: JsonValue };
type JsonPair = [number, JsonValue];

const LOCAL_HOST = "127.0.0.1";
const HTTP_PORT = 5173;
const WEBSOCKET_PORT = 8081;
const MAX_REQUEST_BYTES = 1_000_000;
const MAX_BUFFERED_BYTES = 1_000_000;
const MAX_INPUT_CHARACTERS = 1_000_000;
const viewerRoot = fileURLToPath(new URL("../", import.meta.url));

// IOX arrays contain [logical index, value] pairs, not ordinary positional items.
// Return a new branch so an invalid fragment never partially changes live state.
function merge(current: JsonValue, patch: JsonValue): JsonValue {
  if (Array.isArray(current)) {
    if (!Array.isArray(patch)) throw new Error("Expected an indexed array.");
    const result: JsonPair[] = current.map((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== "number" || !Number.isSafeInteger(entry[0])) {
        throw new Error("State contains an invalid indexed array.");
      }
      return [entry[0], entry[1]];
    });
    const seen = new Set<number>();
    for (const entry of patch) {
      if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== "number" || !Number.isSafeInteger(entry[0]) ||
        seen.has(entry[0])) {
        throw new Error("Expected unique [index, value] pairs.");
      }
      const index = entry[0];
      seen.add(index);
      const position = result.findIndex(([key]) => key === index);
      if (position < 0) throw new Error("Unknown array index: " + index);
      result[position] = [index, merge(result[position][1], entry[1])];
    }
    return result;
  }

  if (current !== null && typeof current === "object") {
    if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("Expected an object fragment.");
    }
    const result = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.hasOwn(current, key)) throw new Error("Unknown field: " + key);
      result[key] = merge(current[key], value);
    }
    return result;
  }

  if (typeof patch !== typeof current || (patch === null) !== (current === null) ||
    (typeof patch === "number" && !Number.isFinite(patch))) {
    throw new Error("Value type does not match the current state.");
  }
  return patch;
}

const fixture: JsonValue = JSON.parse(await readFile(
  new URL("../fixtures/ace_iox.json", import.meta.url), "utf8",
));
if (!fixture || typeof fixture !== "object" || Array.isArray(fixture) ||
  !fixture.iox || typeof fixture.iox !== "object" || Array.isArray(fixture.iox) ||
  !Array.isArray(fixture.iox.status)) {
  throw new Error("Fixture must contain iox.status.");
}

// Mutable state lives only in this Node process. The fixture is never rewritten.
// Settings are deliberately excluded from this first read-only integration.
let state: JsonValue = { iox: { status: fixture.iox.status } };

const vite = await createServer({
  root: viewerRoot,
  clearScreen: false,
  server: {
    host: LOCAL_HOST,
    port: HTTP_PORT,
    strictPort: true,
    fs: { allow: [viewerRoot] },
  },
});
const server = new WebSocketServer({
  host: LOCAL_HOST,
  port: WEBSOCKET_PORT,
  maxPayload: MAX_REQUEST_BYTES,
});
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let text = "";
let discardInput = false;
let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  text = "";
  input.close();
  process.stdin.pause();
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  for (const socket of server.clients) socket.terminate();
  await Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())),
    vite.close(),
  ]);
}

server.on("connection", (socket) => {
  console.log("[simulator] Client connected.");
  socket.on("error", (error) => console.error("[simulator]", error.message));
  socket.on("close", () => console.log("[simulator] Client disconnected."));
  socket.on("message", (data, isBinary) => {
    let response: JsonValue | JsonMessage;
    try {
      if (isBinary) throw new Error("Expected a text JSON request.");
      const request: unknown = JSON.parse(data.toString());
      if (!request || typeof request !== "object" || Array.isArray(request)) {
        throw new Error("Expected a request object.");
      }
      if (!("type" in request) || request.type !== MessageType.GET) {
        throw new Error("Only GET is supported.");
      }
      const path = "obj" in request ? request.obj : [];
      if (!Array.isArray(path) || path.some((part: unknown) =>
        !((typeof part === "string" && part.length > 0) ||
          (typeof part === "number" && Number.isSafeInteger(part) && part >= 0)))) {
        throw new Error("obj must be an array of keys and non-negative indices.");
      }
      let value: JsonValue = state;
      for (const part of path) {
        if (Array.isArray(value) && typeof part === "number") {
          const pair = value.find((entry) => Array.isArray(entry) && entry[0] === part);
          if (!Array.isArray(pair) || pair.length !== 2) {
            throw new Error("Unknown array index: " + part);
          }
          value = pair[1];
        } else if (value !== null && typeof value === "object" &&
          !Array.isArray(value) && typeof part === "string" && Object.hasOwn(value, part)) {
          value = value[part];
        } else {
          throw new Error("GET path does not exist.");
        }
      }
      console.log("[simulator] GET", path.length ? path.join("/") : "(all)");
      // Send the requested state directly, without a response envelope.
      response = value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[simulator]", message);
      response = new JsonMessage(MessageType.ERROR, undefined, message);
    }
    if (socket.bufferedAmount >= MAX_BUFFERED_BYTES) {
      socket.terminate();
    } else if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(response));
    }
  });
});

// Paste the original JSON fragment, on one or more lines, then submit a blank line.
input.on("line", (line) => {
  if (line.trim() !== "") {
    if (discardInput) {
      return;
    }
    if (text.length + line.length + 1 > MAX_INPUT_CHARACTERS) {
      text = "";
      discardInput = true;
      console.error("[simulator] Input too large; submit a blank line to start over.");
      return;
    }
    text += line + "\n";
    return;
  }
  if (discardInput) {
    discardInput = false;
    return;
  }
  const source = text;
  text = "";
  if (!source.trim()) {
    return;
  }
  try {
    const fragment: JsonValue = JSON.parse(source);
    state = merge(state, fragment);
    const message = JSON.stringify(fragment);
    for (const socket of server.clients) {
      if (socket.bufferedAmount >= MAX_BUFFERED_BYTES) {
        socket.terminate();
      } else if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
    console.log("[simulator] UPDATE:", JSON.stringify(fragment));
  } catch (error) {
    console.error("[simulator]", error instanceof Error ? error.message : String(error));
  }
});

input.once("close", stop);
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
server.on("error", (error) => {
  console.error("[simulator]", error.message);
  process.exitCode = 1;
  void stop();
});

try {
  await vite.listen();
  if (stopping) {
    await vite.close();
  } else {
    vite.printUrls();
    console.log("[simulator] WebSocket: ws://" + LOCAL_HOST + ":" + WEBSOCKET_PORT);
    console.log("[simulator] Paste an IOX status fragment, then submit a blank line. Ctrl+C exits.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  await stop();
}
