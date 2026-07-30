import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import { ACTIVITY_STATUS_KEY } from "../domain/constants.js";
import type { CommandOptions } from "../domain/types.js";
import { SecretsArgsSchema, validateSecretsArgs } from "../schemas/secrets.js";
import { validateAndConvert } from "../schemas/validate.js";
import { SecretsOperations } from "../secrets/operations.js";
import { withLock } from "../state/lock.js";
import { errorMessage } from "../utils/json-utils.js";

/**
 * Parse and execute a /pisync secrets subcommand.
 *
 * @param options Parsed command options (args[0] is the secrets action).
 * @param ctx Pi command context used for UI and session operations.
 */
export async function handleSecretsCommand(
  options: CommandOptions,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const [action = "list", ...rest] = options.args;
  const opsOptions = { yes: options.yes, silent: options.silent };

  // Validate subcommand + optional provider with TypeBox.
  const parsed = validateAndConvert(
    SecretsArgsSchema,
    { subcommand: action, provider: rest[0] },
    "secrets arguments",
    false,
  );

  if (parsed == null) {
    ctx.ui.notify(secretsUsage(), "warning");

    return;
  }

  const constraintError = validateSecretsArgs(parsed);

  if (constraintError !== null) {
    ctx.ui.notify(constraintError, "warning");

    return;
  }

  try {
    await runSecretsAction(parsed, opsOptions, ctx);
  } catch (error) {
    ctx.ui.setStatus(ACTIVITY_STATUS_KEY, undefined);
    ctx.ui.notify(errorMessage(error), "error");
  }
}

async function runSecretsAction(
  args: { subcommand: string; provider?: string },
  options: { yes: boolean; silent: boolean },
  ctx: ExtensionCommandContext,
): Promise<void> {
  const ops = (): SecretsOperations => new SecretsOperations(ctx, options);

  switch (args.subcommand) {
    case "help":
      ctx.ui.notify(secretsUsage(), "info");

      return;

    case "setup":
      await runSetup(ops, args.provider, ctx);

      return;

    case "doctor":
      await ops().doctor();

      return;

    case "list":
      await ops().list();

      return;

    case "push":
      await withLock("secrets-push", async () => {
        await ops().pushAll();
      });

      return;

    case "pull":
      await withLock("secrets-pull", async () => {
        await ops().pullAll();
      });

      return;

    default:
      ctx.ui.notify(
        `Unknown /pisync secrets command: ${args.subcommand}\n\n${secretsUsage()}`,
        "warning",
      );
  }
}

async function runSetup(
  ops: () => SecretsOperations,
  provider: string | undefined,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const passphrase =
    provider && provider !== ""
      ? provider
      : await ctx.ui.input(
          "Secrets passphrase",
          "Enter the passphrase used on your other machine, or pick a new one for your first machine.",
        );

  if (passphrase === undefined || passphrase === "") {
    ctx.ui.notify("A passphrase is required for setup.", "warning");

    return;
  }

  await ops().setup(passphrase);
}

/**
 * Return help text for the /pisync secrets command group.
 */
export function secretsUsage(): string {
  return [
    "Usage: /pisync secrets <command>",
    "Commands: setup, push, pull, list, doctor",
    "With the `secrets` toggle on, push and pull happen automatically with",
    "/pisync push and /pisync pull. These commands are for manual control.",
    "Provider keys are read from and written to ~/.pi/agent/auth.json.",
    "Encrypted with age and stored as GitHub repository variables (PISYNC_SECRET_*).",
  ].join("\n");
}
