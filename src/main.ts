import {
  GlobconClient,
  JsonMessage,
  MessageType,
  type ConnectionState,
} from "../lib/globcon-web-sdk/src/index";
import type { IoxLoop } from "./IoxModel";

const URL_DEFAULT_WEBSOCKET = "ws://127.0.0.1:8081";
const NUM_IOX_DEVICE = 16;
const NUM_IOX_PSU = 2;
const NUM_IOX_SLOT = 4;
const NUM_IOX_MADI = 2;
const NUM_SLOT_LOCK = 4;
const NUM_SLOT_SYNC = 4;

const ioxLoop: IoxLoop = {
  devices: Array.from({ length: NUM_IOX_DEVICE }, () => ({
    serial: undefined,
    temperature: undefined,
    psu: new Array<boolean | undefined>(NUM_IOX_PSU).fill(undefined),
    slot: Array.from({ length: NUM_IOX_SLOT }, () => ({
      slot_id: undefined,
      module_type: undefined,
      lock: new Array<boolean | undefined>(NUM_SLOT_LOCK).fill(undefined),
      sync: new Array<boolean | undefined>(NUM_SLOT_SYNC).fill(undefined),
    })),
    madi: Array.from({ length: NUM_IOX_MADI }, () => ({
      host_lock: undefined,
      lock: undefined,
      sync: undefined,
    })),
  })),
};

console.log("[iox] Model initialized:", ioxLoop.devices.length, "device positions.");

function onState(state: ConnectionState): void {
  console.log("[globcon] Connection:", state);
  if (state !== "open") {
    return;
  }
  try {
    client.send(new JsonMessage(MessageType.GET));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[globcon] GET:", message);
  }
}

function onMessage(message: unknown): void {
  parseIoxMessage(message);
}

function parseIoxMessage(message: unknown): void {
  // todo parse json into data
  console.log("[iox] Received:", JSON.stringify(message));
}

function onError(error: Error): void {
  console.error("[globcon]", error.message);
}

let websocketUrl: URL;
if (import.meta.env.DEV) {
  // Sviluppo: simulatore locale, senza ID dispositivo.
  websocketUrl = new URL(
      import.meta.env.VITE_GLOBCON_WS_URL ?? URL_DEFAULT_WEBSOCKET,
  );
} else {
  const pageUrl = new URL(window.location.href);
  const id = pageUrl.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    throw new Error("ID dispositivo mancante o non valido nell'URL del viewer.");
  }
  websocketUrl = new URL(`/iox/${id}`, pageUrl);
  websocketUrl.protocol = pageUrl.protocol === "https:" ? "wss:" : "ws:";
}

const client = new GlobconClient({
  url: websocketUrl.href,
  onState,
  onMessage,
  onError,
});

client.connect();

if (import.meta.hot) {
  import.meta.hot.accept();
  // Before Vite replaces this module, release the old socket, timers and callbacks.
  // This prevents duplicate connections and retained resources on save.
  import.meta.hot.dispose(() => {
    client.dispose();
  });
}
