# Codebase Concerns

**Analysis Date:** 2026-01-21

## Tech Debt

### Recaps Feature - Feature Flag Marked for Removal
- Issue: Feature flag `EnableAIRecaps` has explicit removal comment
- Files: `server/public/model/feature_flags.go` (lines 92-93)
- Impact: Flag management overhead; GA release blocked until removal
- Fix approach: Plan GA release timeline, remove feature flag, update all flag checks in `server/channels/api4/recap.go`, `server/channels/jobs/recap/worker.go`

### Recaps - No API Layer Tests
- Issue: No test file exists for `server/channels/api4/recap.go`
- Files: `server/channels/api4/recap.go` (287 lines untested at API layer)
- Impact: API permission checks and error handling not validated; regression risk during refactoring
- Fix approach: Create `server/channels/api4/recap_test.go` with tests for all 6 endpoints

### Recaps - Hardcoded Post Limit in Summarization
- Issue: Fixed limit of 100 posts and fallback of 20 posts hardcoded in `fetchPostsForRecap`
- Files: `server/channels/app/recap.go` (lines 204, 263)
- Impact: No configurability for different channel sizes; potential data loss for active channels
- Fix approach: Move limits to configuration or pass as parameters; consider pagination for large channels

### Recaps - Silent Error Swallowing in User Lookup
- Issue: User lookup errors silently ignored when enriching posts with usernames
- Files: `server/channels/app/recap.go` (line 282)
- Impact: Posts may have fallback UserId instead of username; no visibility into lookup failures
- Fix approach: Log warning on user lookup failure; consider batch user lookup for efficiency

### General - Numerous TODO Comments Throughout Codebase
- Issue: 100+ TODO/FIXME comments across Go files indicating incomplete implementations
- Files: Distributed across `server/public/model/config.go`, `server/platform/services/`, `server/cmd/mmctl/`, etc.
- Impact: Technical debt accumulation; unclear completion timelines
- Fix approach: Audit all TODOs, create tickets for actionable items, remove stale comments

### Agents Provider Disabled
- Issue: Multiple TODO comments indicating Agents provider not enabled for release
- Files: `server/public/model/config.go` (lines 2791, 2806, 2830, 2861, 4832), `server/public/model/config_test.go`
- Impact: Blocks dependent features; incomplete AI capabilities
- Fix approach: Complete Agents provider implementation, enable in future release

## Known Bugs

### Recaps - Partial Success Treated as Success
- Symptoms: When some channels fail to process, recap is marked as "completed" rather than "partial"
- Files: `server/channels/jobs/recap/worker.go` (lines 97-106)
- Trigger: AI agent fails for some channels in a multi-channel recap
- Workaround: Users must check each channel card to verify content was generated

## Security Considerations

### Recaps - Channel Access Validation Only at Creation
- Risk: User's channel membership verified only when creating recap, not on subsequent reads
- Files: `server/channels/app/recap.go` (lines 18-23), `server/channels/api4/recap.go` (lines 115-118)
- Current mitigation: User ownership check on read operations ensures only recap owner can access
- Recommendations: Consider re-validating channel membership on recap read if sensitive; add periodic cleanup for recaps with channels user no longer has access to

### Recaps - AI Prompt Injection Surface
- Risk: User-provided channel messages passed directly to AI prompt for summarization
- Files: `server/channels/app/summarization.go` (lines 33-54)
- Current mitigation: None - raw messages included in prompt
- Recommendations: Sanitize message content before prompt construction; implement output validation

### Recaps - External AI Service Dependency
- Risk: Recap feature requires external AI plugin (mattermost-ai) with version ≥1.5.0
- Files: `server/channels/app/agents.go` (lines 17-19)
- Current mitigation: Version check before bridge API calls
- Recommendations: Graceful degradation messaging; health check endpoint for AI service availability

## Performance Bottlenecks

### Recaps - Sequential Channel Processing
- Problem: Recap job processes channels one at a time in sequence
- Files: `server/channels/jobs/recap/worker.go` (lines 56-81)
- Cause: Simple for-loop iteration without parallelism
- Improvement path: Implement worker pool with configurable concurrency; process N channels in parallel

### Recaps - N+1 Query Pattern for User Lookup
- Problem: Individual user lookup for each post when enriching with usernames
- Files: `server/channels/app/recap.go` (lines 281-289)
- Cause: User fetched individually per post in loop
- Improvement path: Collect unique UserIds, batch fetch users, then enrich posts

### Recaps - Full Post Fetch Without Field Selection
- Problem: Fetches complete post objects when only Id, UserId, Message, CreateAt needed
- Files: `server/channels/app/recap.go` (lines 256-278)
- Cause: Using generic GetPostsSince without projection
- Improvement path: Add lightweight post fetch method or use field projection

## Fragile Areas

### Recaps - AI Response Parsing
- Files: `server/channels/app/summarization.go` (lines 82-93)
- Why fragile: JSON parsing of free-form AI response; any format deviation causes failure
- Safe modification: Add robust error handling, fallback responses, response validation
- Test coverage: No unit tests for summarization.go; AI mocking difficult in integration tests

### Recaps - Job Data String Splitting
- Files: `server/channels/jobs/recap/worker.go` (line 40)
- Why fragile: Channel IDs joined with comma on save, split on read; breaks if channelId contains comma
- Safe modification: Use JSON array encoding for channel_ids
- Test coverage: Worker tests exist but don't test edge cases

### Recaps - Feature Flag Dependency Chain
- Files: `server/channels/api4/recap.go` (line 25), `server/channels/jobs/recap/worker.go` (line 24)
- Why fragile: Feature flag checked in multiple places; missing check creates inconsistent state
- Safe modification: Add centralized feature gate check; use middleware pattern
- Test coverage: Tests manually set env var; doesn't verify production config behavior

## Scaling Limits

### Recaps - Single Job Per Recap
- Current capacity: One background job processes all channels for one recap
- Limit: Large recaps (many channels, many posts) block job queue
- Scaling path: Split into per-channel jobs; implement job priority queues

### Recaps - In-Memory Post Collection
- Current capacity: Holds up to 100 posts per channel in memory during processing
- Limit: Memory pressure with many concurrent recap jobs
- Scaling path: Stream processing; reduce batch size; implement backpressure

## Dependencies at Risk

### Recaps - External AI Plugin Coupling
- Risk: Hard dependency on `mattermost-plugin-ai` and its bridge client API
- Impact: Recap feature completely broken if plugin unavailable or API changes
- Migration plan: Abstract AI client interface; support multiple AI backends

## Missing Critical Features

### Recaps - No Retry Mechanism for Failed Channels
- Problem: Failed channel processing not retried
- Blocks: Reliable recap generation when transient AI errors occur
- Files: `server/channels/jobs/recap/worker.go` (lines 64-71)

### Recaps - No Rate Limiting on AI Calls
- Problem: No throttling of requests to AI service
- Blocks: Safe operation under high load; could overwhelm AI service
- Files: `server/channels/app/summarization.go` (line 77)

### Recaps - No Websocket Reconnection Handling
- Problem: Frontend relies on websocket for recap status updates but doesn't handle reconnection
- Blocks: Reliable UI updates if connection drops during recap processing
- Files: `webapp/channels/src/components/recaps/recap_processing.tsx`

## Test Coverage Gaps

### API Layer Tests Missing
- What's not tested: All 6 recap API endpoints (create, get, list, mark read, regenerate, delete)
- Files: `server/channels/api4/recap.go`
- Risk: Permission checks, input validation, error responses unverified
- Priority: High

### Summarization Logic Untested
- What's not tested: AI prompt construction, response parsing, error handling
- Files: `server/channels/app/summarization.go`
- Risk: AI integration failures undetected; prompt changes may break parsing
- Priority: High

### Frontend Component Coverage Partial
- What's not tested: `recap_item.tsx`, `recaps.tsx` (main component)
- Files: `webapp/channels/src/components/recaps/recap_item.tsx`, `webapp/channels/src/components/recaps/recaps.tsx`
- Risk: UI regression in primary recap views; 7 of 12 .tsx files have tests (58%)
- Priority: Medium

### Reducer and Selector Tests Missing
- What's not tested: Redux state management for recaps
- Files: `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/recaps.ts`, `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/recaps.ts`
- Risk: State mutation bugs, selector memoization issues
- Priority: Medium

---

*Concerns audit: 2026-01-21*
