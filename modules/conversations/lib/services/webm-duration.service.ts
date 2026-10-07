import "server-only";

const SEGMENT_ID = 0x18538067;
const INFO_ID = 0x1549a966;
const TIMECODE_SCALE_ID = 0x2ad7b1;
const TRACKS_ID = 0x1654ae6b;
const TRACK_ENTRY_ID = 0xae;
const TRACK_NUMBER_ID = 0xd7;
const TRACK_TYPE_ID = 0x83;
const DEFAULT_DURATION_ID = 0x23e383;
const AUDIO_TRACK_TYPE = 2;
const CLUSTER_ID = 0x1f43b675;
const CLUSTER_TIMECODE_ID = 0xe7;
const SIMPLE_BLOCK_ID = 0xa3;
const BLOCK_GROUP_ID = 0xa0;
const BLOCK_ID = 0xa1;
const BLOCK_DURATION_ID = 0x9b;
const DEFAULT_TIMECODE_SCALE_NS = 1_000_000;

interface EbmlElement {
  id: number;
  dataStart: number;
  dataEnd: number;
  nextOffset: number;
}

interface VintValue {
  length: number;
  value: number;
}

function vintLength(firstByte: number, maximumLength: number): number | null {
  for (let length = 1, marker = 0x80; length <= maximumLength; length++, marker >>= 1) {
    if ((firstByte & marker) !== 0) return length;
  }
  return null;
}

function readElementId(bytes: Uint8Array, offset: number, limit: number): VintValue | null {
  if (offset >= limit) return null;
  const length = vintLength(bytes[offset], 4);
  if (!length || offset + length > limit) return null;
  let value = 0;
  for (let index = 0; index < length; index++) value = value * 256 + bytes[offset + index];
  return { length, value };
}

function readVintValue(bytes: Uint8Array, offset: number, limit: number, maximumLength = 8): VintValue | null {
  if (offset >= limit) return null;
  const length = vintLength(bytes[offset], maximumLength);
  if (!length || offset + length > limit) return null;
  const markerMask = 0x80 >> (length - 1);
  let value = BigInt(bytes[offset] & (markerMask - 1));
  for (let index = 1; index < length; index++) value = value * BigInt(256) + BigInt(bytes[offset + index]);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { length, value: Number(value) };
}

function readElement(bytes: Uint8Array, offset: number, limit: number): EbmlElement | null {
  const id = readElementId(bytes, offset, limit);
  if (!id) return null;
  const sizeOffset = offset + id.length;
  if (sizeOffset >= limit) return null;
  const sizeLength = vintLength(bytes[sizeOffset], 8);
  if (!sizeLength || sizeOffset + sizeLength > limit) return null;
  const markerMask = 0x80 >> (sizeLength - 1);
  let size = BigInt(bytes[sizeOffset] & (markerMask - 1));
  for (let index = 1; index < sizeLength; index++) size = size * BigInt(256) + BigInt(bytes[sizeOffset + index]);
  const unknownSize = size === (BigInt(1) << BigInt(7 * sizeLength)) - BigInt(1);
  const dataStart = sizeOffset + sizeLength;
  if (unknownSize) return { id: id.value, dataStart, dataEnd: limit, nextOffset: limit };
  if (size > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const dataEnd = dataStart + Number(size);
  if (dataEnd > limit) return null;
  return { id: id.value, dataStart, dataEnd, nextOffset: dataEnd };
}

function readUnsigned(bytes: Uint8Array, start: number, end: number): number | null {
  if (end <= start || end - start > 8) return null;
  let value = BigInt(0);
  for (let offset = start; offset < end; offset++) value = value * BigInt(256) + BigInt(bytes[offset]);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

function elementsWithin(bytes: Uint8Array, start: number, end: number): EbmlElement[] {
  const elements: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    const element = readElement(bytes, offset, end);
    if (!element || element.nextOffset <= offset) break;
    elements.push(element);
    offset = element.nextOffset;
  }
  return elements;
}

function readBlockTimestamp(bytes: Uint8Array, element: EbmlElement): { track: number; relativeTimecode: number } | null {
  const track = readVintValue(bytes, element.dataStart, element.dataEnd);
  if (!track || track.value < 1) return null;
  const timecodeOffset = element.dataStart + track.length;
  if (timecodeOffset + 2 > element.dataEnd) return null;
  const unsigned = bytes[timecodeOffset] * 256 + bytes[timecodeOffset + 1];
  const relativeTimecode = unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned;
  return { track: track.value, relativeTimecode };
}

function readAudioTracks(bytes: Uint8Array, tracks: EbmlElement): Map<number, number | null> {
  const audioTracks = new Map<number, number | null>();
  for (const entry of elementsWithin(bytes, tracks.dataStart, tracks.dataEnd)) {
    if (entry.id !== TRACK_ENTRY_ID) continue;
    let trackNumber: number | null = null;
    let trackType: number | null = null;
    let defaultDurationNs: number | null = null;
    for (const field of elementsWithin(bytes, entry.dataStart, entry.dataEnd)) {
      if (field.id === TRACK_NUMBER_ID) trackNumber = readUnsigned(bytes, field.dataStart, field.dataEnd);
      if (field.id === TRACK_TYPE_ID) trackType = readUnsigned(bytes, field.dataStart, field.dataEnd);
      if (field.id === DEFAULT_DURATION_ID) defaultDurationNs = readUnsigned(bytes, field.dataStart, field.dataEnd);
    }
    if (trackType === AUDIO_TRACK_TYPE && trackNumber != null) audioTracks.set(trackNumber, defaultDurationNs);
  }
  return audioTracks;
}

function blockGroupDetails(bytes: Uint8Array, group: EbmlElement) {
  let block: { track: number; relativeTimecode: number } | null = null;
  let durationTicks: number | null = null;
  for (const child of elementsWithin(bytes, group.dataStart, group.dataEnd)) {
    if (child.id === BLOCK_ID) block = readBlockTimestamp(bytes, child);
    if (child.id === BLOCK_DURATION_ID) durationTicks = readUnsigned(bytes, child.dataStart, child.dataEnd);
  }
  return block ? { ...block, durationTicks } : null;
}

/**
 * Derives duration from WebM timestamps when MediaRecorder omits Info.Duration.
 * The input is already bounded and independently recognized as audio WebM.
 */
export function readWebmDurationMs(bytes: Uint8Array): number | null {
  const roots = elementsWithin(bytes, 0, bytes.length);
  const segment = roots.find((element) => element.id === SEGMENT_ID);
  if (!segment) return null;

  const segmentChildren = elementsWithin(bytes, segment.dataStart, segment.dataEnd);
  let timecodeScaleNs = DEFAULT_TIMECODE_SCALE_NS;
  const clusters: EbmlElement[] = [];
  let audioTracks = new Map<number, number | null>();

  for (const child of segmentChildren) {
    if (child.id === INFO_ID) {
      const scale = elementsWithin(bytes, child.dataStart, child.dataEnd)
        .find((field) => field.id === TIMECODE_SCALE_ID);
      const value = scale ? readUnsigned(bytes, scale.dataStart, scale.dataEnd) : null;
      if (value && value > 0) timecodeScaleNs = value;
    } else if (child.id === TRACKS_ID) {
      audioTracks = readAudioTracks(bytes, child);
    } else if (child.id === CLUSTER_ID) {
      clusters.push(child);
    }
  }

  let maximumEndNs = 0;
  let foundAudioBlock = false;
  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
    const cluster = clusters[clusterIndex];
    const children = elementsWithin(bytes, cluster.dataStart, cluster.dataEnd);
    const timecodeElement = children.find((element) => element.id === CLUSTER_TIMECODE_ID);
    const clusterTimecode = timecodeElement
      ? readUnsigned(bytes, timecodeElement.dataStart, timecodeElement.dataEnd)
      : null;
    if (clusterTimecode == null) continue;

    for (const child of children) {
      // Streaming WebM may use an unknown Cluster size. In that case the next
      // sibling Cluster appears within the current element's bounded view.
      if (child.id === CLUSTER_ID) {
        clusters.push(child);
        continue;
      }
      const details = child.id === SIMPLE_BLOCK_ID
        ? { ...readBlockTimestamp(bytes, child), durationTicks: null }
        : child.id === BLOCK_GROUP_ID
          ? blockGroupDetails(bytes, child)
          : null;
      if (!details || details.track == null || details.relativeTimecode == null) continue;
      if (audioTracks.size > 0 && !audioTracks.has(details.track)) continue;
      const timestampTicks = clusterTimecode + details.relativeTimecode;
      if (timestampTicks < 0) continue;
      const declaredDurationNs = audioTracks.get(details.track) ?? null;
      const blockDurationNs = details.durationTicks != null
        ? details.durationTicks * timecodeScaleNs
        : declaredDurationNs ?? 0;
      maximumEndNs = Math.max(maximumEndNs, timestampTicks * timecodeScaleNs + blockDurationNs);
      foundAudioBlock = true;
    }
  }

  if (!foundAudioBlock) return null;
  const durationMs = Math.max(1, Math.ceil(maximumEndNs / 1_000_000));
  return Number.isSafeInteger(durationMs) ? durationMs : null;
}
