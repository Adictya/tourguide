import * as Schema from "@effect/schema/Schema";

import {
  FiniteNumberSchema,
  NonEmptyStringSchema,
  PositiveLineNumberSchema,
  RepoRelativePosixPathSchema,
  SanitizedJsonSchema,
} from "./primitives.js";

export const CaptureInputFormatSchema = Schema.Literal("dap-transcript", "otlp-json-traces", "structured-log-jsonl");

export const CaptureInputSchema = Schema.Struct({
  format: CaptureInputFormatSchema,
  path: RepoRelativePosixPathSchema,
});

export const CliFlowCaptureSchema = Schema.Struct({
  origin: Schema.Literal("cli"),
  input: CaptureInputSchema,
});

export const AuthoredFlowCaptureSchema = Schema.Struct({
  origin: Schema.Literal("authored"),
});

export const FlowCaptureSchema = Schema.Union(CliFlowCaptureSchema, AuthoredFlowCaptureSchema);

export const CapturePointSchema = Schema.Struct({
  line: PositiveLineNumberSchema,
  column: Schema.optional(PositiveLineNumberSchema),
});

export const StackFrameSchema = Schema.Struct({
  name: NonEmptyStringSchema,
  path: Schema.optional(RepoRelativePosixPathSchema),
  line: Schema.optional(PositiveLineNumberSchema),
  column: Schema.optional(PositiveLineNumberSchema),
});

export const CallStackSchema = Schema.Struct({
  frames: Schema.Array(StackFrameSchema).pipe(Schema.minItems(1)),
});

const RedactedFieldSchema = Schema.optional(Schema.Literal(true));

export const CapturedStringValueSchema = Schema.Struct({
  type: Schema.Literal("string"),
  value: Schema.String,
  redacted: RedactedFieldSchema,
});

export const CapturedNumberValueSchema = Schema.Struct({
  type: Schema.Literal("number"),
  value: FiniteNumberSchema,
  redacted: RedactedFieldSchema,
});

export const CapturedBooleanValueSchema = Schema.Struct({
  type: Schema.Literal("boolean"),
  value: Schema.Boolean,
  redacted: RedactedFieldSchema,
});

export const CapturedNullValueSchema = Schema.Struct({
  type: Schema.Literal("null"),
  value: Schema.Null,
  redacted: RedactedFieldSchema,
});

export const CapturedArrayValueSchema = Schema.Struct({
  type: Schema.Literal("array"),
  value: Schema.Array(SanitizedJsonSchema),
  redacted: RedactedFieldSchema,
});

export const CapturedObjectValueSchema = Schema.Struct({
  type: Schema.Literal("object"),
  value: Schema.Record({ key: Schema.String, value: SanitizedJsonSchema }),
  redacted: RedactedFieldSchema,
});

export const CapturedUnknownValueSchema = Schema.Struct({
  type: Schema.Literal("unknown"),
  value: SanitizedJsonSchema,
  redacted: RedactedFieldSchema,
});

export const CapturedValueSchema = Schema.Union(
  CapturedStringValueSchema,
  CapturedNumberValueSchema,
  CapturedBooleanValueSchema,
  CapturedNullValueSchema,
  CapturedArrayValueSchema,
  CapturedObjectValueSchema,
  CapturedUnknownValueSchema,
);

export const CapturedValueMapSchema = Schema.Record({ key: NonEmptyStringSchema, value: CapturedValueSchema });

export const ErrorObservationSchema = Schema.Struct({
  message: NonEmptyStringSchema,
  name: Schema.optional(NonEmptyStringSchema),
  value: Schema.optional(CapturedValueSchema),
  stack: Schema.optional(Schema.Array(StackFrameSchema)),
});

export const ObservationValuesSchema = Schema.Struct({
  inputs: CapturedValueMapSchema,
  locals: CapturedValueMapSchema,
  outputs: CapturedValueMapSchema,
  error: Schema.Union(ErrorObservationSchema, Schema.Null),
});

export const CaptureObservationSchema = Schema.Struct({
  capturePoint: Schema.optional(CapturePointSchema),
  callStack: CallStackSchema,
  values: ObservationValuesSchema,
});

export type CaptureInputFormat = Schema.Schema.Type<typeof CaptureInputFormatSchema>;
export type CaptureInput = Schema.Schema.Type<typeof CaptureInputSchema>;
export type CliFlowCapture = Schema.Schema.Type<typeof CliFlowCaptureSchema>;
export type AuthoredFlowCapture = Schema.Schema.Type<typeof AuthoredFlowCaptureSchema>;
export type FlowCapture = Schema.Schema.Type<typeof FlowCaptureSchema>;
export type CapturePoint = Schema.Schema.Type<typeof CapturePointSchema>;
export type StackFrame = Schema.Schema.Type<typeof StackFrameSchema>;
export type CallStack = Schema.Schema.Type<typeof CallStackSchema>;
export type CapturedValue = Schema.Schema.Type<typeof CapturedValueSchema>;
export type CapturedValueMap = Schema.Schema.Type<typeof CapturedValueMapSchema>;
export type ErrorObservation = Schema.Schema.Type<typeof ErrorObservationSchema>;
export type ObservationValues = Schema.Schema.Type<typeof ObservationValuesSchema>;
export type CaptureObservation = Schema.Schema.Type<typeof CaptureObservationSchema>;
