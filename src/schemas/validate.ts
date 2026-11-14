import type { Static, TSchema } from "typebox";
import { Value } from "typebox/value";

/**
 * Validate a value against a TypeBox schema and return a human-readable
 * error message on failure.
 *
 * @param schema TypeBox schema to check against.
 * @param value Untrusted value to validate.
 * @param label Human label for the validated entity (used in error messages).
 * @returns `null` when valid, or a joined error string.
 */
export function validateOrError(
  schema: TSchema,
  value: unknown,
  label: string,
): string | null {
  const errors = [...Value.Errors(schema, value)];

  if (errors.length === 0) {
    return null;
  }

  const messages = errors.map((e) => {
    const path = e.instancePath.length > 0 ? e.instancePath : "";

    return `- ${label}${path}: ${e.message}`;
  });

  return `TypeBox validation failed for ${label}:\n${messages.join("\n")}`;
}

/**
 * Validate and coerce a value against a TypeBox schema, applying defaults.
 *
 * Returns the coerced value with defaults populated. Throws on validation
 * failure unless `throwOnError` is `false`, in which case it returns `null`.
 *
 * @param schema TypeBox schema.
 * @param value Untrusted raw value.
 * @param label Human label for error messages.
 * @param throwOnError When `false`, returns `null` on failure.
 */
export function validateAndConvert<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
  throwOnError?: true,
): Static<T>;
export function validateAndConvert<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
  throwOnError: false,
): Static<T> | null;

export function validateAndConvert<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
  throwOnError = true,
): Static<T> | null {
  const error = validateOrError(schema, value, label);

  if (error !== null) {
    if (throwOnError) {
      throw new Error(error);
    }

    return null;
  }

  return Value.Convert(schema, value) as Static<T>;
}
