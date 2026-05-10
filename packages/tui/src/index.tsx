import { RGBA, SyntaxStyle } from "@opentui/core";
import { render } from "@opentui/solid";

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

const App = () => {
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
            <b>INTRODUCTION TO EFFECT</b>
          </text>
        </box>
        <scrollbox
          flexGrow={1}
          verticalScrollbarOptions={{
            visible: false,
          }}
        >
          <DottedBox width={60} height={27} />
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
          >
            <text>WELCOME</text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Welcome to the Effect Institute. I'm <u>Kit</u> and I want to
              teach you Effect. But first, the briefest of tutorials. Pressing
              SPACE, as you may have discovered, will play or pause the current
              section. The ↑ and ↓ arrow keys will navigate between sections.
              When I finish this sentence, you'll claim a small greenish square
              to mark your progress, and then you can press SPACE to trigger the
              next section.{" "}
            </text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Wow. You actually did it. As a prize, you get more tutorial. The R
              key will restart the current section. And the ← and → arrow keys
              will jump backward and forward a couple of seconds.
            </text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
          >
            <text>TYPED ERRORS - BROKEN PROMISES</text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Behold! A checkout function returning a Promise{"<Order>"}.
              Internally, it calls three more async functions. What will happen
              when we call it? A Promise has but one type parameter: its success
              value. Here, that's the Order we hope to get. But can checkout
              fail? And if it does, how will it fail? Unfortunately, Promise is
              not very forthcoming in this regard.
            </text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Wow. You actually did it. As a prize, you get more tutorial. The R
              key will restart the current section. And the ← and → arrow keys
              will jump backward and forward a couple of seconds.
            </text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Wow. You actually did it. As a prize, you get more tutorial. The R
              key will restart the current section. And the ← and → arrow keys
              will jump backward and forward a couple of seconds.
            </text>
          </box>
          <box
            border={["bottom", "right"]}
            customBorderChars={something2}
            borderColor={"#555"}
            paddingX={4}
            paddingY={1}
          >
            <text>
              Wow. You actually did it. As a prize, you get more tutorial. The R
              key will restart the current section. And the ← and → arrow keys
              will jump backward and forward a couple of seconds.
            </text>
          </box>
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
