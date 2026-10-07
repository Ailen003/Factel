import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverOnlyModule = "data:text/javascript,export default undefined";

function withExtension(filePath) {
  if (path.extname(filePath)) return filePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs"]) {
    const candidate = `${filePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  return filePath;
}

export async function resolve(specifier, context, nextResolve) {
  // `server-only` is a Next.js build-time boundary marker. The seed runs in a
  // trusted Node process, so represent the side-effect-only import as an empty
  // module instead of requiring Next's bundler-specific resolution.
  if (specifier === "server-only") {
    return { url: serverOnlyModule, shortCircuit: true };
  }

  const mappedSpecifier = specifier.startsWith("@/")
    ? pathToFileURL(path.join(projectRoot, specifier.slice(2))).href
    : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
      ? new URL(specifier, context.parentURL).href
      : specifier;

  try {
    return await nextResolve(mappedSpecifier, context, nextResolve);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || !mappedSpecifier.startsWith("file:")) {
      throw error;
    }
    const originalPath = fileURLToPath(mappedSpecifier);
    const candidate = withExtension(originalPath);
    if (candidate === originalPath || !existsSync(candidate)) throw error;
    return nextResolve(pathToFileURL(candidate).href, context, nextResolve);
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".ts") && !url.endsWith(".tsx")) {
    return nextLoad(url, context, nextLoad);
  }

  const source = await readFile(fileURLToPath(url), "utf8");
  const transformed = typescript.transpileModule(source, {
    compilerOptions: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.ESNext,
      jsx: typescript.JsxEmit.ReactJSX,
      sourceMap: false,
    },
    fileName: fileURLToPath(url),
  });
  return { format: "module", shortCircuit: true, source: transformed.outputText };
}
