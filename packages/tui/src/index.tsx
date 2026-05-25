import { render } from "@opentui/solid";
import { createResource, createSignal, Show } from "solid-js";

import { loadTour } from "./data/tours.js";
import { Home } from "./home.js";
import { Tour } from "./tour.js";
import type { TourFile } from "./types.js";

const App = () => {
  const [selectedTour, setSelectedTour] = createSignal<TourFile>();
  const [loadedTour] = createResource(selectedTour, loadTour);

  return (
    <Show when={selectedTour()} fallback={<Home onSelectTour={setSelectedTour} />}>
      <Show when={loadedTour()} fallback={<box paddingX={2}><text>Loading tour...</text></box>}>
        {(tour) => <Tour loadedTour={tour()} onBack={() => setSelectedTour(undefined)} />}
      </Show>
    </Show>
  );
};

render(App);
