import { Type, type Static } from "typebox";

/**
 * TypeBox schema for validated command options.
 *
 * Parsed from raw shell-style flags by {@link parseOptions} and validated
 * here to catch accidental misuse before the options reach operation code.
 */
export const CommandOptionsSchema = Type.Object(
  {
    yes: Type.Boolean({
      description: "Skip confirmation prompts (--yes / -y)",
      default: false,
    }),
    force: Type.Boolean({
      description: "Force push/pull even when diverged (--force)",
      default: false,
    }),
    stale: Type.Boolean({
      description: "Target stale locks for unlock (--stale)",
      default: false,
    }),
    silent: Type.Boolean({
      description: "Suppress non-error output (used by auto-sync)",
      default: false,
    }),
    verbose: Type.Boolean({
      description: "Show extra detail (--verbose / -v)",
      default: false,
    }),
    reload: Type.Boolean({
      description: "Offer to reload after pull/checkout",
      default: true,
    }),
    args: Type.Array(Type.String(), {
      description: "Positional arguments (everything after -- flags)",
      default: [],
    }),
  },
  {
    $id: "CommandOptions",
    additionalProperties: false,
  },
);

export type ValidatedCommandOptions = Static<typeof CommandOptionsSchema>;
