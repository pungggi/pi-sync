import type { CommandOptions } from "../domain/types.js";
import { CommandOptionsSchema } from "../schemas/options.js";
import { validateAndConvert } from "../schemas/validate.js";

/**
 * Split a command argument string while preserving quoted segments.
 *
 * @param input Raw command argument string.
 */
export function splitArgs(input: string): string[] {
  return (
    input
      .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
      ?.map((arg) => arg.replace(/^["']|["']$/g, "")) ?? []
  );
}

/**
 * Parse command flags and positional arguments.
 *
 * @param args Tokenized command arguments.
 */
export function parseOptions(args: string[]): CommandOptions {
  const raw = {
    yes: args.includes("--yes") || args.includes("-y"),
    force: args.includes("--force"),
    stale: args.includes("--stale"),
    silent: false,
    verbose: args.includes("--verbose") || args.includes("-v"),
    reload: true,
    args: args.filter((arg) => !arg.startsWith("-")),
  };

  // Validate and apply defaults via TypeBox.
  return validateAndConvert(CommandOptionsSchema, raw, "command options");
}

/**
 * Return help text for the /pisync command.
 */
export function usage(): string {
  return [
    "Usage: /pisync <command>",
    "Commands: init, config, status [--verbose], diff, doctor, push, pull, sync, history, checkout <commit-ish>, unlock --stale, secrets <setup|push|pull|list|doctor>",
    "Config: set PI_SYNC_REPOSITORY plus optional PI_SYNC_BRANCH, or edit ~/.pi/agent/pi-sync.json.",
  ].join("\n");
}

/**
 * Interpret boolean-like configuration values.
 *
 * @param value Optional boolean or string value.
 * @param defaultValue Value to use when the setting is missing.
 */
export function isEnabled(
  value: boolean | string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}
