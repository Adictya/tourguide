import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { normalizeTour } from "@tourguide/core";

import type { LoadedTour, TourFile } from "../types.js";

type RawTour = Parameters<typeof normalizeTour>[0];

const cwd = process.cwd();

const readTourDirectory = async (directory: string) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".tour.json"))
      .map((entry) => join(directory, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const parseTourSummary = (contents: string, filePath: string): TourFile => {
  try {
    const parsed = JSON.parse(contents) as {
      title?: unknown;
      id?: unknown;
      intent?: unknown;
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
      ...(typeof parsed.intent === "string" ? { intent: parsed.intent } : {}),
      ...(typeof parsed.description === "string" ? { description: parsed.description } : {}),
    };
  } catch {
    return {
      path: relative(cwd, filePath),
      title: basename(filePath),
      intent: "Invalid JSON",
    };
  }
};

export const loadTours = async (): Promise<TourFile[]> => {
  const files = Array.from(
    new Set([...(await readTourDirectory(cwd)), ...(await readTourDirectory(join(cwd, "tours")))]),
  ).sort();

  return Promise.all(
    files.map(async (filePath) => parseTourSummary(await readFile(filePath, "utf8"), filePath)),
  );
};

export const loadTour = async (tourFile: TourFile): Promise<LoadedTour> => {
  const filePath = resolve(cwd, tourFile.path);
  const rawTour = JSON.parse(await readFile(filePath, "utf8")) as RawTour;
  return {
    file: tourFile,
    tour: normalizeTour(rawTour),
  };
};
