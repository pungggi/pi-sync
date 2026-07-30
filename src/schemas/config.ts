import { Type, type Static } from "typebox";

/**
 * TypeBox schema for validated sync configuration.
 *
 * @remarks
 * `autoSync` and `secrets` accept booleans or common truthy/falsy strings
 * that are resolved by {@link isEnabled}. The schema matches the raw
 * pi-sync.json shape before coercion.
 */
export const SyncConfigSchema = Type.Object(
  {
    repository: Type.String({
      description: "Git remote URL",
      minLength: 1,
    }),
    branch: Type.String({
      description: "Branch name",
      default: "main",
    }),
    autoSync: Type.Union(
      [Type.Boolean(), Type.String()],
      {
        description: "Enable background auto-sync",
        default: true,
      },
    ),
    secrets: Type.Union(
      [Type.Boolean(), Type.String()],
      {
        description: "Enable encrypted secrets sync via GitHub Variables",
        default: false,
      },
    ),
  },
  {
    $id: "SyncConfig",
    additionalProperties: false,
  },
);

export type ValidatedSyncConfig = Static<typeof SyncConfigSchema>;

/**
 * TypeBox schema for partial config (before repository is set).
 *
 * All fields are optional — used when reading config before init.
 */
export const PartialConfigSchema = Type.Object(
  {
    repository: Type.Optional(
      Type.String({
        description: "Git remote URL",
        minLength: 1,
      }),
    ),
    branch: Type.Optional(
      Type.String({
        description: "Branch name",
        default: "main",
      }),
    ),
    autoSync: Type.Optional(
      Type.Union([Type.Boolean(), Type.String()], {
        description: "Enable background auto-sync",
        default: true,
      }),
    ),
    secrets: Type.Optional(
      Type.Union([Type.Boolean(), Type.String()], {
        description: "Enable encrypted secrets sync",
        default: false,
      }),
    ),
  },
  {
    $id: "PartialConfig",
    additionalProperties: false,
  },
);

export type ValidatedPartialConfig = Static<typeof PartialConfigSchema>;
