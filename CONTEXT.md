# TourGuide Context

TourGuide defines the language for guided explanations that can be authored once and presented across Presentation Surfaces.

## Language

**Tour**:
A portable artifact that organizes one guided explanation into topics, ordered steps, and grounded anchors. A Tour is the authored object, not the viewer session, rendered screen, or act of walking through code.
_Avoid_: Walkthrough, tour session, rendered tour

**Tour Goal**:
The author's reason for creating or later revising a Tour, such as architecture explanation, code path explanation, PR explanation, implementation summary, or debug diagnosis. A Tour Goal is primarily LLM-facing maintenance intent; it does not define a different kind of Tour or restrict which Steps, Flows, or Anchors may appear.
_Avoid_: Tour type, tour kind, artifact subtype

**Tour Description**:
A concise user-facing summary of what a Tour contains. Tour Description helps users choose a Tour on a Presentation Surface, while Tour Goal captures why the Tour was authored.
_Avoid_: Goal, intent, tour type

**Topic**:
A named conceptual section of a Tour that groups ordered Steps and Flows around one phase of the explanation. A Topic has a title but no Markdown body; explanatory text belongs in Steps.
_Avoid_: Folder, category, sidebar section

**Flow**:
A contiguous ordered group of Steps inside one Topic that should be understood as one path, comparison, or tightly coupled sequence. A Flow has a title but no Markdown body; adjacent Steps in a Flow should be presentable together while Step remains the unit of next/previous navigation and each Step may have at most one Anchor.
_Avoid_: Topic, multi-anchor step, folder

**Step**:
One ordered unit of explanation within a Topic. A Step advances the learner by one conceptual move through a Markdown body, has no separate title, and may have at most one grounded Anchor; normal next/previous navigation moves through Steps in order.
_Avoid_: Code section, anchor group, slide

**Detail Level**:
The amount of explanatory depth included while traversing a Tour. TourGuide uses three additive Detail Levels: Overview for the main path, Explore for important module or internal detail, and Deep Dive for edge cases, supporting evidence, or deeper internals; a Tour may recommend a starting Detail Level while a Tour Session owns the active Detail Level.
_Avoid_: Granularity, depth setting, tour type

**Anchor**:
The grounded evidence or concrete reference that a Step points at. An Anchor is the inspected target for the Step, not the Step's explanation, note, or presentation layout.
_Avoid_: Step, note, pane, section

**Execution Capture**:
Recorded runtime evidence collected from an actual program execution without requiring source-code edits. An Execution Capture may enrich Anchors or Flows with observed values, events, or timing, but it is not itself the authored explanation or the capture instructions used to collect that evidence.
_Avoid_: Trace, log, instrumentation, debugger session, capture request

**Tour Session**:
One active viewing and navigation instance of a Tour on a Presentation Surface. A Tour Session contains transient state such as the current Step, active Detail Level, overlays, and scroll position.
_Avoid_: Tour, artifact, tour file

**Presentation Surface**:
An environment where a Tour Session is shown to a user, such as a terminal, OpenCode, or web interface. A Presentation Surface is not the Tour artifact and is not the act of rendering one screen.
_Avoid_: Viewer, renderer, package

**Active Surface**:
A Presentation Surface that TourGuide intends to support as part of the current product language, currently terminal and OpenCode. Active Surfaces shape the required capabilities of Tours and Tour Sessions.
_Avoid_: Implemented surface, primary renderer

**Candidate Surface**:
A plausible future Presentation Surface that TourGuide may support later. Candidate Surfaces may influence portability goals but do not define current TourGuide requirements.
_Avoid_: Active surface, roadmap promise

**Legacy Adapter**:
A historical compatibility entry point that is not part of the active TourGuide surface language. A Legacy Adapter may exist in the codebase without defining current Tour, Tour Session, or Presentation Surface capabilities.
_Avoid_: Presentation surface, active surface

## Example Dialogue

Dev: "Should this implementation summary be a Tour?"

Domain expert: "Yes. If it is an authored guided explanation with topics, steps, and anchors, it is a Tour regardless of whether it teaches architecture, a PR, or a debug flow."

Dev: "Does choosing a PR goal mean every Step must use a diff Anchor?"

Domain expert: "No. The Tour Goal explains why the Tour exists; it does not create a separate Tour type or constrain every Step."

Dev: "Should the tour picker show the Tour Goal?"

Domain expert: "Usually no. The picker should show the Tour Description because it summarizes what the user will see. The Tour Goal preserves authoring intent."

Dev: "Does every one-off Tour need a Tour Goal?"

Domain expert: "No. Tour Goal is useful when future authoring or revision needs the original intent; it is not required just to present the Tour."

Dev: "Should I make one Topic per package?"

Domain expert: "Only if each package is a conceptual phase of the explanation. A Topic groups meaning, not filesystem layout."

Dev: "Where should I put introductory text for a Topic or Flow?"

Domain expert: "Use the first Step in that Topic or Flow. Topics and Flows only title groups; Steps carry Markdown explanations."

Dev: "This call path crosses three files. Is that one Step?"

Domain expert: "No. Make it a Flow with adjacent Steps, one grounded Anchor per Step."

Dev: "Does a surface need to show every Step in a Flow at once?"

Domain expert: "No. A Flow requires adjacent Step relationships to be visible together, not necessarily the whole Flow at once."

Dev: "If I press next while viewing a Flow, do I move to the next Flow?"

Domain expert: "No. Next still moves to the next Step; the Flow only groups related Steps and may affect presentation."

Dev: "Should a sidebar or jump list require Step titles?"

Domain expert: "No. Higher-order navigation is Topic-oriented; Step traversal is the normal next/previous flow."

Dev: "Should I create a separate Tour just to go deeper into one module?"

Domain expert: "Not necessarily. Use Detail Level when the deeper explanation belongs to the same guided explanation but should only appear when the Tour Session asks for more depth."

Dev: "Does Deep Dive replace the Overview explanation?"

Domain expert: "No. Detail Levels are additive, so deeper Steps and Flows add context without replacing the main path."

Dev: "This explanation needs two code ranges. Should I put both on one Step?"

Domain expert: "No. Split it into adjacent Steps so each Step has at most one Anchor."

Dev: "Is the diff itself a Flow?"

Domain expert: "No. A diff is an Anchor target; use a Flow only when multiple adjacent Steps should be understood together."

Dev: "Should an Anchor have its own note explaining the code?"

Domain expert: "No. Put the explanation in the Step body; the Anchor only identifies the grounded evidence."

Dev: "Can two Steps point at the same code range?"

Domain expert: "Yes. Reuse the same Anchor target when the same evidence supports different conceptual moves, such as revisiting a callsite for separate branches."

Dev: "Is a debugger breakpoint capture a Flow?"

Domain expert: "No. It is Execution Capture evidence that may enrich the Step or Flow being presented; the authored Flow still organizes Steps."

Dev: "Are the debugger launch command and expressions to evaluate part of an Execution Capture?"

Domain expert: "No. Those are capture instructions owned by the capture workflow. The Execution Capture is the recorded evidence produced after the program actually ran."

Dev: "The user pressed next on the terminal surface. Did the Tour change?"

Domain expert: "No. The Tour Session changed; the Tour artifact stayed the same."

Dev: "Is the Neovim plugin one of the Presentation Surfaces?"

Domain expert: "No. It may exist historically, but it is not part of the active TourGuide surface language."

Dev: "Should the web interface block the current Tour contract?"

Domain expert: "No. Web is a Candidate Surface, so it can inform portability goals without becoming an Active Surface requirement yet."
