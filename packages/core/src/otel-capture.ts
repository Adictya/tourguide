export type CapturedValue =
  | { type: "string"; value: string; sensitive?: true }
  | { type: "boolean"; value: boolean; sensitive?: true }
  | { type: "int"; value: string; sensitive?: true }
  | { type: "double"; value: number | string; sensitive?: true }
  | { type: "bytes"; value: string; sensitive?: true }
  | { type: "array"; value: CapturedValue[]; sensitive?: true }
  | { type: "kvlist"; value: Record<string, CapturedValue>; sensitive?: true }
  | { type: "unknown"; value: null; sensitive?: true };

export type CaptureSourceLocation = {
  path: string;
  line: number;
  column?: number;
};

export type OtlpSpanEvidence = {
  name: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  kind?: string;
  serviceName?: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  durationNano?: string;
  statusCode?: string;
};

export type OtlpScopeEvidence = {
  name?: string;
  version?: string;
};

export type OtlpSpanEventEvidence = {
  name: string;
  timeUnixNano?: string;
};

export type OtlpCaptureEvent = {
  kind: "span" | "spanEvent";
  location?: CaptureSourceLocation;
  span: OtlpSpanEvidence;
  event?: OtlpSpanEventEvidence;
  scope?: OtlpScopeEvidence;
  resource: Record<string, CapturedValue>;
  attributes: Record<string, CapturedValue>;
};

export type OtlpExecutionCapture = {
  kind: "executionCapture";
  sourceFormat: "otlp-json-traces";
  sourceAdapter: "opentelemetry";
  capturedAt: string;
  summary: {
    resourceSpansSeen: number;
    scopesSeen: number;
    spansSeen: number;
    spansCaptured: number;
    spanEventsSeen: number;
    spanEventsCaptured: number;
    unlocatedSpansSkipped: number;
    unlocatedSpanEventsSkipped: number;
  };
  events: OtlpCaptureEvent[];
};

export type OtlpTraceIngestOptions = {
  capturedAt?: string;
  repoRoot?: string;
  redactions?: Record<string, string>;
  includeUnlocatedSpans?: boolean;
};

type JsonRecord = Record<string, unknown>;

const spanKindNames: Record<number, string> = {
  0: "unspecified",
  1: "internal",
  2: "server",
  3: "client",
  4: "producer",
  5: "consumer",
};

const statusCodeNames: Record<number, string> = {
  0: "unset",
  1: "ok",
  2: "error",
};

export function ingestOtlpTraceJson(input: unknown, options: OtlpTraceIngestOptions = {}): OtlpExecutionCapture {
  const root = parseOtlpTraceRoot(input);
  const resourceSpans = asArray(root.resourceSpans);
  const events: OtlpCaptureEvent[] = [];
  const summary = {
    resourceSpansSeen: resourceSpans.length,
    scopesSeen: 0,
    spansSeen: 0,
    spansCaptured: 0,
    spanEventsSeen: 0,
    spanEventsCaptured: 0,
    unlocatedSpansSkipped: 0,
    unlocatedSpanEventsSkipped: 0,
  };

  for (const resourceSpanValue of resourceSpans) {
    const resourceSpan = asRecord(resourceSpanValue);
    if (!resourceSpan) continue;

    const resource = asRecord(resourceSpan.resource);
    const resourceAttributes = attributesToMap(resource?.attributes, options);
    const serviceName = scalarString(resourceAttributes["service.name"]);
    const scopeSpans = asArray(resourceSpan.scopeSpans);

    for (const scopeSpanValue of scopeSpans) {
      const scopeSpan = asRecord(scopeSpanValue);
      if (!scopeSpan) continue;

      summary.scopesSeen += 1;
      const scope = scopeEvidence(scopeSpan.scope);
      const spans = asArray(scopeSpan.spans);

      for (const spanValue of spans) {
        const span = asRecord(spanValue);
        if (!span) continue;

        summary.spansSeen += 1;
        const attributes = attributesToMap(span.attributes, options);
        const spanLocation = locationFromAttributes(attributes, options);
        const spanEvidence = buildSpanEvidence(span, serviceName);

        if (spanLocation || options.includeUnlocatedSpans === true) {
          events.push({
            kind: "span",
            ...(spanLocation ? { location: spanLocation } : {}),
            span: spanEvidence,
            ...(scope ? { scope } : {}),
            resource: resourceAttributes,
            attributes,
          });
          summary.spansCaptured += 1;
        } else {
          summary.unlocatedSpansSkipped += 1;
        }

        for (const spanEventValue of asArray(span.events)) {
          const spanEvent = asRecord(spanEventValue);
          if (!spanEvent) continue;

          summary.spanEventsSeen += 1;
          const eventAttributes = attributesToMap(spanEvent.attributes, options);
          const eventLocation = locationFromAttributes(eventAttributes, options) ?? spanLocation;

          if (eventLocation || options.includeUnlocatedSpans === true) {
            events.push({
              kind: "spanEvent",
              ...(eventLocation ? { location: eventLocation } : {}),
              span: spanEvidence,
              event: buildSpanEventEvidence(spanEvent),
              ...(scope ? { scope } : {}),
              resource: resourceAttributes,
              attributes: eventAttributes,
            });
            summary.spanEventsCaptured += 1;
          } else {
            summary.unlocatedSpanEventsSkipped += 1;
          }
        }
      }
    }
  }

  return {
    kind: "executionCapture",
    sourceFormat: "otlp-json-traces",
    sourceAdapter: "opentelemetry",
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    summary,
    events,
  };
}

function parseOtlpTraceRoot(input: unknown): JsonRecord {
  const payload = typeof input === "string" ? JSON.parse(input) as unknown : input;
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.resourceSpans)) {
    throw new Error("Expected OTLP JSON trace export with resourceSpans[]");
  }
  return root;
}

function attributesToMap(attributesValue: unknown, options: OtlpTraceIngestOptions): Record<string, CapturedValue> {
  const attributes: Record<string, CapturedValue> = {};

  for (const attributeValue of asArray(attributesValue)) {
    const attribute = asRecord(attributeValue);
    if (!attribute) continue;

    const key = stringField(attribute, "key");
    if (!key) continue;

    attributes[key] = anyValueToCapturedValue(attribute.value, key, options);
  }

  return attributes;
}

function anyValueToCapturedValue(value: unknown, key: string, options: OtlpTraceIngestOptions): CapturedValue {
  const placeholder = redactionPlaceholderForKey(key, options);
  if (placeholder) return { type: "string", value: placeholder, sensitive: true };

  const anyValue = asRecord(value);
  if (!anyValue) return { type: "unknown", value: null };

  const stringValue = stringField(anyValue, "stringValue");
  if (stringValue !== undefined) return { type: "string", value: stringValue };

  const intValue = intStringField(anyValue, "intValue");
  if (intValue !== undefined) return { type: "int", value: intValue };

  const doubleValue = numberOrStringField(anyValue, "doubleValue");
  if (doubleValue !== undefined) return { type: "double", value: doubleValue };

  const boolValue = booleanField(anyValue, "boolValue");
  if (boolValue !== undefined) return { type: "boolean", value: boolValue };

  const bytesValue = stringField(anyValue, "bytesValue");
  if (bytesValue !== undefined) return { type: "bytes", value: bytesValue };

  const arrayValue = asRecord(anyValue.arrayValue);
  if (arrayValue) {
    return {
      type: "array",
      value: asArray(arrayValue.values).map((item) => anyValueToCapturedValue(item, key, options)),
    };
  }

  const kvlistValue = asRecord(anyValue.kvlistValue);
  if (kvlistValue) {
    const entries: Record<string, CapturedValue> = {};
    for (const entryValue of asArray(kvlistValue.values)) {
      const entry = asRecord(entryValue);
      if (!entry) continue;

      const entryKey = stringField(entry, "key");
      if (!entryKey) continue;

      entries[entryKey] = anyValueToCapturedValue(entry.value, `${key}.${entryKey}`, options);
    }
    return { type: "kvlist", value: entries };
  }

  return { type: "unknown", value: null };
}

function locationFromAttributes(
  attributes: Record<string, CapturedValue>,
  options: OtlpTraceIngestOptions,
): CaptureSourceLocation | undefined {
  const rawPath =
    scalarString(attributes["code.file.path"]) ??
    scalarString(attributes["code.filepath"]) ??
    scalarString(attributes["tourguide.anchor.path"]);
  const line =
    scalarInteger(attributes["code.line.number"]) ??
    scalarInteger(attributes["code.lineno"]) ??
    scalarInteger(attributes["tourguide.anchor.line"]);

  if (!rawPath || line === undefined || line < 1) return undefined;

  const path = normalizeSourcePath(rawPath, options.repoRoot);
  if (!path) return undefined;

  const column =
    scalarInteger(attributes["code.column.number"]) ??
    scalarInteger(attributes["code.column"]) ??
    scalarInteger(attributes["tourguide.anchor.column"]);

  return {
    path,
    line,
    ...(column !== undefined && column >= 1 ? { column } : {}),
  };
}

function normalizeSourcePath(rawPath: string, repoRoot?: string): string | undefined {
  let candidate = rawPath.replaceAll("\\", "/");
  const normalizedRoot = repoRoot?.replaceAll("\\", "/").replace(/\/+$/, "");

  if (normalizedRoot && candidate.startsWith(`${normalizedRoot}/`)) {
    candidate = candidate.slice(normalizedRoot.length + 1);
  }

  candidate = candidate.replace(/^\.\/+/, "");
  return isRepoRelativePosixPath(candidate) ? candidate : undefined;
}

function buildSpanEvidence(span: JsonRecord, serviceName?: string): OtlpSpanEvidence {
  const traceId = stringField(span, "traceId");
  const spanId = stringField(span, "spanId");
  const parentSpanId = stringField(span, "parentSpanId");
  const startTimeUnixNano = intStringField(span, "startTimeUnixNano");
  const endTimeUnixNano = intStringField(span, "endTimeUnixNano");
  const status = asRecord(span.status);
  const statusCode = status ? enumName(status.code, statusCodeNames, "STATUS_CODE_") : undefined;
  const kind = enumName(span.kind, spanKindNames, "SPAN_KIND_");
  const durationNano = durationBetween(startTimeUnixNano, endTimeUnixNano);

  return {
    name: stringField(span, "name") ?? "<unnamed-span>",
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
    ...(parentSpanId ? { parentSpanId } : {}),
    ...(kind ? { kind } : {}),
    ...(serviceName ? { serviceName } : {}),
    ...(startTimeUnixNano ? { startTimeUnixNano } : {}),
    ...(endTimeUnixNano ? { endTimeUnixNano } : {}),
    ...(durationNano ? { durationNano } : {}),
    ...(statusCode ? { statusCode } : {}),
  };
}

function buildSpanEventEvidence(spanEvent: JsonRecord): OtlpSpanEventEvidence {
  const timeUnixNano = intStringField(spanEvent, "timeUnixNano");
  return {
    name: stringField(spanEvent, "name") ?? "<unnamed-span-event>",
    ...(timeUnixNano ? { timeUnixNano } : {}),
  };
}

function scopeEvidence(scopeValue: unknown): OtlpScopeEvidence | undefined {
  const scope = asRecord(scopeValue);
  if (!scope) return undefined;

  const name = stringField(scope, "name");
  const version = stringField(scope, "version");
  if (!name && !version) return undefined;

  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
  };
}

function redactionPlaceholderForKey(key: string, options: OtlpTraceIngestOptions): string | undefined {
  const explicit = options.redactions?.[key];
  if (explicit) return explicit;

  const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!/\b(authorization|cookie|email|password|passwd|secret|token|apikey|api key|private key)\b/.test(normalized)) {
    return undefined;
  }

  const placeholderName = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "value";
  return `<redacted-${placeholderName}>`;
}

function scalarString(value: CapturedValue | undefined): string | undefined {
  return value?.type === "string" && value.sensitive !== true ? value.value : undefined;
}

function scalarInteger(value: CapturedValue | undefined): number | undefined {
  if (!value || value.sensitive === true) return undefined;

  const raw = value.type === "int" || value.type === "string" ? value.value : undefined;
  if (raw === undefined) return undefined;

  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function durationBetween(start: string | undefined, end: string | undefined): string | undefined {
  if (!start || !end) return undefined;

  try {
    const duration = BigInt(end) - BigInt(start);
    return duration >= 0n ? duration.toString() : undefined;
  } catch {
    return undefined;
  }
}

function enumName(value: unknown, names: Record<number, string>, prefix: string): string | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return names[value] ?? String(value);
  if (typeof value !== "string") return undefined;

  const parsed = Number.parseInt(value, 10);
  if (String(parsed) === value) return names[parsed] ?? value;

  return value.toLowerCase().replace(prefix.toLowerCase(), "").replaceAll("_", "-");
}

function intStringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  return undefined;
}

function numberOrStringField(record: JsonRecord, key: string): number | string | undefined {
  const value = record[key];
  if (typeof value === "string" || typeof value === "number") return value;
  return undefined;
}

function stringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function booleanField(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function isRepoRelativePosixPath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("\\")) return false;
  return !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}
