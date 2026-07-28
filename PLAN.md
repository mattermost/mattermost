# AI-Driven i18n Overhaul — v12

This plan has been split into focused documents under [`plan/`](./plan/).

**Start here:** [`plan/summary.md`](./plan/summary.md)

| Step | Doc |
|------|-----|
| Overview | [plan/summary.md](./plan/summary.md) |
| 1. Lock locales / normalize / validators | [plan/step-1.md](./plan/step-1.md) |
| 2. Bulk AI translation + review | [plan/step-2.md](./plan/step-2.md) |
| 3. Author workflow + CI gates | [plan/step-3.md](./plan/step-3.md) |
| 4. Sunset Weblate | [plan/step-4.md](./plan/step-4.md) |
| 5. Correction workflow | [plan/step-5.md](./plan/step-5.md) |
| 6. Docs / tooling cleanup | [plan/step-6.md](./plan/step-6.md) |

The split incorporates a verification pass that challenged several
previously "locked" decisions (Calls/Playbooks locale drops,
back-translation-only review, FormatJS `--extra-keys`, Weblate overlap,
etc.). See each step's **Challenges** section and the summary decision
table.
