# CLAUDE: `utils/`

## Purpose
- Shared helper functions, hooks, telemetry utilities, and adapters used across the Channels app.
- Keep business rules out of components/actions by moving reusable logic here.

## Organization
- Prefix folders by domain (`markdown/`, `popouts/`, `performance_telemetry/`, `a11y_*.ts`).
- Each utility should ship with unit tests (`*.test.ts`) demonstrating usage.
- Avoid sprawling “misc” files; create descriptive filenames or subfolders.

## Guidelines
- Strong typing required—prefer concrete interfaces over `any`. Reference `channels/src/types` or `@mattermost/types`.
- Keep utilities pure when possible. Side-effectful helpers (e.g., telemetry reporters) must document assumptions.
- Accessibility helpers (e.g., `a11y_controller.ts`) should follow `webapp/STYLE_GUIDE.md → Accessibility`.
- When a helper is generic and product-agnostic, consider relocating to `platform/components` or `platform/types`.

## Common Patterns
- Markdown processing (`markdown/*`) – ensure tests cover regressions and mention sanitization expectations.
- Telemetry (`performance_telemetry/*`) – isolate browser APIs behind guards for SSR/tests.
- Browser utilities (`desktop_api.ts`, `use_browser_popout.ts`) – handle feature detection gracefully.

## References
- `post_utils.ts`, `a11y_controller.ts`, `performance_telemetry/reporter.ts` – representative implementations.
- `webapp/STYLE_GUIDE.md → Standards Needing Refinement` (sanitization, handler placement, virtualized lists).



