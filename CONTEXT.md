# ELIC Context

ELIC (Explain Like I Code) defines the language for Explanations that can be authored once and presented across Presentation Surfaces.

## Language

**Explanation**:
A portable artifact that organizes Topics, ordered Steps, and grounded Anchors for guided code understanding. An Explanation is the authored object, not the viewer session, rendered screen, or act of walking through code.
_Avoid_: Tour, walkthrough, explanation session, rendered explanation

**Explanation Goal**:
The author's reason for creating or later revising an Explanation, such as architecture overview, code path explanation, PR explanation, implementation summary, or debug diagnosis. An Explanation Goal is primarily LLM-facing maintenance intent; it does not define a different kind of Explanation or restrict which Steps, Flows, or Anchors may appear.
_Avoid_: Explanation type, explanation kind, artifact subtype

**Explanation Description**:
A concise user-facing summary of what an Explanation contains. Explanation Description helps users choose an Explanation on a Presentation Surface, while Explanation Goal captures why the Explanation was authored.
_Avoid_: Goal, intent, explanation type

**Topic**:
A named conceptual section of an Explanation that groups ordered Steps and Flows around one conceptual phase. A Topic has a title but no Markdown body; explanatory text belongs in Steps.
_Avoid_: Folder, category, sidebar section

**Flow**:
A contiguous ordered group of Steps inside one Topic that should be understood as one path, comparison, or tightly coupled sequence. A Flow has a title but no Markdown body; adjacent Steps in a Flow should be presentable together while Step remains the unit of next/previous navigation and each Step may have at most one Anchor; ordered Capture Observations may enrich a Flow when the Flow presents one captured runtime path.
_Avoid_: Topic, multi-anchor step, folder

**Step**:
One ordered unit within an Explanation. A Step advances the learner by one conceptual move through a Markdown body, has no separate title, and may have at most one grounded Anchor; normal next/previous navigation moves through Steps in order.
_Avoid_: Code section, anchor group, slide

**Detail Level**:
The amount of explanatory depth included while traversing an Explanation. ELIC uses four additive Detail Levels: Overview for the main path, Explore for important module or internal detail, Deep Dive for edge cases or deeper internals, and Trace for low-level ordered Capture Observations; an Explanation may recommend a starting Detail Level while an Explanation Session owns the active Detail Level.
_Avoid_: Granularity, depth setting, explanation type

**Anchor**:
The grounded evidence or concrete reference that a Step points at. An Anchor is the inspected target for the Step, not the Step body, note, or presentation layout.
_Avoid_: Step, note, pane, section

**Execution Capture**:
Recorded runtime evidence collected from an actual program execution without requiring source-code edits. An Execution Capture may enrich Anchors or Flows with observed values, Capture Observations, or timing, but it is not itself the authored Explanation or the capture instructions used to collect that evidence.
_Avoid_: Trace, log, instrumentation, debugger session, capture request

**Capture Observation**:
One targeted, source-located unit of runtime evidence inside an Execution Capture that records how code behaved at a function, branch, or meaningful execution point. A Capture Observation is not a Step; ordered Capture Observations may support a Flow while each Observation may align with a Step Anchor.
_Avoid_: Step, telemetry event, log line, generic event

**Explanation Session**:
One active viewing and navigation instance of an Explanation on a Presentation Surface. An Explanation Session contains transient state such as the current Step, active Detail Level, overlays, and scroll position.
_Avoid_: Explanation, artifact, explanation file

**Presentation Surface**:
An environment where an Explanation Session is shown to a user, such as a terminal, OpenCode, or web interface. A Presentation Surface is not the Explanation artifact and is not the act of rendering one screen.
_Avoid_: Viewer, renderer, package

**Active Surface**:
A Presentation Surface that ELIC intends to support as part of the current product language, currently terminal and OpenCode. Active Surfaces shape the required capabilities of Explanations and Explanation Sessions.
_Avoid_: Implemented surface, primary renderer

**Candidate Surface**:
A plausible future Presentation Surface that ELIC may support later. Candidate Surfaces may influence portability goals but do not define current ELIC requirements.
_Avoid_: Active surface, roadmap promise

**Legacy Adapter**:
A historical compatibility entry point that is not part of the active ELIC surface language. A Legacy Adapter may exist in the codebase without defining current Explanation, Explanation Session, or Presentation Surface capabilities.
_Avoid_: Presentation surface, active surface

## Example Dialogue

Dev: "Should this implementation summary be an Explanation?"

Domain expert: "Yes. If it is an authored artifact with Topics, Steps, and Anchors, it is an Explanation regardless of whether it teaches architecture, a PR, or a debug flow."

Dev: "Does choosing a PR goal mean every Step must use a diff Anchor?"

Domain expert: "No. The Explanation Goal explains why the Explanation exists; it does not create a separate Explanation type or constrain every Step."

Dev: "Should the Explanation picker show the Explanation Goal?"

Domain expert: "Usually no. The picker should show the Explanation Description because it summarizes what the user will see. The Explanation Goal preserves authoring intent."

Dev: "Does every one-off Explanation need an Explanation Goal?"

Domain expert: "No. Explanation Goal is useful when future authoring or revision needs the original intent; it is not required just to present the Explanation."

Dev: "Should I make one Topic per package?"

Domain expert: "Only if each package is a conceptual phase of the Explanation. A Topic groups meaning, not filesystem layout."

Dev: "Where should I put introductory text for a Topic or Flow?"

Domain expert: "Use the first Step in that Topic or Flow. Topics and Flows only title groups; Steps carry Markdown bodies."

Dev: "This call path crosses three files. Is that one Step?"

Domain expert: "No. Make it a Flow with adjacent Steps, one grounded Anchor per Step."

Dev: "Does a surface need to show every Step in a Flow at once?"

Domain expert: "No. A Flow requires adjacent Step relationships to be visible together, not necessarily the whole Flow at once."

Dev: "If I press next while viewing a Flow, do I move to the next Flow?"

Domain expert: "No. Next still moves to the next Step; the Flow only groups related Steps and may affect presentation."

Dev: "Should a sidebar or jump list require Step titles?"

Domain expert: "No. Higher-order navigation is Topic-oriented; Step traversal is the normal next/previous flow."

Dev: "Should I create a separate Explanation just to go deeper into one module?"

Domain expert: "Not necessarily. Use Detail Level when the deeper material belongs to the same Explanation but should only appear when the Explanation Session asks for more depth."

Dev: "Does Deep Dive replace the Overview path?"

Domain expert: "No. Detail Levels are additive, so deeper Steps and Flows add context without replacing the main path."

Dev: "Is Trace another name for an Execution Capture?"

Domain expert: "No. Trace is only the fourth Detail Level for low-level ordered Capture Observations; an Execution Capture is the recorded runtime evidence."

Dev: "This Explanation needs two code ranges. Should I put both on one Step?"

Domain expert: "No. Split it into adjacent Steps so each Step has at most one Anchor."

Dev: "Is the diff itself a Flow?"

Domain expert: "No. A diff is an Anchor target; use a Flow only when multiple adjacent Steps should be understood together."

Dev: "Should an Anchor have its own note explaining the code?"

Domain expert: "No. Put the prose in the Step body; the Anchor only identifies the grounded evidence."

Dev: "Can two Steps point at the same code range?"

Domain expert: "Yes. Reuse the same Anchor target when the same evidence supports different conceptual moves, such as revisiting a callsite for separate branches."

Dev: "Is a debugger breakpoint capture a Flow?"

Domain expert: "No. It is Execution Capture evidence that may enrich the Step or Flow being presented; the authored Flow still organizes Steps."

Dev: "Should ordered breakpoint hits become standalone Steps?"

Domain expert: "They may become Trace-level Steps inside a Flow when the Flow presents that captured runtime path; each Capture Observation still supports a Step rather than replacing the Step body."

Dev: "Are the debugger launch command and expressions to evaluate part of an Execution Capture?"

Domain expert: "No. Those are capture instructions owned by the capture workflow. The Execution Capture is the recorded evidence produced after the program actually ran."

Dev: "The user pressed next on the terminal surface. Did the Explanation change?"

Domain expert: "No. The Explanation Session changed; the Explanation artifact stayed the same."

Dev: "Is the Neovim plugin one of the Presentation Surfaces?"

Domain expert: "No. It may exist historically, but it is not part of the active ELIC surface language."

Dev: "Should the web interface block the current Explanation contract?"

Domain expert: "No. Web is a Candidate Surface, so it can inform portability goals without becoming an Active Surface requirement yet."
