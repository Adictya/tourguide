import { Ajv, type ErrorObject } from "ajv/dist/ajv.js";

import { tourSchema } from "./schema.js";
import type { Tour } from "./types.js";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; tour: Tour }
  | { ok: false; errors: ValidationIssue[] };

const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile<Tour>(tourSchema);

export function validateTour(input: unknown): ValidationResult {
  if (validateSchema(input)) return { ok: true, tour: input as Tour };

  return {
    ok: false,
    errors: (validateSchema.errors ?? []).map((error: ErrorObject) => ({
      path: error.instancePath || "/",
      message: error.message ?? "invalid value"
    }))
  };
}

export function assertValidTour(input: unknown): asserts input is Tour {
  const result = validateTour(input);
  if (result.ok) return;

  const details = result.errors.map((error) => `${error.path}: ${error.message}`).join("\n");
  throw new Error(`Invalid TourGuide tour:\n${details}`);
}
