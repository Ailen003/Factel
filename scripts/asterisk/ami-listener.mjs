import net from "node:net";

import { encodeAmiAction, takeAmiMessages } from "./ami-protocol.mjs";

const config = {
  host: process.env.AMI_HOST,
  port: Number(process.env.AMI_PORT ?? "5038"),
  username: process.env.AMI_USERNAME,
  secret: process.env.AMI_SECRET ?? process.env.AMI_PASSWORD,
  reconnectMaxMs: Number(process.env.AMI_RECONNECT_MAX_MS ?? "30000"),
  connectTimeoutMs: Number(process.env.AMI_CONNECT_TIMEOUT_MS ?? "10000"),
  listIntervalMs: Number(process.env.AMI_LIST_INTERVAL_MS ?? "0"),
};

if (!config.host || !config.username || !config.secret) {
  console.error(
    "Faltan AMI_HOST, AMI_USERNAME o AMI_SECRET (también se acepta AMI_PASSWORD).",
  );
  process.exit(1);
}

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  console.error("AMI_PORT debe ser un puerto TCP válido.");
  process.exit(1);
}

let stopping = false;
let socket;
let listInterval;
let actionSequence = 0;
let reconnectAttempt = 0;
const reportedLifecycleEvents = new Set();

function log(message, details) {
  const timestamp = new Date().toISOString();
  if (details === undefined) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }

  console.log(`[${timestamp}] ${message}`, details);
}

function nextActionId(prefix) {
  actionSequence += 1;
  return `factel-${prefix}-${Date.now()}-${actionSequence}`;
}

function sendAction(headers) {
  if (!socket || socket.destroyed) return;
  socket.write(encodeAmiAction(headers));
}

function reportLifecycleEvent(message) {
  const uniqueId = message.Uniqueid ?? message.Linkedid ?? "sin-uniqueid";
  let type;
  let summary;

  switch (message.Event) {
    case "Newchannel":
      type = "inicio";
      summary = `INICIO llamada ${uniqueId}: ${message.Channel ?? "canal desconocido"}`;
      break;
    case "DialBegin":
      type = "marcado";
      summary = `MARCADO ${uniqueId}: ${message.Channel ?? ""} -> ${message.DestChannel ?? message.Exten ?? "destino desconocido"}`;
      break;
    case "BridgeEnter":
      type = "contestada";
      summary = `CONTESTADA ${uniqueId}: ${message.Channel ?? "canal desconocido"}`;
      break;
    case "DialEnd":
      if (message.DialStatus !== "ANSWER") return;
      type = "contestada";
      summary = `CONTESTADA ${uniqueId}: DialStatus=ANSWER`;
      break;
    case "Hangup":
      type = "fin";
      summary = `FIN llamada ${uniqueId}: causa=${message.Cause ?? "desconocida"}`;
      break;
    default:
      return;
  }

  const eventKey = `${uniqueId}:${type}`;
  if (reportedLifecycleEvents.has(eventKey)) return;
  reportedLifecycleEvents.add(eventKey);
  log(summary);

  if (type === "fin") {
    for (const key of reportedLifecycleEvents) {
      if (key.startsWith(`${uniqueId}:`)) reportedLifecycleEvents.delete(key);
    }
  }
}

function handleMessage(message) {
  if (!message.Event && message.Response) {
    log(`AMI respuesta: ${message.Response}${message.Message ? ` - ${message.Message}` : ""}`);

    if (message.ActionID?.startsWith("factel-channels-")) {
      log("Acción CoreShowChannels enviada correctamente.");
    }

    return;
  }

  if (!message.Event) return;

  if (message.Event === "CoreShowChannelsComplete") {
    log(`Canales activos listados: ${message.ListItems ?? "0"}`);
  }

  reportLifecycleEvent(message);
  log(`AMI evento ${message.Event}`, message);
}

function requestActiveChannels() {
  const actionId = nextActionId("channels");
  sendAction({ Action: "CoreShowChannels", ActionID: actionId });
  log(`Solicitando canales activos (${actionId}).`);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function runSession() {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let authenticated = false;
    let settled = false;
    let connectTimer;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearInterval(listInterval);
      listInterval = undefined;
      if (error) reject(error);
      else resolve();
    };

    socket = net.createConnection({ host: config.host, port: config.port });
    connectTimer = setTimeout(() => {
      socket.destroy(new Error(`timeout conectando a ${config.host}:${config.port}`));
    }, config.connectTimeoutMs);

    socket.setEncoding("utf8");

    socket.on("connect", () => {
      clearTimeout(connectTimer);
      log(`TCP conectado a ${config.host}:${config.port}; enviando login AMI.`);
      sendAction({
        Action: "Login",
        ActionID: nextActionId("login"),
        Username: config.username,
        Secret: config.secret,
        Events: "on",
      });
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      const result = takeAmiMessages(buffer);
      buffer = result.remaining;

      for (const message of result.messages) {
        if (!authenticated && message.Response) {
          if (message.Response !== "Success") {
            finish(new Error(`login AMI rechazado: ${message.Message ?? message.Response}`));
            socket.destroy();
            return;
          }

          authenticated = true;
          reconnectAttempt = 0;
          log("Login AMI correcto. Escuchando eventos en tiempo real.");
          requestActiveChannels();

          if (config.listIntervalMs > 0) {
            listInterval = setInterval(requestActiveChannels, config.listIntervalMs);
          }
        }

        handleMessage(message);
      }
    });

    socket.on("error", (error) => {
      if (!settled) finish(error);
      else log(`Error AMI: ${error.message}`);
    });

    socket.on("close", () => {
      log("Conexión AMI cerrada.");
      finish();
    });
  });
}

async function main() {
  log(`Iniciando listener AMI para ${config.host}:${config.port}.`);

  while (!stopping) {
    try {
      await runSession();
    } catch (error) {
      log(`Conexión AMI fallida: ${error.message}`);
    }

    if (stopping) break;

    const delay = Math.min(1000 * 2 ** reconnectAttempt, config.reconnectMaxMs);
    reconnectAttempt += 1;
    log(`Reintentando conexión AMI en ${delay} ms.`);
    await wait(delay);
  }
}

function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(listInterval);
  log("Cerrando listener AMI.");
  socket?.end();
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await main();
