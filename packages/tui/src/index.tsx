import { BoxRenderable, RGBA, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { render, useKeyboard, useTimeline, useTerminalDimensions } from "@opentui/solid";
import { create } from "node:domain";
import { createEffect, createSignal, Show, untrack } from "solid-js";

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
const activeSectionColor = "#fff";
const inactiveSectionColor = "#aaa";

type Tour = {
  heading: string;
  topics: Array<{
    title: string;
    prevSections: number;
    sections: string[];
  }>;
};

const getTotalSections = (tour: Tour) =>
  tour.topics.reduce((count, topic) => count + topic.sections.length, 0);

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

const totalSections = getTotalSections(tour);

type DottedBoxProps = {
  height: number;
};

const getDottedRow = (width: number) =>
  Array.from({ length: width - 1 }, (_, index) => (index % 2 === 0 ? "·" : " ")).join("");

const DottedBox = (props: DottedBoxProps) => {
  let selfRef!: BoxRenderable;
  const [w, setW] = createSignal(0);

  return (
    <box
      ref={(ref) => {
        selfRef = ref;
      }}
      width={"100%"}
      border={["bottom", "right"]}
      customBorderChars={something2}
      borderColor={"#555"}
      onSizeChange={() => {
        setW(selfRef.width);
      }}
    >
      {Array.from({ length: props.height }, () => (
        <text wrapMode="none" fg={"#282828"}>
          {getDottedRow(w())}
        </text>
      ))}
    </box>
  );
};

const SectionBox = (props: {
  children: string;
  selected: boolean;
  refCapture: (ref: BoxRenderable) => void;
  onClick?: () => void;
}) => {
  const [hover, setHovered] = createSignal(false);

  return (
    <box
      ref={props.refCapture}
      border={["bottom", "right"]}
      customBorderChars={something2}
      borderColor={"#555"}
      paddingX={4}
      paddingY={1}
      onMouseOut={() => {
        setHovered(false);
      }}
      onMouseOver={() => {
        setHovered(true);
      }}
      onMouseUp={() => props.onClick?.()}
    >
      <text fg={props.selected || hover() ? activeSectionColor : inactiveSectionColor}>
        {props.children}
      </text>
    </box>
  );
};

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

const ANIM_DUR = 200;

const App = () => {
  const [activeSection, setActiveSectio] = createSignal(0);
  const [scrollPos, setScrollPos] = createSignal(0);
  const [debug, setDebug] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(true);
  const [sectionColorValues, setSectionColorValues] = createSignal(
    Array.from({ length: totalSections }, (_, index) =>
      index === 0 ? activeSectionColor : inactiveSectionColor,
    ),
  );
  const termDems = useTerminalDimensions();
  const scrollTimeline = useTimeline({ duration: ANIM_DUR, autoplay: false });

  const ref: BoxRenderable[] = [];
  let previousActiveSection = activeSection();

  let scrollRef!: ScrollBoxRenderable;

  useKeyboard((key) => {
    if (key.name === "=") {
      setCollapsed(!collapsed());
      let cur = activeSection();
      if (cur < getTotalSections(tour) - 1) {
        setActiveSectio(cur + 1);
      }
    }
    if (key.name === "j") {
      let cur = activeSection();
      if (cur < getTotalSections(tour) - 1) {
        setActiveSectio(cur + 1);
      }
    }
    if (key.name === "k") {
      let cur = activeSection();
      if (cur > 0) {
        setActiveSectio(cur - 1);
      }
    }
  });

  createEffect(() => {
    const currentSection = activeSection();
    const previousSection = previousActiveSection;
    const cur = ref[currentSection];
    if (!cur) return;

    const yInScrollContent = cur.screenY - scrollRef.content.screenY;
    const target = Math.max(
      0,
      yInScrollContent + Math.floor(cur.height / 2) - Math.floor(scrollRef.viewport.height / 2) - 1,
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
        duration: ANIM_DUR,
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
          <DottedBox height={27} />
          {tour.topics.map((topic, topicIndex) => (
            <>
              <TopicTitleBox>{topic.title}</TopicTitleBox>
              <Show when={collapsed()}>
                {topic.sections.map((section, index) => (
                  <SectionBox
                    selected={topic.prevSections + index === activeSection()}
                    onClick={() => {
                      setActiveSectio(topic.prevSections + index);
                    }}
                    refCapture={(sectionRef) => {
                      ref[topic.prevSections + index] = sectionRef;
                    }}
                  >
                    {section}
                  </SectionBox>
                ))}
              </Show>
            </>
          ))}
          <DottedBox height={30} />
        </scrollbox>
        <box
          border={["top", "right"]}
          customBorderChars={something3}
          borderColor={"#555"}
          paddingX={4}
        >
          <text>
            {activeSection() + 1}/{getTotalSections(tour)} {debug()}
          </text>
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
            content={`async function checkout(cartId: string): Promise<Order> {
  const cart = await getCart(cartId);
  const payment = await charge(cart);
  const shipment = await ship(payment);
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
