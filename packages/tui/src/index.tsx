import { render } from "@opentui/solid";
import { createResource, createSignal, Show } from "solid-js";

import { loadExplanation } from "./data/explanations.js";
import { Explanation } from "./explanation.js";
import { Home } from "./home.js";
import type { ExplanationFile } from "./types.js";

const App = () => {
  const [selectedExplanation, setSelectedExplanation] = createSignal<ExplanationFile>();
  const [loadedExplanation] = createResource(selectedExplanation, loadExplanation);

  return (
    <Show when={selectedExplanation()} fallback={<Home onSelectExplanation={setSelectedExplanation} />}>
      <Show when={loadedExplanation()} fallback={<box paddingX={2}><text>Loading explanation...</text></box>}>
        {(explanation) => <Explanation loadedExplanation={explanation()} onBack={() => setSelectedExplanation(undefined)} />}
      </Show>
    </Show>
  );
};

export function runTui() {
  render(App);
}

if (import.meta.main) runTui();
