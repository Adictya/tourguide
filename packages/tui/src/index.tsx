import {
  BoxRenderable,
  RGBA,
  ScrollBoxRenderable,
  SyntaxStyle,
  Timeline,
} from "@opentui/core";
import {
  render,
  useKeyboard,
  useTerminalDimensions,
} from "@opentui/solid";
import { createEffect, createSignal } from "solid-js";

const something = {
  topLeft: "a",
  topRight: "b",
  bottomLeft: "c",
  bottomRight: "┼",
  horizontal: "─",
  vertical: "│",
  topT: "g",
  bottomT: "─",
  leftT: "i",
  rightT: "j",
  cross: "k",
};

const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#ff6b6b"), bold: true }, // red, bold
  string: { fg: RGBA.fromHex("#51cf66") }, // green
  comment: { fg: RGBA.fromHex("#868e96"), italic: true }, // gray, italic
  number: { fg: RGBA.fromHex("#ffd43b") }, // yellow
  default: { fg: RGBA.fromHex("#ffffff") }, // white
});

const something2 = { ...something, bottomRight: "┤" };
const something3 = { ...something, topRight: "┤" };

type Tour = {
  heading: string;
  topics: Array<{
    title: string;
    prevSections: number;
    sections: string[];
  }>;
};

const tour: Tour = {
  heading: "INTRODUCTION TO EFFECT",
  topics: [
    {
      prevSections: 0,
      title: "WELCOME",
      sections: [
        "Welcome to the Effect Institute. I'm <u>Kit</u> and I want to teach you Effect. But first, the briefest of tutorials. Pressing SPACE, as you may have discovered, will play or pause the current section. The ↑ and ↓ arrow keys will navigate between sections. When I finish this sentence, you'll claim a small greenish square to mark your progress, and then you can press SPACE to trigger the next section.",
        "Wow. You actually did it. As a prize, you get more tutorial. The R key will restart the current section. And the ← and → arrow keys will jump backward and forward a couple of seconds.",
      ],
    },
    {
      prevSections: 2,
      title: "TYPED ERRORS - BROKEN PROMISES",
      sections: [
        "Behold! A checkout function returning a Promise<Order>. Internally, it calls three more async functions. What will happen when we call it? A Promise has but one type parameter: its success value. Here, that's the Order we hope to get. But can checkout fail? And if it does, how will it fail? Unfortunately, Promise is not very forthcoming in this regard.",
        "Wow. You actually did it. As a prize, you get more tutorial. The R key will restart the current section. And the ← and → arrow keys will jump backward and forward a couple of seconds.",
        "Wow. You actually did it. As a prize, you get more tutorial. The R key will restart the current section. And the ← and → arrow keys will jump backward and forward a couple of seconds.",
        "Wow. You actually did it. As a prize, you get more tutorial. The R key will restart the current section. And the ← and → arrow keys will jump backward and forward a couple of seconds.",
      ],
    },
  ],
};

type DottedBoxProps = {
  width: number;
  height: number;
};

const getDottedRow = (width: number) =>
  Array.from({ length: width - 1 }, (_, index) =>
    index % 2 === 0 ? "·" : " ",
  ).join("");

const DottedBox = (props: DottedBoxProps) => {
  const row = () => getDottedRow(props.width);

  return (
    <box
      width={props.width}
      border={["bottom", "right"]}
      customBorderChars={something2}
      borderColor={"#555"}
    >
      {Array.from({ length: props.height }, () => (
        <text fg={"#282828"}>{row()}</text>
      ))}
    </box>
  );
};

const SectionBox = (props: {
  children: string;
  active: boolean;
  refCapture: (ref: BoxRenderable) => void;
}) => (
  <box
    ref={props.refCapture}
    border={["bottom", "right"]}
    customBorderChars={something2}
    borderColor={"#555"}
    paddingX={4}
    paddingY={1}
  >
    <text fg={props.active ? "#fff" : "#888"}>{props.children}</text>
  </box>
);

const TopicTitleBox = (props: { children: string }) => (
  <box
    border={["bottom", "right"]}
    customBorderChars={something2}
    borderColor={"#555"}
    paddingX={4}
  >
    <text>{props.children}</text>
  </box>
);

const App = () => {
  const [activeSection, setActiveSectio] = createSignal(0);
  const [scrollPos, setScrollPos] = createSignal(0);
  const termDems = useTerminalDimensions();

  const ref: BoxRenderable[] = [];

  let scrollRef!: ScrollBoxRenderable;

  useKeyboard((key) => {
    if (key.name === "j") {
      setActiveSectio(activeSection() + 1);
    }
    if (key.name === "k") {
      setActiveSectio(activeSection() - 1);
    }
  });

  createEffect(() => {
    const cur = ref[activeSection()];
    if (!cur) return;

    const yInScrollContent = cur.screenY - scrollRef.content.screenY;
    const target =
      yInScrollContent +
      Math.floor(cur.height / 2) -
      Math.floor(scrollRef.viewport.height / 2) -
      1;
    scrollRef.scrollTo(target);
    setScrollPos(target);
  });

  return (
    <box flexGrow={1} flexDirection="row">
      <box flexGrow={0.4} maxWidth={"40%"} justifyContent="space-between">
        <box
          border={["bottom", "right"]}
          alignItems="center"
          customBorderChars={something}
          borderColor={"#555"}
        >
          <text>
            <b>{tour.heading}</b>
          </text>
        </box>
        <scrollbox
          ref={scrollRef}
          flexGrow={1}
          verticalScrollbarOptions={{
            visible: false,
          }}
          maxHeight={termDems().height - 4}
        >
          <DottedBox width={60} height={27} />
          {tour.topics.map((topic, topicIndex) => (
            <>
              <TopicTitleBox>{topic.title}</TopicTitleBox>
              {topic.sections.map((section, index) => (
                <SectionBox
                  active={activeSection() === topic.prevSections + index}
                  refCapture={(sectionRef) => {
                    ref[topic.prevSections + index] = sectionRef;
                  }}
                >
                  {section}
                </SectionBox>
              ))}
            </>
          ))}
          <DottedBox width={60} height={30} />
        </scrollbox>
        <box
          border={["top", "right"]}
          customBorderChars={something3}
          borderColor={"#555"}
          paddingX={4}
        >
          <text>0/14</text>
        </box>
      </box>
      <box flexGrow={0.6} maxWidth={"60%"}>
        <box border={["bottom"]} borderColor={"#555"}>
          <text> </text>
        </box>
        <box justifyContent="center" flexGrow={1} paddingX={4}>
          <code
            syntaxStyle={syntaxStyle}
            filetype="typescript"
            content={`async function checkout ( cartId : string) : Promise < Order > {
  const cart = await getCart (cartId);
  const payment = await charge (cart);
  const shipment = await ship (payment);
  return shipment
}
`}
          />
        </box>
      </box>
    </box>
  );
};

render(App);
