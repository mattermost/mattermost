# CLAUDE: `platform/components/` (`@mattermost/components`)

## Purpose
- Cross-product React components (GenericModal, tour tips, loaders, hooks) shared by Channels, Boards, Playbooks, and plugins.
- Ensures consistent UX, theming, and accessibility across Mattermost surfaces.

## Implementation Guidelines
- Follow `webapp/STYLE_GUIDE.md → React Component Structure`, `Styling & Theming`, `Accessibility`.
- Components must be framework-agnostic: accept data/handlers via props, avoid direct Redux or routing dependencies.
- Keep styles local via SCSS modules or styled components already used in this package; expose classNames for host overrides when necessary.
- Include Storybook/README snippets where helpful (see package README).

## Testing
- All components need RTL tests (`*.test.tsx`) demonstrating accessibility behaviors.
- Provide test utils (`testUtils.tsx`) for consumers who need to mock these components.

## Key Modules
- `generic_modal/` – baseline modal with focus trapping and keyboard handling.
- `tour_tip/` – coach marks with backdrop management.
- `skeleton_loader/`, `pulsating_dot/` – loading indicators.
- `hooks/` – shared hooks like `useFocusTrap`.

## Release Notes
- Breaking props or behavior requires updating `platform/components/README.md` and notifying dependent teams.

## References
- `generic_modal/generic_modal.tsx`, `tour_tip/tour_tip.tsx`, `hooks/useFocusTrap.test.tsx`.



