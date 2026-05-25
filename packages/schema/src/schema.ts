export const tourSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://tourguide.dev/schemas/tour.schema.json",
  title: "TourGuide Tour",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "title", "topics"],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    intent: { type: "string" },
    description: { type: "string" },
    createdAt: { type: "string" },
    generator: { $ref: "#/$defs/generator" },
    repo: { $ref: "#/$defs/repo" },
    topics: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/topic" }
    }
  },
  $defs: {
    generator: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 1 },
        version: { type: "string" },
        model: { type: "string" }
      }
    },
    repo: {
      type: "object",
      additionalProperties: false,
      properties: {
        vcs: { const: "git" },
        rootHint: { type: "string" },
        remoteUrl: { type: "string" },
        commit: { type: "string" },
        baseRef: { type: "string" },
        headRef: { type: "string" }
      }
    },
    topic: {
      type: "object",
      additionalProperties: false,
      required: ["title", "steps"],
      properties: {
        id: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
        body: { type: "string" },
        steps: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/step" }
        }
      }
    },
    step: {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        id: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
        body: { type: "string" },
        primaryAnchorId: { type: "string", minLength: 1 },
        presentation: { $ref: "#/$defs/presentation" },
        anchors: {
          type: "array",
          items: { $ref: "#/$defs/anchor" }
        }
      }
    },
    presentation: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { enum: ["single", "flow", "compare", "diff"] },
        preferredDiffView: { enum: ["unified", "sideBySide"] }
      }
    },
    anchor: {
      oneOf: [
        { $ref: "#/$defs/fileRangeAnchor" },
        { $ref: "#/$defs/diffHunkAnchor" },
        { $ref: "#/$defs/embeddedExcerptAnchor" }
      ]
    },
    anchorBase: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1 },
        note: { type: "string" },
        role: { enum: ["primary", "context", "before", "after"] }
      }
    },
    fileRangeAnchor: {
      allOf: [
        { $ref: "#/$defs/anchorBase" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "path", "range"],
          properties: {
            id: { type: "string", minLength: 1 },
            note: { type: "string" },
            role: { enum: ["primary", "context", "before", "after"] },
            kind: { const: "fileRange" },
            path: { type: "string", minLength: 1 },
            range: { $ref: "#/$defs/sourceRange" },
            locator: { $ref: "#/$defs/locator" },
            integrity: { $ref: "#/$defs/integrity" },
            snapshot: { $ref: "#/$defs/snapshot" }
          }
        }
      ]
    },
    diffHunkAnchor: {
      allOf: [
        { $ref: "#/$defs/anchorBase" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "path", "status", "hunk"],
          properties: {
            id: { type: "string", minLength: 1 },
            note: { type: "string" },
            role: { enum: ["primary", "context", "before", "after"] },
            kind: { const: "diffHunk" },
            path: { type: "string", minLength: 1 },
            oldPath: { type: "string", minLength: 1 },
            status: { enum: ["added", "modified", "deleted", "renamed"] },
            hunk: { $ref: "#/$defs/diffHunk" },
            focus: { $ref: "#/$defs/diffFocus" }
          }
        }
      ]
    },
    embeddedExcerptAnchor: {
      allOf: [
        { $ref: "#/$defs/anchorBase" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "content"],
          properties: {
            id: { type: "string", minLength: 1 },
            note: { type: "string" },
            role: { enum: ["primary", "context", "before", "after"] },
            kind: { const: "embeddedExcerpt" },
            path: { type: "string", minLength: 1 },
            language: { type: "string" },
            startLine: { type: "integer", minimum: 1 },
            content: { type: "string" },
            contentHash: { type: "string" }
          }
        }
      ]
    },
    sourceRange: {
      type: "object",
      additionalProperties: false,
      required: ["startLine", "endLine"],
      properties: {
        startLine: { type: "integer", minimum: 1 },
        endLine: { type: "integer", minimum: 1 },
        startColumn: { type: "integer", minimum: 1 },
        endColumn: { type: "integer", minimum: 1 }
      }
    },
    locator: {
      type: "object",
      additionalProperties: false,
      properties: {
        search: { type: "string" },
        symbol: { type: "string" }
      }
    },
    integrity: {
      type: "object",
      additionalProperties: false,
      properties: {
        excerptHash: { type: "string" },
        hashAlgorithm: { const: "sha256" }
      }
    },
    snapshot: {
      type: "object",
      additionalProperties: false,
      required: ["startLine", "content"],
      properties: {
        language: { type: "string" },
        startLine: { type: "integer", minimum: 1 },
        content: { type: "string" }
      }
    },
    diffHunk: {
      type: "object",
      additionalProperties: false,
      required: ["header", "patch"],
      properties: {
        header: { type: "string", minLength: 1 },
        oldStart: { type: "integer", minimum: 0 },
        oldLines: { type: "integer", minimum: 0 },
        newStart: { type: "integer", minimum: 0 },
        newLines: { type: "integer", minimum: 0 },
        patch: { type: "string" }
      }
    },
    diffFocus: {
      type: "object",
      additionalProperties: false,
      properties: {
        oldLines: {
          type: "array",
          items: { type: "integer", minimum: 1 }
        },
        newLines: {
          type: "array",
          items: { type: "integer", minimum: 1 }
        }
      }
    }
  }
} as const;
