import type { NormalizedTour } from "@tourguide/core";

export type TourFile = {
  path: string;
  title: string;
  goal?: string | undefined;
  description?: string | undefined;
};

export type LoadedTour = {
  file: TourFile;
  tour: NormalizedTour;
};
