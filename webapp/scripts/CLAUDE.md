# CLAUDE: `webapp/scripts/`

## Purpose
- Node-based helpers for building, running, and maintaining the webapp (e.g., dev server orchestration, build pipelines, localization tooling).
- Invoked via `npm`/`make` targets—direct execution should be rare.

## Key Scripts
- `dev-server.mjs` – webpack-dev-server bootstrap; shares config with `make dev`.
- `run.mjs`, `build.mjs`, `dist` helpers – orchestrate multi-workspace builds and env wiring.
- `gen_lang_imports.mjs` – regenerates locale import lists.
- `update-versions.mjs`, `utils.mjs` – release automation bits.

## Guidelines
- Scripts should be idempotent and safe to run on CI and macOS/Linux dev machines.
- Prefer ES modules + top-level `await` already used in existing scripts.
- Keep configuration (ports, paths) sourced from `config.mk` or env vars instead of hard-coding.
- Log actionable errors; exit with non-zero codes so CI fails fast.
- When script behavior changes, update associated `Makefile` targets and `webapp/CLAUDE.md` command docs.

## References
- `config.mk`, root `Makefile`, and workspace `package.json` scripts to understand entry points.
- `webapp/STYLE_GUIDE.md → Automated style checking` for how scripts integrate with lint/test tooling.



