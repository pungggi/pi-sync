import { Value } from "typebox";
import type { TSchema } from "typebox";

/**
 * Validate a value against a TypeBox schema and return a human-readable
 * error message on failure.
 *
 * @param schema TypeBox schema to check against.
 * @param value Untrusted value to validate.
 * @param label Human label for the validated entity (used in error messages).
 * @returns `null` when valid, or a joined error string.
 */
export function validateOrError<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
): string | null {
  const errors = [...Value.Errors(schema, value)];

  if (errors.length === 0) {
    return null;
  }

  const messages = errors.map((e) => {
    const path = e.path.length > 0 ? `/${e.path}` : "";

    return `- ${label}${path}: ${e.message}`;
  });

  return `TypeBox validation failed for ${label}:\n${messages.join("\n")}`;
}

/**
 * Validate and coerce a value against a TypeBox schema, applying defaults.
 *
 * Returns the coerced value with defaults populated. Throws on validation
 * failure unless `throwOnError` is false.
 *
 * @param schema TypeBox schema.
 * @param value Untrusted raw value.
 * @param label Human label for error messages.
 * @param throwOnError When false, returns `null` on failure.
 */
export function validateAndConvert<T extends TSchema>(
  schema: T,
  value: unknown,
  label: string,
  throwOnError = true,
): T extends TSchema ? ReturnType<typeof Value.Convert<T>> : unknown {
  const error = validateOrError(schema, value, label);

  if (error !== null) {
    if (throwOnError) {
      throw new Error(error);
    }

    return null as unknown as ReturnType<typeof Value.Convert<T>>;
  }

  return Value.Convert(schema, value) as ReturnType<typeof Value.Convert<T>>;
}
