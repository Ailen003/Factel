// Only this integration process replaces the framework session boundary. All
// database authorization, Prisma transactions, policies and writes stay real.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export { load } from "./seed-ts-loader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sessionModule = `export async function resolveCurrentWorkspace() {
  const id = process.env.CONVERSATION_VERIFY_ACTOR || 'integration-user';
  return {session: {session: {id: id + '-session'}, user: {id, role: 'trial_user'}},
    workspace: {id: id + '-workspace'}};
}`;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default undefined", shortCircuit: true };
  if (specifier === "@/lib/auth/session") return { url: `data:text/javascript,${encodeURIComponent(sessionModule)}`, shortCircuit: true };
  const mapped = specifier.startsWith("@/") ? pathToFileURL(path.join(root, specifier.slice(2))).href
    : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? new URL(specifier, context.parentURL).href : specifier;
  if (mapped.startsWith("file:")) {
    const filename = fileURLToPath(mapped);
    for (const extension of ["", ".ts", ".tsx", ".js", ".mjs"]) {
      if (existsSync(filename + extension)) return nextResolve(pathToFileURL(filename + extension).href, context);
    }
  }
  return nextResolve(mapped, context);
}
