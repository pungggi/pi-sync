import { type Static,Type } from "typebox";

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
