import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const TS_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx"];

/**
 * Resolve ESM specifiers ending in .js to their TypeScript source file
 * when only the .ts sibling exists, so the src tree's tsc-style imports
 * work under Node's built-in type stripping.
 *
 * @param specifier Module specifier to resolve.
 * @param context Resolution context with the importing module's URL.
 * @param next Next resolve hook in the chain.
 */
export async function resolve(specifier, context, next) {
  const isRelativeOrFile =
    specifier.startsWith(".") || specifier.startsWith("file:");

  if (isRelativeOrFile && /\.[cm]?js$/.test(specifier)) {
    const url = specifier.startsWith("file:")
      ? new URL(specifier)
      : new URL(specifier, context.parentURL);

    const jsPath = fileURLToPath(url);

    if (!existsSync(jsPath)) {
      for (const extension of TS_EXTENSIONS) {
        const candidate = jsPath.replace(/\.[cm]?js$/, extension);

        if (existsSync(candidate)) {
          return {
            url: pathToFileURL(candidate).href,
            format: "module-typescript",
            shortCircuit: true,
          };
        }
      }
    }
  }

  return next(specifier, context);
}
