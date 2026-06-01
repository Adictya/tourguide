import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";

import { loadExplanations } from "./data/explanations.js";
import { footerBorderChars, headerBorderChars, rowBorderChars } from "./components/borders.js";
import { DottedBox, DottedPanel } from "./components/layout.js";
import type { ExplanationFile } from "./types.js";

const homeColumnWidth = 52;
const activeExplanationColor = "#fff";
const inactiveExplanationColor = "#aaa";

const ExplanationOption = (props: { explanation: ExplanationFile; selected: boolean; onClick: () => void }) => {
  const [hover, setHovered] = createSignal(false);
  const active = () => props.selected || hover();

  return (
    <box
      border={["bottom", "left", "right"]}
      customBorderChars={rowBorderChars}
      borderColor="#555"
      paddingX={4}
      paddingY={1}
      onMouseOut={() => {
        setHovered(false);
      }}
      onMouseOver={() => {
        setHovered(true);
      }}
      onMouseUp={props.onClick}
    >
      <text fg={active() ? activeExplanationColor : inactiveExplanationColor}>
        <b>{props.explanation.title}</b>
      </text>
      <text fg={active() ? "#ddd" : "#777"}>---</text>
      <text fg={active() ? "#ddd" : "#777"}>{props.explanation.description ?? props.explanation.goal ?? "No description"}</text>
      <text fg={active() ? "#ddd" : "#777"}>---</text>
      <text fg={active() ? "#93c5fd" : "#666"}>{props.explanation.path}</text>
    </box>
  );
};

export const Home = (props: { onSelectExplanation: (explanation: ExplanationFile) => void }) => {
  const [explanations] = createResource(loadExplanations);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const dimensions = useTerminalDimensions();
  let scrollRef!: ScrollBoxRenderable;
  const compactLogo = () => dimensions().height < 30;
  const headerHeight = () => (compactLogo() ? 5 : 14);
  const scrollHeight = () => Math.max(1, dimensions().height - headerHeight() - 1);
  const dottedHeight = createMemo(() => {
    const itemCount = Math.max(1, (explanations() ?? []).length);
    const fixedRows = 2 + itemCount * 5;
    return Math.max(1, Math.floor((scrollHeight() - fixedRows) / 2));
  });
  const selectCurrentExplanation = () => {
    const explanation = (explanations() ?? [])[selectedIndex()];
    if (explanation) props.onSelectExplanation(explanation);
  };

  useKeyboard((key) => {
    const items = explanations() ?? [];
    if (items.length === 0) return;

    if (key.name === "down" || key.name === "j") setSelectedIndex((index) => Math.min(index + 1, items.length - 1));
    if (key.name === "up" || key.name === "k") setSelectedIndex((index) => Math.max(index - 1, 0));
    if (key.name === "return" || key.name === "enter") selectCurrentExplanation();
  });

  createEffect(() => {
    if (!scrollRef) return;
    scrollRef.scrollTo(Math.max(0, dottedHeight() + 2 + selectedIndex() * 5 - Math.floor(scrollHeight() / 2) + 2));
  });

  return (
    <box flexGrow={1} flexDirection="row">
      <DottedPanel />
      <box width={homeColumnWidth} maxWidth="100%" justifyContent="space-between">
        <box border={["bottom", "left", "right"]} alignItems="center" customBorderChars={headerBorderChars} borderColor="#555" height={headerHeight()} paddingY={1}>
          <Show when={!compactLogo()} fallback={<ascii_font font="tiny" text="ELIC" />}>
            <ascii_font font="block" text="ELIC" />
          </Show>
        </box>
        <box border={["bottom", "left", "right"]} customBorderChars={rowBorderChars} borderColor="#555" paddingX={4}>
          <text fg="#888">Select an explanation with ↑/↓ or j/k, Enter to open</text>
        </box>
        <scrollbox ref={scrollRef} flexGrow={1} verticalScrollbarOptions={{ visible: false }} maxHeight={scrollHeight()}>
          <Show when={!explanations.loading} fallback={<ExplanationOption explanation={{ title: "Searching for explanations...", path: "" }} selected={false} onClick={() => {}} />}>
            <Show when={(explanations() ?? []).length > 0} fallback={<ExplanationOption explanation={{ title: "No .explanation.json files found", path: ". or ./explanations" }} selected={false} onClick={() => {}} />}>
              <For each={explanations()}>
                {(explanation, index) => (
                  <ExplanationOption
                    explanation={explanation}
                    selected={index() === selectedIndex()}
                    onClick={() => {
                      setSelectedIndex(index());
                      props.onSelectExplanation(explanation);
                    }}
                  />
                )}
              </For>
            </Show>
          </Show>
          <DottedBox height={dottedHeight()} opacity="00" />
        </scrollbox>
        <box border={["top", "left", "right", "bottom"]} customBorderChars={footerBorderChars} borderColor="#555" paddingX={4}>
          <text fg="#888">{(explanations() ?? []).length > 0 ? selectedIndex() + 1 : 0}/{(explanations() ?? []).length}</text>
        </box>
      </box>
      <DottedPanel />
    </box>
  );
};
