import { RGBA, type BoxRenderable, type ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions, useTimeline } from "@opentui/solid";
import type { NormalizedAnchor, NormalizedStep } from "@tourguide/core";
import { createEffect, createSignal, For, Show, untrack } from "solid-js";

import { borderChars, rowBorderChars } from "./components/borders.js";
import { DottedBox } from "./components/layout.js";
import { loadTour, loadTours } from "./data/tours.js";
import type { LoadedTour } from "./types.js";

const tourHeaderBorderChars = { ...borderChars, topLeft: "┌", topRight: "┤" };
const tourFooterBorderChars = { ...borderChars, topLeft: "├", topRight: "┤" };
const activeSectionColor = "#fff";
const inactiveSectionColor = "#aaa";
const animationDuration = 200;

const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#ff6b6b"), bold: true },
  string: { fg: RGBA.fromHex("#51cf66") },
  comment: { fg: RGBA.fromHex("#868e96"), italic: true },
  number: { fg: RGBA.fromHex("#ffd43b") },
  default: { fg: RGBA.fromHex("#ffffff") },
});

const SectionBox = (props: {
  step: NormalizedStep;
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
        <b>{props.step.title}</b>
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

const getAnchorContent = (anchor: NormalizedAnchor | undefined) => {
  if (!anchor) return "No anchor selected for this step.";
  if (anchor.kind === "embeddedExcerpt") return anchor.content;
  if (anchor.kind === "fileRange") {
    return anchor.snapshot?.content ?? `${anchor.path}:${anchor.range.startLine}-${anchor.range.endLine}`;
  }
  return anchor.hunk.patch;
};

const getAnchorLanguage = (anchor: NormalizedAnchor | undefined) => {
  if (!anchor) return "text";
  if (anchor.kind === "embeddedExcerpt") return anchor.language ?? "text";
  if (anchor.kind === "fileRange") return anchor.snapshot?.language ?? "text";
  return "diff";
};

const StepPreview = (props: { step: NormalizedStep }) => {
  const primaryAnchor = () =>
    props.step.anchors.find((anchor) => anchor.id === props.step.primaryAnchorId) ?? props.step.anchors[0];

  return (
    <box justifyContent="center" flexGrow={1} paddingX={4}>
      <Show when={props.step.body}>
        {(body) => <text fg="#ddd">{body()}</text>}
      </Show>
      <code syntaxStyle={syntaxStyle} filetype={getAnchorLanguage(primaryAnchor())} content={getAnchorContent(primaryAnchor())} />
    </box>
  );
};

export const Tour = (props: { loadedTour: LoadedTour; onBack: () => void }) => {
  const tour = () => props.loadedTour.tour;
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
      Array.from({ length: tour().steps.length }, (_, index) =>
        index === activeSection() ? activeSectionColor : inactiveSectionColor,
      ),
    );
  });

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") props.onBack();
    if (key.name === "=") setCollapsed(!collapsed());
    if (key.name === "j" || key.name === "down") setActiveSection((current) => Math.min(current + 1, tour().steps.length - 1));
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
        <box border={["bottom", "right"]} alignItems="center" customBorderChars={tourHeaderBorderChars} borderColor="#555">
          <text><b>{tour().title}</b></text>
        </box>
        <scrollbox ref={scrollRef} flexGrow={1} verticalScrollbarOptions={{ visible: false }} maxHeight={termDems().height - 4}>
          <DottedBox height={8} border={["bottom", "right"]} />
          <For each={tour().topics}>
            {(topic) => (
              <>
                <TopicTitleBox>{topic.title}</TopicTitleBox>
                <Show when={collapsed()}>
                  <For each={topic.stepIds.map((stepId) => tour().steps.find((step) => step.id === stepId)).filter((step): step is NormalizedStep => step !== undefined)}>
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
        <box border={["top", "right"]} customBorderChars={tourFooterBorderChars} borderColor="#555" paddingX={4}>
          <text>{activeSection() + 1}/{tour().steps.length} Esc back</text>
        </box>
      </box>
      <box flexGrow={0.6} maxWidth="60%">
        <box border={["bottom"]} borderColor="#555" paddingX={4}>
          <text>{tour().steps[activeSection()]?.title ?? "No step"}</text>
        </box>
        <Show when={tour().steps[activeSection()]}>
          {(step) => <StepPreview step={step()} />}
        </Show>
      </box>
    </box>
  );
};

if (import.meta.main) {
  const tours = await loadTours();
  const firstTour = tours[0];
  if (firstTour) {
    const loadedTour = await loadTour(firstTour);
    render(() => <Tour loadedTour={loadedTour} onBack={() => {}} />);
  }
}
