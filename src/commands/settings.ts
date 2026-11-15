import type { PartialConfig } from "../domain/types.js";
import { isEnabled } from "./args.js";

const SETTING_KEYS = ["repository", "branch", "autoSync", "secrets"] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

type BooleanSetting = "autoSync" | "secrets";

function isBooleanSetting(key: SettingKey): key is BooleanSetting {
  return key === "autoSync" || key === "secrets";
}

export const SETUP_USAGE =
  "Usage: /pisync setup [key=value ...] — keys: repository, branch, autoSync, secrets. Run /pisync setup without arguments for an interactive walkthrough.";

/**
 * Parse `key=value` setting arguments into a partial config.
 *
 * @param args Positional arguments from the command invocation.
 * @returns Coerced updates plus human-readable errors for invalid input.
 */
export function parseSettingArgs(args: string[]): {
  updates: PartialConfig;
  errors: string[];
} {
  const updates: PartialConfig = {};
  const errors: string[] = [];

  for (const arg of args) {
    const separator = arg.indexOf("=");

    if (separator <= 0) {
      errors.push(`Expected key=value, got: ${arg}`);

      continue;
    }

    const key = arg.slice(0, separator);
    const value = arg.slice(separator + 1);

    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      errors.push(`Unknown setting: ${key} (valid: ${SETTING_KEYS.join(", ")})`);

      continue;
    }

    if (value === "") {
      errors.push(`Value for ${key} must not be empty.`);

      continue;
    }

    const setting = key as SettingKey;

    if (isBooleanSetting(setting)) {
      updates[setting] = isEnabled(value, true);

      continue;
    }

    updates[setting] = value;
  }

  return { updates, errors };
}
