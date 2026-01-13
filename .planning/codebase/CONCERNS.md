# Codebase Concerns

**Analysis Date:** 2026-01-13

## Tech Debt

**SQL Query Builder Migration:**
- Issue: Legacy SQL string construction instead of Squirrel query builder
- Files: `server/channels/store/sqlstore/post_store.go` (lines 524, 2275, 2386)
- Why: Legacy code predates Squirrel adoption
- Impact: Harder to maintain, potential SQL injection if not careful
- Fix approach: Convert queries to Squirrel builder pattern

**Large Monolithic Files:**
- Issue: Several files exceed reasonable size limits
- Files:
  - `server/channels/store/retrylayer/retrylayer.go` - 17,617 lines (generated)
  - `server/channels/store/timerlayer/timerlayer.go` - 14,047 lines (generated)
  - `server/public/model/config.go` - 5,401 lines
  - `webapp/channels/src/components/admin_console/admin_definition.tsx` - 6,357 lines
  - `webapp/platform/client/src/client4.ts` - 4,865 lines
- Why: Organic growth, generated code
- Impact: Difficult to navigate, slow IDE performance
- Fix approach: Modularize config.go and admin_definition.tsx

**TypeScript Type Safety:**
- Issue: 307+ instances of `.any` type or weak typing
- Files: Scattered throughout `webapp/channels/src/` and `webapp/platform/`
- Why: Legacy code, quick fixes
- Impact: Reduced type safety, potential runtime errors
- Fix approach: Gradually replace `any` with proper types

**Redux Type Definitions:**
- Issue: Duplicate type definitions between packages
- Files: `webapp/platform/types/src/plugins.ts` (lines 120, 127, 132, 138, 144)
- Why: Migration from mattermost-redux incomplete
- Impact: Maintenance burden, potential inconsistencies
- Fix approach: Consolidate types after mattermost-redux migration

## Known Bugs

**E2E Test Defect:**
- Symptoms: Test for author-deletes-message-before-review fails
- Trigger: Content flagging edge case
- File: `e2e-tests/playwright/specs/functional/channels/content_flagging/edge-cases/author-deletes-message-before-review.spec.ts`
- Workaround: Test marked with TODO
- Root cause: Referenced in Jira MM-66342
- Blocked by: Needs defect fix

## Security Considerations

**SQL Parameterization Review:**
- Risk: `UpdateMembersRole` function builds SQL with array
- File: `server/channels/store/sqlstore/channel_store.go` (line 4244)
- Current mitigation: Squirrel should handle parameterization
- Recommendations: Verify parameterization is complete, add test coverage

**Protocol Detection:**
- Risk: Browser redirect hardcodes "http://" protocol
- File: `server/channels/web/unsupported_browser.go` (line 153)
- Current mitigation: Most servers have HTTPS redirect
- Recommendations: Detect actual protocol from request or config

## Performance Bottlenecks

**Large Test Files:**
- Problem: Very large test files slow to execute and parse
- Files:
  - `server/channels/api4/user_test.go` - 9,354 lines
  - `server/channels/store/storetest/channel_store.go` - 8,442 lines
  - `server/channels/app/post_test.go` - 5,200 lines
- Measurement: Not quantified
- Cause: Tests not modularized by feature
- Improvement path: Split into smaller test files by feature area

**Transaction Scope:**
- Problem: Some operations keep transactions open longer than needed
- File: `server/channels/store/sqlstore/channel_store.go` (line 1866)
- Measurement: Not quantified
- Cause: TODO indicates awareness of issue
- Improvement path: Refactor to minimize transaction scope

**CTE Support:**
- Problem: Optimization blocked by MySQL version requirement
- File: `server/channels/store/sqlstore/channel_store.go` (line 2552)
- Measurement: Not quantified
- Cause: MySQL 8 not yet minimum supported version
- Improvement path: Implement CTE when MySQL 8 is minimum

## Fragile Areas

**Error Handling in Stores:**
- File: `server/channels/store/sqlstore/bot_store.go` (lines 171, 191)
- Why fragile: TODOs indicate error handling doesn't propagate correctly
- Common failures: Validation errors swallowed
- Safe modification: Wait for v6 migration to fix
- Test coverage: Needs additional error path testing

**Generated Store Layers:**
- Files: `server/channels/store/retrylayer/`, `server/channels/store/timerlayer/`
- Why fragile: 14-17K lines of generated code
- Common failures: Regeneration needed when interfaces change
- Safe modification: Regenerate from source, don't edit directly
- Test coverage: Indirect through store tests

## Scaling Limits

**Configuration Size:**
- Current capacity: Config struct at 5,401 lines
- Limit: IDE and tooling slow with large files
- Symptoms at limit: Slow autocomplete, navigation
- Scaling path: Modularize into sub-structs

## Dependencies at Risk

**React Bootstrap:**
- Risk: Legacy dependency, being phased out
- Impact: Modal and UI components depend on it
- Files: Various components importing react-bootstrap
- Migration plan: Use `GenericModal` from `@mattermost/components`
- Note: Style guide recommends avoiding direct use

**Enzyme:**
- Risk: Deprecated testing library
- Impact: Some legacy tests still use Enzyme
- Files: Legacy test files with Enzyme imports
- Migration plan: Convert to React Testing Library

## Missing Critical Features

**Agents Provider:**
- Problem: AI Agents provider commented out/disabled
- File: `server/public/model/config.go` (lines 2791, 2806, 2830, 2861)
- Current workaround: Feature not available
- Blocks: AI agent integration
- Note: TODOs indicate planned for future release

## Test Coverage Gaps

**Error Path Testing:**
- What's not tested: Some store error paths don't propagate correctly
- Risk: Errors may be silently swallowed
- Files: `server/channels/store/sqlstore/bot_store.go`
- Priority: Medium
- Difficulty: Requires understanding v6 migration plan

**Visual Regression:**
- What's not tested: Accessibility color contrast improvements
- Risk: Accessibility issues may regress
- File: `e2e-tests/playwright/docs/accessibility/automated_scan_testing.md` (line 109)
- Priority: Medium
- Note: TODO references MM-nnn for tracking

**Build Container Issues:**
- What's not tested: VCS status in container builds
- Risk: CI failures in containerized environments
- File: `.github/workflows/server-ci.yml` (lines 82, 279)
- Priority: Low
- Note: Workaround in place, needs proper fix

## TODO/FIXME Summary

**By Area:**
- Database/SQL: ~20 TODOs for query optimization and migration
- Configuration: ~10 TODOs for feature flags and settings
- TypeScript: ~15 TODOs for type safety improvements
- E2E Tests: ~5 TODOs for test improvements
- CI/Build: ~3 TODOs for build system issues

**High Priority:**
1. SQL parameterization verification (`channel_store.go:4244`)
2. Error handling in stores (`bot_store.go`)
3. TypeScript `any` types cleanup

**Medium Priority:**
1. Squirrel migration in `post_store.go`
2. Config modularization
3. Large file splitting

---

*Concerns audit: 2026-01-13*
*Update as issues are fixed or new ones discovered*
