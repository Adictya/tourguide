import type { BoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/solid";
import { createSignal } from "solid-js";

import { rowBorderChars } from "./borders.js";

export const getDottedRow = (width: number) =>
  Array.from({ length: Math.max(0, width - 1) }, (_, index) => (index % 2 === 0 ? "·" : " ")).join(
    "",
  );

export const DottedPanel = () => {
  let selfRef!: BoxRenderable;
  const [width, setWidth] = createSignal(0);
  const dimensions = useTerminalDimensions();

  return (
    <box
      ref={(ref) => {
        selfRef = ref;
      }}
      flexGrow={1}
      height="100%"
      onSizeChange={() => {
        setWidth(selfRef.width);
      }}
    >
      {Array.from({ length: Math.max(0, dimensions().height - 1) }, () => (
        <text wrapMode="none" fg="#282828">
          {getDottedRow(width())}
        </text>
      ))}
    </box>
  );
};

export const DottedBox = (props: { height: number; opacity?: string; border?: Array<"bottom" | "left" | "right" | "top"> }) => {
  let selfRef!: BoxRenderable;
  const [width, setWidth] = createSignal(0);

  return (
    <box
      ref={(ref) => {
        selfRef = ref;
      }}
      width="100%"
      border={props.border ?? ["left", "right"]}
      customBorderChars={rowBorderChars}
      borderColor="#555"
      onSizeChange={() => {
        setWidth(selfRef.width);
      }}
    >
      {Array.from({ length: props.height }, () => (
        <text wrapMode="none" fg={props.opacity !== undefined ? `#282828${props.opacity}` : "#282828"}>
          {getDottedRow(width())}
        </text>
      ))}
    </box>
  );
};
