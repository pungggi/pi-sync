import { DEFAULT_BRANCH } from "../domain/constants.js";
import type { PartialConfig, SyncConfig } from "../domain/types.js";
import { SyncConfigSchema, PartialConfigSchema } from "../schemas/config.js";
import { validateAndConvert } from "../schemas/validate.js";
import { readJsonIfExists } from "../utils/json-utils.js";
import { localConfigPath } from "../utils/path-utils.js";

/**
 * Load and validate complete pi-sync configuration.
 */
export async function loadConfig(): Promise<SyncConfig> {
  const partial = await loadPartialConfig();
  const repository = partial.repository;

  if (repository == null || repository === "") {
    throw new Error(
      "Missing pi-sync config: repository. Run /pisync init or set PI_SYNC_REPOSITORY.",
    );
  }

  const combined = {
    repository,
    branch: partial.branch ?? DEFAULT_BRANCH,
    autoSync: partial.autoSync ?? true,
    secrets: partial.secrets ?? false,
  };

  // Validate the merged config against the TypeBox schema.
  return validateAndConvert(SyncConfigSchema, combined, "pi-sync config");
}

/**
 * Load config from local file and environment overrides.
 */
export async function loadPartialConfig(): Promise<PartialConfig> {
  const fileConfig =
    (await readJsonIfExists<PartialConfig>(localConfigPath())) ?? {};

  const merged = {
    ...fileConfig,
    repository:
      process.env.PI_SYNC_REPOSITORY ??
      process.env.PI_SYNC_REPO ??
      fileConfig.repository,
    branch: process.env.PI_SYNC_BRANCH ?? fileConfig.branch,
    autoSync: process.env.PI_SYNC_AUTO_SYNC ?? fileConfig.autoSync,
    secrets: process.env.PI_SYNC_SECRETS ?? fileConfig.secrets,
  };

  // Validate the merged partial config against the TypeBox schema.
  return validateAndConvert(PartialConfigSchema, merged, "pi-sync config");
}

/**
 * Check whether an error represents intentionally missing configuration.
 *
 * @param error Error-like value to inspect.
 */
export function isMissingConfigError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Missing pi-sync config:")
  );
}
