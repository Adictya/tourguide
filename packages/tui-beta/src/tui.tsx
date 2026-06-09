import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { loadExplanation, NodeExplanationFileSystemLive } from "@elic/core";
import {
  createCliRenderer,
  RGBA,
  SyntaxStyle,
  type CliRenderer,
  type ScrollBoxRenderable,
} from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { Effect } from "effect";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { defaultDetailLevel, defaultMinDetailLevel, type Anchor, type DetailLevel, type Explanation, type Step } from "@elic/schema";

const nextMicrotask = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const waitForDestroy = (renderer: CliRenderer) =>
  Effect.async<void>((resume) => {
    if (renderer.isDestroyed) {
      resume(Effect.void);
      return Effect.void;
    }

    const onDestroy = () => resume(Effect.void);
    renderer.once("destroy", onDestroy);

    return Effect.sync(() => renderer.off("destroy", onDestroy));
  });

const detailLevels = [1, 2, 3, 4] as const;

const detailLevelNames: Record<DetailLevel, string> = {
  1: "Overview",
  2: "Explore",
  3: "Deep Dive",
  4: "Trace",
};

const appBg = "#050507";
const panelBg = "#09090b";
const raisedBg = "#101016";
const activeBg = "#182033";
const mutedBg = "#0d0d12";
const borderColor = "#333342";
const quietBorderColor = "#22222b";
const accentColor = "#facc15";
const activeTextColor = "#fafafa";
const mutedTextColor = "#8b8b98";

const focusedSyntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#f472b6"), bold: true },
  string: { fg: RGBA.fromHex("#86efac") },
  comment: { fg: RGBA.fromHex("#a1a1aa"), italic: true },
  number: { fg: RGBA.fromHex("#fde68a") },
  function: { fg: RGBA.fromHex("#93c5fd") },
  type: { fg: RGBA.fromHex("#c4b5fd") },
  property: { fg: RGBA.fromHex("#67e8f9") },
  variable: { fg: RGBA.fromHex("#e4e4e7") },
  operator: { fg: RGBA.fromHex("#f9a8d4") },
  punctuation: { fg: RGBA.fromHex("#d4d4d8") },
  default: { fg: RGBA.fromHex("#f4f4f5") },
});

const contextSyntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#854d7d"), dim: true },
  string: { fg: RGBA.fromHex("#4d7c5a"), dim: true },
  comment: { fg: RGBA.fromHex("#52525b"), italic: true, dim: true },
  number: { fg: RGBA.fromHex("#8a6d3b"), dim: true },
  function: { fg: RGBA.fromHex("#4d6f9f"), dim: true },
  type: { fg: RGBA.fromHex("#6d5f99"), dim: true },
  property: { fg: RGBA.fromHex("#3f7f88"), dim: true },
  variable: { fg: RGBA.fromHex("#71717a"), dim: true },
  operator: { fg: RGBA.fromHex("#7f5268"), dim: true },
  punctuation: { fg: RGBA.fromHex("#71717a"), dim: true },
  default: { fg: RGBA.fromHex("#71717a"), dim: true },
});

type DisplayStep = Step & {
  readonly globalIndex: number;
  readonly topicTitle: string;
  readonly flowTitle?: string;
};

type DisplayTopic = {
  readonly title: string;
  readonly steps: readonly DisplayStep[];
};

type LoadedFileMap = ReadonlyMap<string, string>;

type AnchorEvidence = {
  readonly title: string;
  readonly language: string;
  readonly before: string;
  readonly focus: string;
  readonly after: string;
  readonly focusStartLine: number;
  readonly focusEndLine: number;
  readonly fallback?: string;
};

const clampDetailLevel = (level: number): DetailLevel => Math.min(4, Math.max(1, level)) as DetailLevel;

const isIncludedAtDetailLevel = (minDetailLevel: DetailLevel | undefined, activeDetailLevel: DetailLevel) =>
  (minDetailLevel ?? defaultMinDetailLevel) <= activeDetailLevel;

const collectDisplayTopics = (explanation: Explanation, activeDetailLevel: DetailLevel): readonly DisplayTopic[] => {
  let globalIndex = 0;

  return explanation.topics
    .map((topic) => {
      const steps: DisplayStep[] = [];

      for (const item of topic.items) {
        if (item.kind === "step") {
          if (isIncludedAtDetailLevel(item.minDetailLevel, activeDetailLevel)) {
            steps.push({ ...item, globalIndex, topicTitle: topic.title });
            globalIndex += 1;
          }
          continue;
        }

        if (!isIncludedAtDetailLevel(item.minDetailLevel, activeDetailLevel)) continue;

        const includedFlowSteps = item.steps.filter((step) => isIncludedAtDetailLevel(step.minDetailLevel, activeDetailLevel));
        const flowTitle = includedFlowSteps.length >= 2 ? item.title : undefined;

        for (const step of includedFlowSteps) {
          steps.push({ ...step, globalIndex, topicTitle: topic.title, ...(flowTitle ? { flowTitle } : {}) });
          globalIndex += 1;
        }
      }

      return { title: topic.title, steps };
    })
    .filter((topic) => topic.steps.length > 0);
};

const collectFileRangePaths = (explanation: Explanation): readonly string[] => {
  const paths = new Set<string>();

  for (const topic of explanation.topics) {
    for (const item of topic.items) {
      const steps = item.kind === "step" ? [item] : item.steps;
      for (const step of steps) {
        if (step.anchor?.kind === "fileRange") paths.add(step.anchor.path);
      }
    }
  }

  return [...paths].sort();
};

const findRepoRoot = async (startPath: string, fallback: string) => {
  let directory = dirname(startPath);

  while (true) {
    try {
      await access(join(directory, ".git"));
      return directory;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) return fallback;
      directory = parent;
    }
  }
};

const loadAnchorFiles = (explanation: Explanation, repoRoot: string): Effect.Effect<LoadedFileMap> =>
  Effect.promise(async () => {
    const entries = await Promise.all(
      collectFileRangePaths(explanation).map(async (path) => {
        try {
          return [path, await readFile(resolve(repoRoot, path), "utf8")] as const;
        } catch {
          return [path, undefined] as const;
        }
      }),
    );

    return new Map(entries.filter((entry): entry is readonly [string, string] => entry[1] !== undefined));
  });

const languageForPath = (path: string | undefined, fallback = "text") => {
  if (!path) return fallback;
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".jsonc")) return "jsonc";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".rs")) return "rust";
  if (path.endsWith(".lua")) return "lua";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".sh")) return "bash";
  return fallback;
};

const splitLines = (content: string) => content.split(/\r?\n/);

const joinLines = (lines: readonly string[]) => lines.join("\n");

const buildFileRangeEvidence = (anchor: Extract<Anchor, { kind: "fileRange" }>, files: LoadedFileMap): AnchorEvidence => {
  const liveContent = files.get(anchor.path);
  const content = liveContent ?? anchor.snapshot?.content ?? `${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}`;
  const lines = splitLines(content);
  const snapshotFallback = liveContent === undefined && anchor.snapshot?.content !== undefined;
  const focusStartLine = snapshotFallback ? 1 : anchor.range.startLine;
  const focusEndLine = snapshotFallback ? lines.length : anchor.range.endLine;
  const startIndex = Math.max(0, focusStartLine - 1);
  const endIndex = Math.min(lines.length, focusEndLine);

  return {
    title: `${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}`,
    language: anchor.snapshot?.language ?? languageForPath(anchor.path),
    before: joinLines(lines.slice(0, startIndex)),
    focus: joinLines(lines.slice(startIndex, endIndex)),
    after: joinLines(lines.slice(endIndex)),
    focusStartLine,
    focusEndLine,
    ...(snapshotFallback ? { fallback: "Snapshot fallback" } : liveContent === undefined ? { fallback: "File unavailable" } : {}),
  };
};

const buildAnchorEvidence = (anchor: Anchor | undefined, files: LoadedFileMap): AnchorEvidence => {
  if (!anchor) {
    return {
      title: "No Anchor",
      language: "text",
      before: "",
      focus: "This Step has no Anchor.",
      after: "",
      focusStartLine: 1,
      focusEndLine: 1,
    };
  }

  if (anchor.kind === "fileRange") return buildFileRangeEvidence(anchor, files);

  if (anchor.kind === "diffHunk") {
    return {
      title: `${anchor.path} (${anchor.status})`,
      language: "diff",
      before: "",
      focus: `${anchor.hunk.header}\n${anchor.hunk.patch}`,
      after: "",
      focusStartLine: 1,
      focusEndLine: splitLines(anchor.hunk.patch).length + 1,
    };
  }

  const startLine = anchor.startLine ?? 1;

  return {
    title: anchor.path ? `${anchor.path}:${startLine}` : "Embedded Excerpt",
    language: anchor.language ?? languageForPath(anchor.path),
    before: "",
    focus: anchor.content,
    after: "",
    focusStartLine: startLine,
    focusEndLine: startLine + splitLines(anchor.content).length - 1,
  };
};

const firstBodyLine = (body: string) => body.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? body;

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const stepNumber = (index: number) => String(index + 1).padStart(2, "0");

const detailMeter = (level: DetailLevel) => detailLevels.map((candidate) => (candidate <= level ? "#" : "-")).join("");

const progressMeter = (current: number, total: number) => {
  const width = 10;
  if (total <= 0) return "----------";
  const filled = Math.max(1, Math.ceil(((current + 1) / total) * width));
  return "#".repeat(filled) + "-".repeat(width - filled);
};

const anchorKindLabel = (anchor: Anchor | undefined) => {
  if (!anchor) return "NONE";
  if (anchor.kind === "fileRange") return "FILE";
  if (anchor.kind === "diffHunk") return "DIFF";
  return "EXCERPT";
};

const anchorLabel = (anchor: Anchor | undefined) => {
  if (!anchor) return "anchorless";
  if (anchor.kind === "fileRange") return `${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}`;
  if (anchor.kind === "diffHunk") return `${anchor.path} diff`;
  return anchor.path ?? "embedded excerpt";
};

const StepRow = (props: { readonly step: DisplayStep; readonly selected: boolean }) => (
  <box
    flexDirection="column"
    border={props.selected ? ["left", "bottom"] : ["bottom"]}
    borderColor={props.selected ? accentColor : quietBorderColor}
    backgroundColor={props.selected ? activeBg : panelBg}
    paddingX={2}
    paddingY={1}
  >
    <text fg={props.selected ? activeTextColor : "#c4c4cf"} wrapMode="none">
      {props.selected ? ">>" : "  "} STEP {stepNumber(props.step.globalIndex)}  {truncate(firstBodyLine(props.step.body), 84)}
    </text>
    <text fg={props.selected ? "#93c5fd" : "#5f6070"} wrapMode="none">
      {anchorKindLabel(props.step.anchor)}  {props.step.flowTitle ? `${props.step.flowTitle} / ` : ""}{anchorLabel(props.step.anchor)}
    </text>
  </box>
);

const TopicBlock = (props: { readonly topic: DisplayTopic; readonly activeIndex: number }) => (
  <>
    <box border={["bottom"]} borderColor={borderColor} paddingX={2} paddingY={1} backgroundColor={raisedBg}>
      <text fg={accentColor} wrapMode="none"><b>TOPIC</b>  {props.topic.title}  [{props.topic.steps.length}]</text>
    </box>
    <For each={props.topic.steps}>{(step) => <StepRow step={step} selected={step.globalIndex === props.activeIndex} />}</For>
  </>
);

const CodeSegment = (props: {
  readonly content: string;
  readonly language: string;
  readonly selected?: boolean;
}) => (
  <Show when={props.content.length > 0}>
    <box
      backgroundColor={props.selected ? "#171720" : panelBg}
      border={props.selected ? ["left"] : false}
      borderColor="#facc15"
      paddingX={2}
    >
      <code
        content={props.content}
        filetype={props.language}
        syntaxStyle={props.selected ? focusedSyntaxStyle : contextSyntaxStyle}
      />
    </box>
  </Show>
);

const ReferencePane = (props: {
  readonly evidence: AnchorEvidence;
  readonly step: DisplayStep | undefined;
  readonly scrollRef: (scrollbox: ScrollBoxRenderable) => void;
}) => {
  const rangeText = () => `lines ${props.evidence.focusStartLine}-${props.evidence.focusEndLine}`;
  const stepText = () => props.step ? `Step ${stepNumber(props.step.globalIndex)}: ${truncate(firstBodyLine(props.step.body), 96)}` : "No active Step";

  return (
    <box flexGrow={1} maxWidth="60%" flexDirection="column" backgroundColor={panelBg}>
      <box flexDirection="column" height={7} border={["bottom"]} borderColor={borderColor} backgroundColor={raisedBg} paddingX={2} paddingY={1}>
        <text fg="#d4d4d8" wrapMode="none">
          {`REFERENCE  ${props.evidence.language.toUpperCase()}  ${props.evidence.fallback ?? "LIVE"}\n${props.evidence.title}\n${rangeText()} | Ctrl-D/Ctrl-U scroll\n${stepText()}`}
        </text>
      </box>
      <scrollbox
        ref={props.scrollRef}
        flexGrow={1}
        scrollY={true}
        scrollX={true}
        verticalScrollbarOptions={{ visible: true }}
        horizontalScrollbarOptions={{ visible: false }}
      >
        <CodeSegment content={props.evidence.before} language={props.evidence.language} />
        <CodeSegment content={props.evidence.focus} language={props.evidence.language} selected />
        <CodeSegment content={props.evidence.after} language={props.evidence.language} />
      </scrollbox>
    </box>
  );
};

const App = (props: {
  readonly explanation: Explanation;
  readonly files: LoadedFileMap;
  readonly explanationPath: string;
  readonly onExit: () => void;
}) => {
  const dimensions = useTerminalDimensions();
  const [detailLevel, setDetailLevel] = createSignal<DetailLevel>(
    clampDetailLevel(props.explanation.defaultDetailLevel ?? defaultDetailLevel),
  );
  const [activeIndex, setActiveIndex] = createSignal(0);
  let navScrollRef: ScrollBoxRenderable | undefined;
  let referenceScrollRef: ScrollBoxRenderable | undefined;

  const displayTopics = createMemo(() => collectDisplayTopics(props.explanation, detailLevel()));
  const displaySteps = createMemo(() => displayTopics().flatMap((topic) => topic.steps));
  const stepOffsets = createMemo(() => {
    const offsets: number[] = [];
    let offset = 0;

    for (const topic of displayTopics()) {
      offset += 3;
      for (const step of topic.steps) {
        offsets[step.globalIndex] = offset;
        offset += 4;
      }
    }

    return offsets;
  });
  const activeStep = createMemo(() => displaySteps()[activeIndex()]);
  const activeEvidence = createMemo(() => buildAnchorEvidence(activeStep()?.anchor, props.files));
  const navHeight = createMemo(() => Math.max(1, dimensions().height - 12));
  const pageScrollAmount = createMemo(() => Math.max(4, Math.floor(dimensions().height * 0.5)));

  const moveStep = (delta: number) => {
    setActiveIndex((current) => Math.min(Math.max(0, current + delta), Math.max(0, displaySteps().length - 1)));
  };

  const moveDetailLevel = (delta: number) => {
    setDetailLevel((current) => clampDetailLevel(current + delta));
  };

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) props.onExit();
    if (key.name === "j" || key.name === "down") moveStep(1);
    if (key.name === "k" || key.name === "up") moveStep(-1);
    if (key.name === "+" || key.name === "=") moveDetailLevel(1);
    if (key.name === "-") moveDetailLevel(-1);
    if (key.ctrl && key.name === "d") referenceScrollRef?.scrollBy(pageScrollAmount());
    if (key.ctrl && key.name === "u") referenceScrollRef?.scrollBy(-pageScrollAmount());
  });

  createEffect(() => {
    const maxIndex = Math.max(0, displaySteps().length - 1);
    if (activeIndex() > maxIndex) setActiveIndex(maxIndex);
  });

  createEffect(() => {
    navScrollRef?.scrollTo(Math.max(0, (stepOffsets()[activeIndex()] ?? 0) - Math.floor(navHeight() / 2) + 2));
  });

  createEffect(() => {
    const evidence = activeEvidence();
    referenceScrollRef?.scrollTo(Math.max(0, evidence.focusStartLine - 4));
  });

  return (
    <box flexGrow={1} flexDirection="row" backgroundColor={appBg}>
      <box flexGrow={1} maxWidth="40%" flexDirection="column" border={["right"]} borderColor={borderColor} backgroundColor={panelBg}>
        <box flexDirection="column" height={7} border={["bottom"]} borderColor={borderColor} backgroundColor={raisedBg} paddingX={2} paddingY={1}>
          <text fg="#e4e4e7" wrapMode="none">
            {`ELIC BETA\n${props.explanation.title}\n${props.explanation.description}\n${props.explanationPath}`}
          </text>
        </box>
        <scrollbox
          ref={(scrollbox) => {
            navScrollRef = scrollbox;
          }}
          flexGrow={1}
          maxHeight={navHeight()}
          verticalScrollbarOptions={{ visible: false }}
        >
          <Show when={displayTopics().length > 0} fallback={<box paddingX={2} paddingY={1}><text fg="#fca5a5">No Steps at this Detail Level.</text></box>}>
            <For each={displayTopics()}>{(topic) => <TopicBlock topic={topic} activeIndex={activeIndex()} />}</For>
          </Show>
        </scrollbox>
        <box flexDirection="column" height={5} border={["top"]} borderColor={borderColor} backgroundColor={mutedBg} paddingX={2} paddingY={1}>
          <text fg="#d4d4d8" wrapMode="none">
            {`Detail [${detailMeter(detailLevel())}] ${detailLevelNames[detailLevel()]} (${detailLevel()})  +/-\nStep [${progressMeter(activeIndex(), displaySteps().length)}] ${displaySteps().length > 0 ? activeIndex() + 1 : 0}/${displaySteps().length}  j/k | Ctrl-D/U | q`}
          </text>
        </box>
      </box>
      <ReferencePane
        evidence={activeEvidence()}
        step={activeStep()}
        scrollRef={(scrollbox) => {
          referenceScrollRef = scrollbox;
        }}
      />
    </box>
  );
};

export const runTui = (explanationPath: string) => Effect.scoped(
  Effect.gen(function* () {
    const invocationRoot = resolve(process.env.ELIC_REPO_ROOT ?? process.cwd());
    const resolvedExplanationPath = resolve(invocationRoot, explanationPath);
    const repoRoot = yield* Effect.promise(() => findRepoRoot(resolvedExplanationPath, invocationRoot));
    const explanation = yield* loadExplanation(resolvedExplanationPath).pipe(Effect.provide(NodeExplanationFileSystemLive));
    const files = yield* loadAnchorFiles(explanation, repoRoot);

    const renderer = yield* Effect.acquireRelease(
      Effect.promise(() =>
        createCliRenderer({
          exitOnCtrlC: false,
          exitSignals: [],
          openConsoleOnError: false,
        }),
      ),
      (renderer) =>
        Effect.promise(async () => {
          if (!renderer.isDestroyed) renderer.destroy();
          await nextMicrotask();
        }),
    );

    yield* Effect.promise(() =>
      render(() => <App explanation={explanation} files={files} explanationPath={explanationPath} onExit={() => renderer.destroy()} />, renderer),
    );
    yield* waitForDestroy(renderer);
  }),
);

const runTuiFromProcess = Effect.gen(function* () {
  const explanationPath = process.argv[2];
  if (!explanationPath) {
    return yield* Effect.fail(new Error("Usage: bun run tui-beta <path/to/file.explanation.json>"));
  }

  yield* runTui(explanationPath);
});

if (import.meta.main) {
  Effect.runPromise(runTuiFromProcess).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
