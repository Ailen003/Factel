// Production transactions, publication, failure settlement and authorization remain real.
// Only session resolution and external framework/provider boundaries are isolated.
import { resolve as baseResolve } from "./conversation-creation-integration-loader.mjs";
export { load } from "./seed-ts-loader.mjs";

const forbidden = (name) => `export function ${name}() { throw new Error('External integration call forbidden'); }`;
const replacements = new Map([
  ["@/lib/workflow/conversation-processing.dispatcher", "export async function dispatchConversationProcessingOutboxEvent() { return false; }"],
  ["@/lib/storage/storage.service", forbidden("createSignedDownloadUrl")],
  ["@/lib/speech/assemblyai.provider", forbidden("createProductionSpeechProvider")],
  ["@/lib/ai/conversation-extraction", forbidden("extractConversation")],
  ["workflow", "export class FatalError extends Error {} export class RetryableError extends Error {} " + forbidden("sleep")],
]);
export async function resolve(specifier, context, nextResolve) {
  const source = replacements.get(specifier);
  if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  return baseResolve(specifier, context, nextResolve);
}
