# Role: engine-owner

Work-package role; no orchestrator task. The engine owner is a person or an agent session briefed to change the explorer: `explorer-proto/src/` and `explorer-proto/playwright.config.ts`. Everything the orchestrator needs from the engine is documented in `explorer-proto/src/README-engine.md`.

## Purpose

Keep discovery generic and honest: a bounded search over accessibility snapshots that finds a path to the declared checkpoints without being told where it is, then emits a repo-native spec whose assertions are the declared ones. Close the gaps the orchestrator lists (for example the engine reads no `explorer-charter/v2` yet).

## Inputs

- The work-package brief from the lead, `explorer-proto/src/README-engine.md`, the engine sources, and `explorer-proto/playwright.config.ts`.
- The schemas the engine must accept (`explorer-proto/v2/schemas/`) and the known gaps in `explorer-proto/v2/orchestrator/README.md`.
- The gate catalog (`explorer-proto/v2/gates/README.md`): the emitted spec must pass `static_spec` as written.

## Outputs

- Changes under `explorer-proto/src/` and `explorer-proto/playwright.config.ts` only, with the engine's own checks run and reported.
- A short note of what the search budget now includes (actions, replays, states, depth, wall clock) and which heuristic terms were added. Heuristic changes are disclosed with the discovery results they affect.

## Allowed tools

Read the repository, edit the paths above, run the engine's type check and guard checks that need no Docker, and run the orchestrator and gate selftests. A live engine run happens only when a person started the stack.

## Forbidden actions

- Putting a route, a click order, a link name, an expected string or a control label into `src/`.
- Tuning scores, fatigue or thresholds against a held-out feature, its goal text or its controls, or against a sealed route.
- Weakening the network guard or the containment, or changing the shared snapshot normaliser that committed outputs depend on (extend it for your own state keys instead).
- Deriving an expected value from an observed snapshot or from the seed manifest.
- Editing gates, policy, schemas, the bakeoff files, infra, or the orchestrator.
- Printing or measuring `MM_LICENSE` or any credential; downloading anything.

## Checklist

- [ ] Every heuristic term is journey-independent: it may use goal terms, observed checkpoint progress, novelty and depth, and nothing that names a control.
- [ ] A new generic term (a bonus for open containers, fatigue for repeated controls, a trajectory key in the state key) is documented with its reason, and the search budget is reported with every result.
- [ ] State keys are stable across fresh seeds: ids in permalinks, fixture slugs, seeded post times, unread and mention badges and presence text are normalised.
- [ ] A replay uses its own fresh fixture. Nothing is reused or reset between replays.
- [ ] Fixture setup reads back what it wrote (membership, preferences, viewed-last with zero message and mention counts) and fails setup instead of continuing.
- [ ] A budget-out writes nothing and reports where the search stopped. The emitter stops rather than invent a step or weaken a predicate.
- [ ] Emitted specs satisfy the static spec rules: hard assertions or marked soft ones within the timeout budget, exact role names for actions, a probe id on exact-name absence checks, ` unread` handled, declared labels, an objective comment.
- [ ] The guard and containment evidence is regenerated when the guard or the browser flags change, and the residual gap is stated.
- [ ] Accept `explorer-charter/v2` through the schema, not by copying its fields by hand.
- [ ] Output files hold no origin, port, id, password or timestamp.

## Failure modes seen in earlier pilots

- The emitted pilot specs used eight soft assertions at the 10 second expect timeout, which can exceed the 60 second test timeout and ends in a location-less timeout. See `explorer-proto/generated/pilot_01_mx_05.spec.ts` and `explorer-proto/v2/gates/README.md` (how the real emitted specs fare).
- The guard answers every document itself, and under it Chromium blocked the app's WebSocket; the oracles package added a browser flag as a workaround and left the decision to the engine owner. See `explorer-proto/v2/oracles/README.md` ("Harness artefact found") and `explorer-proto/v2/oracles/playwright.config.ts`.
- A plain repo-native spec cannot import the guard, and host-resolver rules cannot filter ports, so a second loopback origin on another port stays reachable. See `explorer-proto/src/journey_containment.ts` and `explorer-proto/sessions/auto-follow/generated/guard-journey-report.md`.
- Without a trajectory signature in the state key, saving a preference or firing a teammate event looked like the same state and the journey could not continue; fatigue and a container bonus were needed as generic additions. See `explorer-proto/src/README-engine.md` (heuristic search) and `explorer-proto/src/journey_score.ts`.
- The engine reads only the two v1 charter formats, so a live stage 5 is blocked for v2 charters. See `explorer-proto/v2/orchestrator/README.md` (Known gaps).
- Volatile sidebar badges split one logical view into several states until they were scrubbed from the state key. See `explorer-proto/src/journey_search.ts`.

## What you must NOT see

- QA notes and the sealed route of any journey you tune against (`explorer-proto/sessions/*/QA-NOTES.md`, any `reference-route` file).
- The bakeoff inputs for the held-out features and the pre-registered rules (`explorer-proto/v2/bakeoff/inputs/`, `explorer-proto/v2/bakeoff/rules.json`).
- `MM_LICENSE`, an environment dump, or any credential.

The wrapper refuses a task whose inputs match these (`roles/index.json`).
