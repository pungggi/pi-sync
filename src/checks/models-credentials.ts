import type { ScopedModel } from "@earendil-works/pi-coding-agent";

import { readAuthApiKeyProviders } from "../secrets/auth-storage.js";

/**
 * Result of cross-checking scoped models against locally available credentials.
 */
export type ScopedModelsCredentialReport = {
  /** Total scoped models evaluated. */
  scopedCount: number;
  /** Provider names that have scoped models but no local api_key credential. */
  missingProviders: string[];
  /** Provider names that have both scoped models and local credentials. */
  coveredProviders: string[];
};

/**
 * Cross-reference the session's scoped models against locally stored API keys.
 *
 * Only considers providers whose credentials are stored as `type: "api_key"` in
 * auth.json. OAuth-only providers (e.g. copilot authenticated via browser) are
 * never flagged as missing because their credential resolution does not depend
 * on auth.json entries.
 *
 * @param scopedModels The resolved scoped models from the extension context.
 */
export function checkScopedModelsCredentials(
  scopedModels: readonly ScopedModel[],
): ScopedModelsCredentialReport {
  const authProviders = new Set(readAuthApiKeyProviders());

  // Collect unique providers referenced by any scoped model.
  const providerSet = new Set<string>();

  for (const entry of scopedModels) {
    const { provider } = entry.model;

    if (typeof provider === "string") {
      providerSet.add(provider);
    }
  }

  const allProviders = [...providerSet].sort((a, b) => a.localeCompare(b));
  const coveredProviders = allProviders.filter((p) => authProviders.has(p));
  const missingProviders = allProviders.filter((p) => !authProviders.has(p));

  return {
    scopedCount: scopedModels.length,
    missingProviders,
    coveredProviders,
  };
}

/**
 * Build a human-readable diagnostic message from a credential report.
 *
 * @param report Cross-check result from {@link checkScopedModelsCredentials}.
 * @param secretsEnabled Whether encrypted secrets sync is enabled.
 */
export function formatCredentialsReport(
  report: ScopedModelsCredentialReport,
  secretsEnabled: boolean,
): string[] {
  if (report.scopedCount === 0) {
    return ["scoped models: no scoped models (unscoped session)"];
  }

  if (report.missingProviders.length === 0) {
    const covered =
      report.coveredProviders.length > 0
        ? ` (${report.coveredProviders.join(", ")})`
        : "";

    return [
      `scoped model credentials: ok — all ${report.scopedCount} scoped model(s) have local credentials${covered}`,
    ];
  }

  const lines: string[] = [];
  const suffix = secretsEnabled
    ? " Run /pisync secrets pull to sync them from another machine."
    : "";

  lines.push(
    `scoped model credentials: ${report.missingProviders.length} provider(s) missing api_key${suffix}`,
  );

  for (const p of report.missingProviders) {
    lines.push(`  - ${p}`);
  }

  if (report.coveredProviders.length > 0) {
    lines.push(
      `  (covered: ${report.coveredProviders.sort((a, b) => a.localeCompare(b)).join(", ")})`,
    );
  }

  return lines;
}
