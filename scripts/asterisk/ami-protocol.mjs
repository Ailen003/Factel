/**
 * Small helpers for the line-oriented Asterisk Manager Interface protocol.
 * AMI messages are separated by a blank line and contain `Key: Value` lines.
 */

export function parseAmiMessage(rawMessage) {
  const headers = {};

  for (const line of rawMessage.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trimStart();
    if (key) headers[key] = value;
  }

  return headers;
}

export function encodeAmiAction(headers) {
  return `${Object.entries(headers)
    .map(([key, value]) => `${key}: ${String(value).replace(/[\r\n]/g, " ")}`)
    .join("\r\n")}\r\n\r\n`;
}

export function takeAmiMessages(buffer) {
  const messages = [];
  let remaining = buffer;

  while (true) {
    const separator = remaining.search(/\r?\n\r?\n/);
    if (separator === -1) break;

    const separatorMatch = remaining.match(/\r?\n\r?\n/);
    const separatorLength = separatorMatch?.[0].length ?? 2;
    messages.push(parseAmiMessage(remaining.slice(0, separator)));
    remaining = remaining.slice(separator + separatorLength);
  }

  return { messages, remaining };
}
