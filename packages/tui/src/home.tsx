import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";

import { loadTours } from "./data/tours.js";
import { footerBorderChars, headerBorderChars, rowBorderChars } from "./components/borders.js";
import { DottedBox, DottedPanel } from "./components/layout.js";
import type { TourFile } from "./types.js";

const homeColumnWidth = 52;
const activeTourColor = "#fff";
const inactiveTourColor = "#aaa";

const TourOption = (props: { tour: TourFile; selected: boolean; onClick: () => void }) => {
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
      <text fg={active() ? activeTourColor : inactiveTourColor}>
        <b>{props.tour.title}</b>
      </text>
      <text fg={active() ? "#ddd" : "#777"}>---</text>
      <text fg={active() ? "#ddd" : "#777"}>{props.tour.description ?? props.tour.goal ?? "No description"}</text>
      <text fg={active() ? "#ddd" : "#777"}>---</text>
      <text fg={active() ? "#93c5fd" : "#666"}>{props.tour.path}</text>
    </box>
  );
};

export const Home = (props: { onSelectTour: (tour: TourFile) => void }) => {
  const [tours] = createResource(loadTours);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const dimensions = useTerminalDimensions();
  let scrollRef!: ScrollBoxRenderable;
  const compactLogo = () => dimensions().height < 30;
  const headerHeight = () => (compactLogo() ? 5 : 14);
  const scrollHeight = () => Math.max(1, dimensions().height - headerHeight() - 1);
  const dottedHeight = createMemo(() => {
    const itemCount = Math.max(1, (tours() ?? []).length);
    const fixedRows = 2 + itemCount * 5;
    return Math.max(1, Math.floor((scrollHeight() - fixedRows) / 2));
  });
  const selectCurrentTour = () => {
    const tour = (tours() ?? [])[selectedIndex()];
    if (tour) props.onSelectTour(tour);
  };

  useKeyboard((key) => {
    const items = tours() ?? [];
    if (items.length === 0) return;

    if (key.name === "down" || key.name === "j") setSelectedIndex((index) => Math.min(index + 1, items.length - 1));
    if (key.name === "up" || key.name === "k") setSelectedIndex((index) => Math.max(index - 1, 0));
    if (key.name === "return" || key.name === "enter") selectCurrentTour();
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
          <Show when={!compactLogo()} fallback={<ascii_font font="tiny" text="TOUR GUIDE" />}>
            <ascii_font font="block" text="TOUR" />
            <ascii_font font="block" text="GUIDE" />
          </Show>
        </box>
        <box border={["bottom", "left", "right"]} customBorderChars={rowBorderChars} borderColor="#555" paddingX={4}>
          <text fg="#888">Select a tour with ↑/↓ or j/k, Enter to open</text>
        </box>
        <scrollbox ref={scrollRef} flexGrow={1} verticalScrollbarOptions={{ visible: false }} maxHeight={scrollHeight()}>
          <Show when={!tours.loading} fallback={<TourOption tour={{ title: "Searching for tours...", path: "" }} selected={false} onClick={() => {}} />}>
            <Show when={(tours() ?? []).length > 0} fallback={<TourOption tour={{ title: "No .tour.json files found", path: ". or ./tours" }} selected={false} onClick={() => {}} />}>
              <For each={tours()}>
                {(tour, index) => (
                  <TourOption
                    tour={tour}
                    selected={index() === selectedIndex()}
                    onClick={() => {
                      setSelectedIndex(index());
                      props.onSelectTour(tour);
                    }}
                  />
                )}
              </For>
            </Show>
          </Show>
          <DottedBox height={dottedHeight()} opacity="00" />
        </scrollbox>
        <box border={["top", "left", "right", "bottom"]} customBorderChars={footerBorderChars} borderColor="#555" paddingX={4}>
          <text fg="#888">{(tours() ?? []).length > 0 ? selectedIndex() + 1 : 0}/{(tours() ?? []).length}</text>
        </box>
      </box>
      <DottedPanel />
    </box>
  );
};
