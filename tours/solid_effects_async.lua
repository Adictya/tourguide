return {
  id = "solid_effects_async",
  title = "Solid 2.0 Effects + Async Tour",
  root = os.getenv("TOURGUIDE_ROOT") or vim.fn.getcwd(),
  topics = {
    {
      title = "1. Why Split Effects",
      children = {
        {
          title = "Concept: compute before apply",
          markdown = [[
# Solid 2.0: Split Effects

The old single callback mixed two jobs:

- read reactive sources and discover dependencies
- mutate the outside world

Solid 2.0 separates them:

```ts
createEffect(
  () => source(),      // compute: tracked, may suspend
  value => doSideEffect(value) // apply: untracked, runs after flush
)
```

This lets the runtime discover all dependencies and pending async before any user side effect runs. That is the core reason this change exists.
]],
        },
        {
          title = "RFC rationale",
          file = "documentation/solid-2.0/01-reactivity-batching-effects.md",
          sections = {
            {
              range = { 5, 15 },
              note = "The RFC states the full motivation: stricter writes, top-level read warnings, microtask batching, and split effects for async and boundaries."
            },
            {
              range = { 97, 109 },
              note = "This is the API-level reason: compute records dependencies; effect runs after all compute phases in the batch."
            },
            {
              range = { 273, 276 },
              note = "The single-callback default was explicitly rejected for async and boundary semantics."
            }
          }
        }
      }
    },
    {
      title = "2. Public API Surface",
      children = {
        {
          title = "Effect types and public wrapper",
          file = "packages/solid-signals/src/signals.ts",
          sections = {
            {
              range = { 128, 138 },
              note = "ComputeFunction and EffectFunction encode the split: compute returns the value; effect consumes it and may return cleanup."
            },
            {
              range = { 315, 330 },
              note = "The docs on the public createEffect API tell users where reactive reads and imperative writes belong."
            },
            {
              range = { 365, 404 },
              note = "createEffect rejects the old single-argument form in dev and forwards compute/apply/error into the core effect primitive."
            },
            {
              range = { 435, 445 },
              note = "createRenderEffect uses the same split primitive but without user scheduling; it is for renderer-level synchronous work."
            },
            {
              range = { 477, 484 },
              note = "createTrackedEffect preserves the single-callback shape only as an explicit advanced escape hatch."
            }
          }
        }
      }
    },
    {
      title = "3. Internal Effect Node",
      children = {
        {
          title = "effect() creates a lazy computed",
          file = "packages/solid-signals/src/core/effect.ts",
          sections = {
            {
              range = { 18, 25 },
              note = "An Effect is both a Computed node and an Owner, with storage for apply callback, cleanup, previous value, and queue type."
            },
            {
              range = { 32, 48 },
              note = "effect() wraps the compute half in computed(..., { lazy: true }). Its equals hook marks the node modified and enqueues runEffect."
            },
            {
              range = { 49, 56 },
              note = "The apply/error callbacks and effect queue type are stored on the computed node."
            },
            {
              range = { 95, 101 },
              note = "Creation recomputes the compute phase immediately, then schedules or runs the apply phase unless defer is set."
            },
            {
              range = { 118, 142 },
              note = "runEffect is the apply half: cleanup old side effect, run _effectFn(value, prev), store returned cleanup, then commit prevValue."
            }
          }
        },
        {
          title = "Status handling from effect nodes",
          file = "packages/solid-signals/src/core/effect.ts",
          sections = {
            {
              range = { 55, 94 },
              note = "Effect nodes customize _notifyStatus so async pending/errors are either surfaced to user error handlers or propagated to boundary queues."
            }
          }
        }
      }
    },
    {
      title = "4. Compute Phase",
      children = {
        {
          title = "recompute() runs tracked compute",
          file = "packages/solid-signals/src/core/core.ts",
          sections = {
            {
              range = { 143, 183 },
              note = "recompute sets context to the computed node and enables tracking before invoking the compute function."
            },
            {
              range = { 205, 219 },
              note = "The compute function runs here. Its result is routed through handleAsync unless the computation registered async internally."
            },
            {
              range = { 220, 239 },
              note = "NotReadyError marks the node pending and propagates status instead of treating pending async as a normal value."
            },
            {
              range = { 246, 282 },
              note = "After successful compute, dependencies are reconciled and changed values notify subscribers via insertSubs."
            }
          }
        },
        {
          title = "Effect creation next to recompute",
          layout = "vertical",
          flow = true,
          panes = {
            {
              file = "packages/solid-signals/src/core/effect.ts",
              sections = {
                { range = { 32, 48 }, note = "effect() builds a computed node around the compute half." }
              }
            },
            {
              file = "packages/solid-signals/src/core/core.ts",
              sections = {
                { range = { 205, 214 }, note = "recompute invokes that compute half and hands its result to handleAsync." }
              }
            }
          }
        }
      }
    },
    {
      title = "5. Async Subpath",
      children = {
        {
          title = "handleAsync detects pending work",
          file = "packages/solid-signals/src/core/async.ts",
          sections = {
            {
              range = { 131, 147 },
              note = "handleAsync accepts the compute result and detects Promise-like values or AsyncIterables. Synchronous values pass through."
            },
            {
              range = { 200, 219 },
              note = "For unresolved Promises, Solid initializes a transition and throws NotReadyError from the compute path."
            },
            {
              range = { 221, 276 },
              note = "AsyncIterables follow the same model: if no synchronous value is available, throw NotReadyError and resume later."
            }
          }
        },
        {
          title = "Async resolution writes back",
          file = "packages/solid-signals/src/core/async.ts",
          sections = {
            {
              range = { 149, 198 },
              note = "asyncWrite is the resume path. It ignores stale async results, commits the resolved value, settles pending sources, schedules and flushes."
            },
            {
              range = { 92, 129 },
              note = "settlePendingSource walks dependents that were blocked by this async source and reschedules them."
            },
            {
              range = { 292, 362 },
              note = "notifyStatus propagates pending/error state through dependents and boundary queues."
            }
          }
        }
      }
    },
    {
      title = "6. Scheduler And Flush",
      children = {
        {
          title = "Microtask scheduling",
          file = "packages/solid-signals/src/core/scheduler.ts",
          sections = {
            {
              range = { 208, 212 },
              note = "schedule() batches work onto a microtask unless a flush is already running."
            },
            {
              range = { 579, 595 },
              note = "flush() explicitly drains scheduled work and active transitions. This is why reads update after the batch, not immediately after setters."
            }
          }
        },
        {
          title = "Flush ordering",
          file = "packages/solid-signals/src/core/scheduler.ts",
          sections = {
            {
              range = { 299, 366 },
              note = "GlobalQueue.flush runs pure recomputation first, finalizes pending nodes, then runs render effects and user effects."
            },
            {
              range = { 100, 110 },
              note = "Lane effects only run when their lane has no pending async. This is where async prevents premature apply callbacks."
            },
            {
              range = { 474, 499 },
              note = "commitPendingNodes moves pending values into committed values and marks effect nodes modified before apply queues run."
            }
          }
        }
      }
    },
    {
      title = "7. Boundaries",
      children = {
        {
          title = "Boundary queue basics",
          file = "packages/solid-signals/src/boundaries.ts",
          sections = {
            {
              range = { 36, 49 },
              note = "boundaryComputed creates computed nodes with custom status propagation masks."
            },
            {
              range = { 51, 64 },
              note = "createBoundChildren runs a subtree under a child queue so pending/error status can be contained by a boundary."
            },
            {
              range = { 254, 260 },
              note = "CollectionQueue is the boundary queue type used to collect pending sources and coordinate reveal/loading state."
            }
          }
        },
        {
          title = "Public Loading component",
          file = "packages/solid/src/client/flow.ts",
          sections = {
            {
              range = { 284, 331 },
              note = "<Loading> is a thin component wrapper over createLoadingBoundary. Async pending is structural, not a resource.loading flag."
            }
          }
        },
        {
          title = "Hydration-aware createLoadingBoundary",
          file = "packages/solid/src/client/hydration.ts",
          sections = {
            {
              range = { 1328, 1334 },
              note = "On the client, createLoadingBoundary delegates to the core boundary unless hydration-specific serialized state must be resumed."
            },
            {
              range = { 1348, 1383 },
              note = "During hydration, serialized boundary state can force fallback until streamed or asset-backed async work resumes."
            }
          }
        }
      }
    },
    {
      title = "8. End-To-End Flow",
      children = {
        {
          title = "Call path summary",
          markdown = [[
# End-To-End Path

1. User calls `createEffect(compute, apply)`.
2. `signals.ts` forwards both functions to `effect()`.
3. `effect.ts` creates a lazy `computed` node for the compute phase.
4. `recompute()` sets tracking context and runs `compute(prev)`.
5. If compute returns a Promise or AsyncIterable, `handleAsync()` throws `NotReadyError` while registering pending work.
6. `notifyStatus()` propagates pending to dependents and boundaries.
7. `Loading`/boundary queues hold apply work while pending async exists.
8. When async resolves, `asyncWrite()` commits/reschedules and flushes.
9. Scheduler finalizes computed values, then runs `runEffect()`.
10. `runEffect()` executes `apply(value, prev)` untracked and stores cleanup.

The important invariant: side effects run after the graph has established dependencies and async readiness.
]],
        },
        {
          title = "Main implementation files together",
          layout = "vertical",
          flow = true,
          panes = {
            {
              file = "packages/solid-signals/src/core/effect.ts",
              sections = {
                { range = { 32, 48 }, note = "Create effect node." },
                { range = { 118, 142 }, note = "Apply side effect." }
              }
            },
            {
              file = "packages/solid-signals/src/core/async.ts",
              sections = {
                { range = { 131, 147 }, note = "Detect async." },
                { range = { 200, 219 }, note = "Suspend with NotReadyError." }
              }
            }
          }
        }
      }
    }
  }
}
