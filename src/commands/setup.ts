import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { CommandOptions, PartialConfig } from "../domain/types.js";
import { PartialConfigSchema } from "../schemas/config.js";
import { validateAndConvert } from "../schemas/validate.js";
import { getCachedKey } from "../secrets/key-manager.js";
import { readJsonIfExists, writeJson } from "../utils/json-utils.js";
import { localConfigPath } from "../utils/path-utils.js";
import { isEnabled } from "./args.js";
import { refreshSyncFooter } from "./footer-status.js";
import { parseSettingArgs,SETUP_USAGE } from "./settings.js";

const SETTING_KEYS = ["repository", "branch", "autoSync", "secrets"] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

const ENV_OVERRIDES: Record<SettingKey, string[]> = {
  repository: ["PI_SYNC_REPOSITORY", "PI_SYNC_REPO"],
  branch: ["PI_SYNC_BRANCH"],
  autoSync: ["PI_SYNC_AUTO_SYNC"],
  secrets: ["PI_SYNC_SECRETS"],
};

/**
 * Change persisted settings after /pisync init.
 *
 * With `key=value` arguments it updates those settings directly; without
 * arguments it walks through every setting with the current value as the
 * default, so Enter keeps it.
 *
 * @param ctx Pi command context used for prompts and notifications.
 * @param options Parsed command options.
 */
export async function setupCommand(
  ctx: ExtensionCommandContext,
  options: CommandOptions,
): Promise<void> {
  const updates =
    options.args.length > 0
      ? directUpdates(ctx, options.args)
      : await promptUpdates(ctx);

  if (updates === undefined) {
    return;
  }

  if (Object.keys(updates).length === 0) {
    ctx.ui.notify("No settings changed.", "info");

    return;
  }

  const base = (await readJsonIfExists<PartialConfig>(localConfigPath())) ?? {};

  if (base.repository === undefined && updates.repository === undefined) {
    ctx.ui.notify("No config file yet. Run /pisync init first.", "warning");

    return;
  }

  const merged = { ...base, ...updates };
  const validated = validateAndConvert(
    PartialConfigSchema,
    merged,
    "pi-sync config",
  );

  await writeJson(localConfigPath(), validated);

  await notifyApplied(ctx, base, updates);
  await refreshSyncFooter(ctx);
}

function directUpdates(
  ctx: ExtensionCommandContext,
  args: string[],
): PartialConfig | undefined {
  const { updates, errors } = parseSettingArgs(args);

  if (errors.length > 0) {
    ctx.ui.notify(
      [SETUP_USAGE, ...errors.map((error) => `- ${error}`)].join("\n"),
      "warning",
    );

    return undefined;
  }

  return updates;
}

async function promptUpdates(
  ctx: ExtensionCommandContext,
): Promise<PartialConfig> {
  const base = (await readJsonIfExists<PartialConfig>(localConfigPath())) ?? {};
  const updates: PartialConfig = {};

  const repository = await promptKeepCurrent(
    ctx,
    "Git repository URL",
    base.repository,
  );

  if (repository !== undefined) {
    updates.repository = repository;
  }

  const branch = await promptKeepCurrent(ctx, "Git branch", base.branch);

  if (branch !== undefined) {
    updates.branch = branch;
  }

  const autoSync = await ctx.ui.confirm(
    "Enable auto-sync?",
    `Currently ${isEnabled(base.autoSync, true) ? "enabled" : "disabled"}. Auto-sync pulls safe remote changes on session start but never pushes automatically.`,
  );

  if (autoSync !== isEnabled(base.autoSync, true)) {
    updates.autoSync = autoSync;
  }

  const secrets = await ctx.ui.confirm(
    "Enable encrypted secrets sync?",
    `Currently ${isEnabled(base.secrets, false) ? "enabled" : "disabled"}. Syncs API keys from auth.json as age-encrypted GitHub variables.`,
  );

  if (secrets !== isEnabled(base.secrets, false)) {
    updates.secrets = secrets;
  }

  return updates;
}

async function promptKeepCurrent(
  ctx: ExtensionCommandContext,
  title: string,
  current: string | undefined,
): Promise<string | undefined> {
  const value = await ctx.ui.input(
    title,
    current === undefined || current === ""
      ? "Enter a value (no current value set)."
      : `Press Enter to keep: ${current}`,
  );

  if (value === undefined || value === "") {
    return undefined;
  }

  return value;
}

async function notifyApplied(
  ctx: ExtensionCommandContext,
  base: PartialConfig,
  updates: PartialConfig,
): Promise<void> {
  const lines: string[] = [];

  for (const key of SETTING_KEYS) {
    const value = updates[key];

    if (value === undefined) {
      continue;
    }

    const from = base[key] ?? "(unset)";

    lines.push(`- ${key}: ${String(from)} → ${String(value)}`);
  }

  lines.push(`Saved: ${localConfigPath()}`);

  const envWarnings = (Object.keys(updates) as SettingKey[])
    .flatMap((key) =>
      ENV_OVERRIDES[key].filter((name) => process.env[name] !== undefined),
    )
    .map((name) => `- ${name} is set and overrides the file until unset.`);

  if (envWarnings.length > 0) {
    lines.push("", "Environment overrides active:", ...envWarnings);
  }

  if (updates.repository !== undefined || updates.branch !== undefined) {
    lines.push("Run /pisync doctor to verify access to the repository.");
  }

  if (updates.secrets === true) {
    const cached = await getCachedKey();

    if (cached === undefined) {
      lines.push(
        "Run /pisync secrets setup to enter your passphrase and finish enabling secrets.",
      );
    }
  } else if (updates.secrets === false) {
    lines.push(
      "Existing PISYNC_SECRET_* GitHub variables remain; delete them with `gh variable delete <name> --repo <repo>` if you want them gone.",
    );
  }

  if (updates.autoSync !== undefined) {
    lines.push("Auto-sync runs at the next pi session start.");
  }

  ctx.ui.notify(lines.join("\n"), "info");
}
