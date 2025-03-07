# Mattermost Webapp Dev Guide

## Build Commands
- Build: `npm run build` or `make dist`
- Dev server: `npm run dev-server` or `make dev`
- Run app: `npm run run` or `make run`

## Testing Commands
- All tests: `npm test` or `make test`
- Single test: `npm test -- -t "test name pattern"`
- Watch mode: `npm run test:watch`
- Update snapshots: `npm run test:updatesnapshot`
- Debug tests: `npm run test:debug`

## Linting/Types
- Check style: `npm run check` or `make check-style`
- Fix style: `npm run fix` or `make fix-style`
- Check types: `npm run check-types` or `make check-types`

## Code Style
- Use TypeScript with strict mode
- Functional components with hooks preferred over class components
- Use React Testing Library (not Enzyme) for new tests
- PascalCase for components, camelCase for functions/variables
- 4-space indentation in SCSS files
- Follow ESLint rules (extends plugin:@mattermost/react)
- Use renderWithContext for tests needing Redux/Router/Intl providers