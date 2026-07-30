import { Type, type Static } from "typebox";

/**
 * Valid subcommands for `/pisync secrets ...`.
 */
export const SecretsSubcommandSchema = Type.Union([
  Type.Literal("setup"),
  Type.Literal("push"),
  Type.Literal("pull"),
  Type.Literal("list"),
  Type.Literal("doctor"),
]);

export type SecretsSubcommand = Static<typeof SecretsSubcommandSchema>;

/**
 * Full parsed arguments for `/pisync secrets <subcommand> [provider]`.
 */
export const SecretsArgsSchema = Type.Object(
  {
    subcommand: SecretsSubcommandSchema,
    provider: Type.Optional(
      Type.String({
        description: "Provider name (required by some subcommands)",
      }),
    ),
  },
  {
    $id: "SecretsArgs",
    additionalProperties: false,
  },
);

export type ValidatedSecretsArgs = Static<typeof SecretsArgsSchema>;

/**
 * Union of subcommands that require a provider argument.
 */
const PROVIDER_REQUIRED = new Set<SecretsSubcommand>(["add", "remove"]);

/**
 * Validate that the secrets subcommand's provider argument is present when
 * needed.
 *
 * @param args Parsed and schema-validated secrets arguments.
 * @returns `null` when the arguments are valid, or an error message string.
 */
export function validateSecretsArgs(
  args: ValidatedSecretsArgs,
): string | null {
  if (PROVIDER_REQUIRED.has(args.subcommand) && !args.provider) {
    return `Usage: /pisync secrets ${args.subcommand} <provider>`;
  }

  return null;
}
