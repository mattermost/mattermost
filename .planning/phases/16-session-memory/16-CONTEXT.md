# Phase 16: Session Memory - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-DM conversation history and context management using KV store. Enable AI agents to maintain conversation context across messages.

</domain>

<decisions>
## Implementation Decisions

### Conversation history architecture
- **Use Mattermost threading as the conversation history** — not KV store duplication
- When user messages bot, the message creates a post
- Bot responds by creating a post with `root_id` pointing to user's message (threading)
- Thread posts ARE the conversation history — already persisted by Mattermost
- Retrieve full thread history when building context for LLM

### Thread behavior
- **Always thread responses** — bot creates thread even for first message
- Every conversation is a thread, keeping history organization consistent
- Fetch entire thread when building conversation context (all posts in thread)

### Agent context storage
- **Use KV Store for agent context** (system prompts, tool state, metadata)
- Keyed by channel/user/thread as appropriate
- Conversation messages come from thread; agent state comes from KV store

### Cross-bot isolation
- **Completely separate** — each bot (OpenAI, Anthropic) is independent
- No shared memory or context between bots
- Each bot lives in its own DM channel with its own threads

### OpenCode's Discretion
- KV store key structure/naming
- How to format thread posts into LLM message format
- Error handling when thread fetch fails

</decisions>

<specifics>
## Specific Ideas

- Thread posts as history is native to Mattermost — simpler than duplicating in KV store
- Post props field could be used as alternative to KV store for per-post context (noted but KV store chosen)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-session-memory*
*Context gathered: 2026-01-20*
