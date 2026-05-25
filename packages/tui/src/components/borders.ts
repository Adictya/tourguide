export const borderChars = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┼",
  horizontal: "─",
  vertical: "│",
  topT: "┬",
  bottomT: "─",
  leftT: "├",
  rightT: "┤",
  cross: "┼",
};

export const rowBorderChars = { ...borderChars, bottomLeft: "├", bottomRight: "┤" };
export const headerBorderChars = { ...borderChars, bottomLeft: "├", bottomRight: "┤" };
export const footerBorderChars = { ...borderChars, topLeft: "├", topRight: "┤", bottomRight: "┘" };
