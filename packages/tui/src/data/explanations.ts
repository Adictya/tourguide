import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import type { Explanation } from "@elic/schema";

import type { ExplanationFile, LoadedExplanation } from "../types.js";

const cwd = process.cwd();

const readExplanationDirectory = async (directory: string) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".explanation.json"))
      .map((entry) => join(directory, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const parseExplanationSummary = (contents: string, filePath: string): ExplanationFile => {
  try {
    const parsed = JSON.parse(contents) as {
      title?: unknown;
      id?: unknown;
      goal?: unknown;
      description?: unknown;
    };

    return {
      path: relative(cwd, filePath),
      title:
        typeof parsed.title === "string" && parsed.title.length > 0
          ? parsed.title
          : typeof parsed.id === "string" && parsed.id.length > 0
            ? parsed.id
            : basename(filePath),
      ...(typeof parsed.goal === "string" ? { goal: parsed.goal } : {}),
      ...(typeof parsed.description === "string" ? { description: parsed.description } : {}),
    };
  } catch {
    return {
      path: relative(cwd, filePath),
      title: basename(filePath),
      goal: "Invalid JSON",
    };
  }
};

export const loadExplanations = async (): Promise<ExplanationFile[]> => {
  const files = Array.from(
    new Set([
      ...(await readExplanationDirectory(join(cwd, ".elic", "explanations"))),
      ...(await readExplanationDirectory(cwd)),
      ...(await readExplanationDirectory(join(cwd, "explanations"))),
    ]),
  ).sort();

  return Promise.all(
    files.map(async (filePath) => parseExplanationSummary(await readFile(filePath, "utf8"), filePath)),
  );
};

export const loadExplanation = async (explanationFile: ExplanationFile): Promise<LoadedExplanation> => {
  const filePath = resolve(cwd, explanationFile.path);
  const explanation = JSON.parse(await readFile(filePath, "utf8")) as Explanation;
  return {
    file: explanationFile,
    explanation,
  };
};
