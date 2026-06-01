import { RGBA, type BoxRenderable, type ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions, useTimeline } from "@opentui/solid";
import type { Anchor, Explanation as ExplanationArtifact, Step } from "@elic/schema";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";

import { borderChars, rowBorderChars } from "./components/borders.js";
import { DottedBox } from "./components/layout.js";
import { loadExplanation, loadExplanations } from "./data/explanations.js";
import type { LoadedExplanation } from "./types.js";

const explanationHeaderBorderChars = { ...borderChars, topLeft: "┌", topRight: "┤" };
const explanationFooterBorderChars = { ...borderChars, topLeft: "├", topRight: "┤" };
const activeSectionColor = "#fff";
const inactiveSectionColor = "#aaa";
const animationDuration = 200;

type DisplayStep = Step & { readonly globalIndex: number };
type DisplayTopic = { readonly title: string; readonly steps: readonly DisplayStep[] };

const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#ff6b6b"), bold: true },
  string: { fg: RGBA.fromHex("#51cf66") },
  comment: { fg: RGBA.fromHex("#868e96"), italic: true },
  number: { fg: RGBA.fromHex("#ffd43b") },
  default: { fg: RGBA.fromHex("#ffffff") },
});

const SectionBox = (props: {
  step: DisplayStep;
  color: string;
  selected: boolean;
  refCapture: (ref: BoxRenderable) => void;
  onClick: () => void;
}) => {
  const [hover, setHovered] = createSignal(false);
  const active = () => props.selected || hover();

  return (
    <box
      ref={props.refCapture}
      border={["bottom", "right"]}
      customBorderChars={rowBorderChars}
      borderColor="#555"
      paddingX={4}
      paddingY={1}
      onMouseOut={() => setHovered(false)}
      onMouseOver={() => setHovered(true)}
      onMouseUp={props.onClick}
    >
      <text fg={active() ? activeSectionColor : props.color}>
        <b>Step {props.step.globalIndex + 1}</b>
      </text>
      <Show when={props.step.body}>
        {(body) => <text fg={active() ? "#ddd" : props.color}>{body()}</text>}
      </Show>
    </box>
  );
};

const TopicTitleBox = (props: { children: string }) => (
  <box border={["bottom", "right"]} customBorderChars={rowBorderChars} borderColor="#555" paddingX={4}>
    <text>{props.children}</text>
  </box>
);

const getAnchorContent = (anchor: Anchor | undefined) => {
  if (!anchor) return "No anchor selected for this step.";
  if (anchor.kind === "embeddedExcerpt") return anchor.content;
  if (anchor.kind === "fileRange") {
    return anchor.snapshot?.content ?? `${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}`;
  }
  return anchor.hunk.patch;
};

const getAnchorLanguage = (anchor: Anchor | undefined) => {
  if (!anchor) return "text";
  if (anchor.kind === "embeddedExcerpt") return anchor.language ?? "text";
  if (anchor.kind === "fileRange") return anchor.snapshot?.language ?? "text";
  return "diff";
};

const StepPreview = (props: { step: DisplayStep }) => {
  return (
    <box justifyContent="center" flexGrow={1} paddingX={4}>
      <Show when={props.step.body}>
        {(body) => <text fg="#ddd">{body()}</text>}
      </Show>
      <code syntaxStyle={syntaxStyle} filetype={getAnchorLanguage(props.step.anchor)} content={getAnchorContent(props.step.anchor)} />
    </box>
  );
};

const collectDisplayTopics = (explanation: ExplanationArtifact): readonly DisplayTopic[] => {
  let globalIndex = 0;

  return explanation.topics.map((topic) => {
    const steps: DisplayStep[] = [];

    for (const item of topic.items) {
      if (item.kind === "step") {
        steps.push({ ...item, globalIndex });
        globalIndex += 1;
        continue;
      }

      for (const step of item.steps) {
        steps.push({ ...step, globalIndex });
        globalIndex += 1;
      }
    }

    return { title: topic.title, steps };
  });
};

export const Explanation = (props: { loadedExplanation: LoadedExplanation; onBack: () => void }) => {
  const explanation = () => props.loadedExplanation.explanation;
  const displayTopics = createMemo(() => collectDisplayTopics(explanation()));
  const displaySteps = createMemo(() => displayTopics().flatMap((topic) => topic.steps));
  const [activeSection, setActiveSection] = createSignal(0);
  const [scrollPos, setScrollPos] = createSignal(0);
  const [collapsed, setCollapsed] = createSignal(true);
  const [sectionColorValues, setSectionColorValues] = createSignal<string[]>([]);
  const termDems = useTerminalDimensions();
  const scrollTimeline = useTimeline({ duration: animationDuration, autoplay: false });
  const refs: BoxRenderable[] = [];
  let previousActiveSection = activeSection();
  let scrollRef!: ScrollBoxRenderable;

  createEffect(() => {
    setSectionColorValues(
      Array.from({ length: displaySteps().length }, (_, index) =>
        index === activeSection() ? activeSectionColor : inactiveSectionColor,
      ),
    );
  });

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") props.onBack();
    if (key.name === "=") setCollapsed(!collapsed());
    if (key.name === "j" || key.name === "down") setActiveSection((current) => Math.min(current + 1, displaySteps().length - 1));
    if (key.name === "k" || key.name === "up") setActiveSection((current) => Math.max(current - 1, 0));
  });

  createEffect(() => {
    const currentSection = activeSection();
    const previousSection = previousActiveSection;
    const currentRef = refs[currentSection];
    if (!currentRef || !scrollRef) return;

    const yInScrollContent = currentRef.screenY - scrollRef.content.screenY;
    const target = Math.max(
      0,
      yInScrollContent + Math.floor(currentRef.height / 2) - Math.floor(scrollRef.viewport.height / 2) - 1,
    );

    scrollTimeline.pause();
    scrollTimeline.items = [];
    scrollTimeline.currentTime = 0;
    scrollTimeline.isComplete = false;
    scrollTimeline.once(
      {
        y: untrack(scrollPos),
        previousColor: untrack(sectionColorValues)[previousSection] ?? inactiveSectionColor,
        activeColor: untrack(sectionColorValues)[currentSection] ?? activeSectionColor,
      },
      {
        y: target,
        previousColor: inactiveSectionColor,
        activeColor: activeSectionColor,
        duration: animationDuration,
        ease: "outQuad",
        onUpdate(values) {
          const nextValues = values.targets[0];
          const next = Math.round(nextValues.y);
          scrollRef.scrollTo(next);
          setScrollPos(next);
          setSectionColorValues((colors) =>
            colors.map((color, index) => {
              if (index === previousSection) return nextValues.previousColor;
              if (index === currentSection) return nextValues.activeColor;
              return color;
            }),
          );
        },
        onComplete() {
          scrollRef.scrollTo(target);
          setScrollPos(target);
          setSectionColorValues((colors) =>
            colors.map((color, index) => {
              if (index === previousSection) return inactiveSectionColor;
              if (index === currentSection) return activeSectionColor;
              return color;
            }),
          );
        },
      },
    );
    previousActiveSection = currentSection;
    scrollTimeline.play();
  });

  return (
    <box flexGrow={1} flexDirection="row">
      <box flexGrow={0.4} maxWidth="40%" justifyContent="space-between">
        <box border={["bottom", "right"]} alignItems="center" customBorderChars={explanationHeaderBorderChars} borderColor="#555">
          <text><b>{explanation().title}</b></text>
        </box>
        <scrollbox ref={scrollRef} flexGrow={1} verticalScrollbarOptions={{ visible: false }} maxHeight={termDems().height - 4}>
          <DottedBox height={8} border={["bottom", "right"]} />
          <For each={displayTopics()}>
            {(topic) => (
              <>
                <TopicTitleBox>{topic.title}</TopicTitleBox>
                <Show when={collapsed()}>
                  <For each={topic.steps}>
                    {(step) => (
                      <SectionBox
                        step={step}
                        color={sectionColorValues()[step.globalIndex] ?? inactiveSectionColor}
                        selected={step.globalIndex === activeSection()}
                        onClick={() => setActiveSection(step.globalIndex)}
                        refCapture={(sectionRef) => {
                          refs[step.globalIndex] = sectionRef;
                        }}
                      />
                    )}
                  </For>
                </Show>
              </>
            )}
          </For>
          <DottedBox height={12} border={["bottom", "right"]} />
        </scrollbox>
        <box border={["top", "right"]} customBorderChars={explanationFooterBorderChars} borderColor="#555" paddingX={4}>
          <text>{activeSection() + 1}/{displaySteps().length} Esc back</text>
        </box>
      </box>
      <box flexGrow={0.6} maxWidth="60%">
        <box border={["bottom"]} borderColor="#555" paddingX={4}>
          <text>{displaySteps()[activeSection()] ? `Step ${activeSection() + 1}` : "No step"}</text>
        </box>
        <Show when={displaySteps()[activeSection()]}>
          {(step) => <StepPreview step={step()} />}
        </Show>
      </box>
    </box>
  );
};

if (import.meta.main) {
  const explanations = await loadExplanations();
  const firstExplanation = explanations[0];
  if (firstExplanation) {
    const loadedExplanation = await loadExplanation(firstExplanation);
    render(() => <Explanation loadedExplanation={loadedExplanation} onBack={() => {}} />);
  }
}
