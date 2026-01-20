# Phase 18: Agentic Loop - Research

**Researched:** 2026-01-20
**Domain:** LangChain/LangGraph agentic patterns, tool orchestration, extended thinking
**Confidence:** HIGH

## Summary

Phase 18 adds sophisticated agentic loop capabilities on top of the MCP client integration from Phase 17. The current plugin uses `create_react_agent` from `langgraph.prebuilt` for basic ReAct-style tool calling. This phase enhances the agent with:

1. **Advanced tool orchestration** - Using LangChain's middleware system for dynamic tool selection, error handling, and retry logic
2. **Reasoning patterns** - Implementing planning and reflection via the TodoListMiddleware and multi-step workflows
3. **Multi-step execution** - Using StateGraph patterns for orchestrator-worker and evaluator-optimizer flows
4. **Extended thinking** - Integrating Anthropic's extended thinking for complex reasoning tasks

The LangChain ecosystem has evolved significantly. The standard approach is now `create_agent` from `langchain.agents` (built on LangGraph) with middleware for customization, rather than building custom StateGraph flows manually. For complex tasks requiring planning, LangChain's `deepagents` library provides pre-built patterns.

**Primary recommendation:** Use `create_agent` with middleware for tool orchestration, error handling, and context management. For extended thinking, use Anthropic's `thinking` parameter. Keep the current architecture but add middleware for enhanced capabilities.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langchain` | >=1.0.0 | Agent creation, middleware system | Official high-level agent API |
| `langgraph` | >=0.2.0 | Graph-based workflow orchestration | Foundation for `create_agent` |
| `langchain-anthropic` | >=1.1.0 | Anthropic model integration | Extended thinking, prompt caching |
| `langchain-mcp-adapters` | >=0.2.0 | MCP tool integration | Already in Phase 17 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `deepagents` | >=0.1.0 | Complex multi-step agents | When needing planning, subagents, file systems |
| `langgraph-checkpoint-sqlite` | >=0.1.0 | Persistent checkpointing | For long-running agents, human-in-the-loop |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `create_agent` | Custom `StateGraph` | More control but more boilerplate; use StateGraph only for complex non-standard flows |
| Built-in middleware | Custom middleware | Custom gives more control but built-ins are well-tested |
| `deepagents` | Manual planning | deepagents provides tested patterns but adds dependency |

**Installation:**
```bash
pip install langchain>=1.0.0 langgraph>=0.2.0 langchain-anthropic>=1.1.0
# Optional for complex agents:
pip install deepagents
```

## Architecture Patterns

### Recommended Project Structure

Phase 18 builds on Phase 17's structure. The plugin.py grows to include middleware configuration:

```
plugins/langchain-agent/
├── plugin.py           # Main plugin - add middleware configuration
├── middleware.py       # Custom middleware (optional, for future)
├── plugin.json         # Manifest
├── requirements.txt    # Update versions
└── Makefile           # Build tooling
```

### Pattern 1: create_agent with Middleware

**What:** Use `create_agent` from `langchain.agents` with middleware for orchestration
**When to use:** For most agentic use cases - this is the standard approach

```python
# Source: LangChain official docs
from langchain.agents import create_agent
from langchain.agents.middleware import (
    ToolRetryMiddleware,
    ModelCallLimitMiddleware,
    SummarizationMiddleware,
)

agent = create_agent(
    model="anthropic:claude-sonnet-4-5-20250929",
    tools=tools,
    system_prompt="You are a helpful assistant.",
    middleware=[
        ToolRetryMiddleware(max_retries=3, backoff_factor=2.0),
        ModelCallLimitMiddleware(run_limit=10),
        SummarizationMiddleware(
            model="gpt-4o-mini",
            trigger=("tokens", 4000),
            keep=("messages", 20),
        ),
    ],
)
```

### Pattern 2: Extended Thinking with Anthropic

**What:** Enable extended thinking for complex reasoning tasks
**When to use:** For tasks requiring step-by-step reasoning (math, analysis, planning)

```python
# Source: LangChain Anthropic integration docs
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(
    model="claude-sonnet-4-5-20250929",
    max_tokens=5000,
    thinking={"type": "enabled", "budget_tokens": 2000},
)

# Use with create_agent
agent = create_agent(model, tools=tools)
```

### Pattern 3: Planning with TodoListMiddleware

**What:** Equip agents with task planning and tracking capabilities
**When to use:** For complex multi-step tasks requiring coordination

```python
# Source: LangChain middleware docs
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware

agent = create_agent(
    model="gpt-4o",
    tools=[read_file, write_file, run_tests],
    middleware=[TodoListMiddleware()],  # Provides write_todos tool
)
```

### Pattern 4: ReAct Loop Pattern (Already Implemented)

**What:** Basic ReAct (Reasoning + Acting) loop with tool calling
**When to use:** Default pattern - already implemented in Phase 17

```python
# Source: LangGraph prebuilt
from langgraph.prebuilt import create_react_agent

# Phase 17 already uses this pattern
agent = create_react_agent(model, tools)
response = await agent.ainvoke({"messages": messages})
```

### Pattern 5: Workflow Patterns for Complex Tasks

**What:** Use StateGraph for orchestrator-worker or evaluator-optimizer patterns
**When to use:** For complex multi-step tasks with parallel execution or evaluation loops

```python
# Source: LangGraph workflows-agents guide
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

# Orchestrator-worker pattern
def orchestrator(state: State):
    """Break down task into subtasks"""
    sections = planner.invoke(...)
    return {"sections": sections}

def assign_workers(state: State):
    """Spawn workers for each subtask"""
    return [Send("worker", {"section": s}) for s in state["sections"]]

# Build workflow
builder = StateGraph(State)
builder.add_node("orchestrator", orchestrator)
builder.add_node("worker", worker_node)
builder.add_conditional_edges("orchestrator", assign_workers, ["worker"])
```

### Anti-Patterns to Avoid

- **Hand-rolling ReAct loops:** Use `create_agent` or `create_react_agent` - they handle edge cases, streaming, and errors properly
- **Ignoring middleware:** Built-in middleware handles retry, rate limiting, summarization - don't reimplement
- **Blocking asyncio.run() calls:** Already handled in Phase 17, but be careful with nested event loops
- **No iteration limits:** Always use `ModelCallLimitMiddleware` to prevent infinite loops
- **Not handling tool errors:** Use `ToolRetryMiddleware` or `@wrap_tool_call` for error handling

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ReAct loop | Custom while loop | `create_agent` / `create_react_agent` | Handles streaming, errors, tool binding |
| Tool retry logic | Manual try/except | `ToolRetryMiddleware` | Exponential backoff, configurable |
| Context management | Manual message trimming | `SummarizationMiddleware` | Token-aware, preserves recent messages |
| Iteration limits | Counter variable | `ModelCallLimitMiddleware` | Thread and run limits |
| Tool selection | if/else logic | `LLMToolSelectorMiddleware` | LLM-based intelligent selection |
| Model fallback | try/except chains | `ModelFallbackMiddleware` | Automatic provider fallback |
| Extended thinking | Custom prompting | Anthropic `thinking` parameter | Built into model, returns reasoning |

**Key insight:** LangChain 1.0+ provides comprehensive middleware that handles the hard parts of agent orchestration. The time to build custom solutions is when you need behavior that middleware doesn't provide.

## Common Pitfalls

### Pitfall 1: Not Setting Iteration Limits

**What goes wrong:** Agent enters infinite loop, consuming tokens and time
**Why it happens:** No limit on model calls, tool errors causing retries
**How to avoid:** Always use `ModelCallLimitMiddleware`
**Warning signs:** High token usage, agent not terminating, repeated tool calls

```python
# Good: Set limits
agent = create_agent(
    model, tools,
    middleware=[ModelCallLimitMiddleware(run_limit=10)]
)
```

### Pitfall 2: Extended Thinking Without Budget

**What goes wrong:** Model uses excessive tokens for thinking
**Why it happens:** No budget_tokens specified with extended thinking
**How to avoid:** Always specify `budget_tokens` when enabling thinking
**Warning signs:** Very high token counts, slow responses

```python
# Good: Set thinking budget
model = ChatAnthropic(
    model="claude-sonnet-4-5-20250929",
    thinking={"type": "enabled", "budget_tokens": 2000},  # Cap thinking tokens
    max_tokens=5000,  # Total output limit
)
```

### Pitfall 3: Blocking Async in Sync Context

**What goes wrong:** RuntimeError or nested event loop issues
**Why it happens:** Calling async agent methods from sync hook handlers
**How to avoid:** Use `asyncio.run()` wrapper (already in Phase 17)
**Warning signs:** "no running event loop", "event loop is already running"

### Pitfall 4: Tool Errors Breaking Agent Loop

**What goes wrong:** Agent fails completely when a tool throws an error
**Why it happens:** No error handling for tool execution
**How to avoid:** Use `ToolRetryMiddleware` or `@wrap_tool_call`
**Warning signs:** Agent stops after single tool failure, no graceful degradation

```python
# Good: Handle tool errors with middleware
from langchain.agents.middleware import wrap_tool_call, ToolMessage

@wrap_tool_call
def handle_tool_errors(request, handler):
    try:
        return handler(request)
    except Exception as e:
        return ToolMessage(
            content=f"Tool error: {str(e)}",
            tool_call_id=request.tool_call["id"]
        )
```

### Pitfall 5: Context Window Overflow

**What goes wrong:** Agent fails with context length error
**Why it happens:** Long conversations, large tool results
**How to avoid:** Use `SummarizationMiddleware` or `ContextEditingMiddleware`
**Warning signs:** "context length exceeded", token count warnings

### Pitfall 6: Ignoring Anthropic's Content Blocks

**What goes wrong:** Missing tool calls or thinking content
**Why it happens:** Treating response.content as string when it's a list of blocks
**How to avoid:** Use `response.content_blocks` for standardized access
**Warning signs:** Empty responses, missing tool call IDs

## Code Examples

Verified patterns from official sources:

### Basic Enhanced Agent (Recommended Starting Point)

```python
# Source: LangChain docs + Mattermost plugin integration
from langchain.agents import create_agent
from langchain.agents.middleware import (
    ToolRetryMiddleware,
    ModelCallLimitMiddleware,
)
from langchain_anthropic import ChatAnthropic

class LangChainAgentPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.mcp_client: MultiServerMCPClient | None = None
        self.anthropic_model: ChatAnthropic | None = None
    
    @hook(HookName.OnActivate)
    def on_activate(self):
        # Initialize model with sensible defaults
        self.anthropic_model = ChatAnthropic(
            model="claude-sonnet-4-5-20250929",
            temperature=0.7,
            max_tokens=4096,
        )
        
        # MCP client initialization (from Phase 17)
        mcp_config = self._get_mcp_server_config()
        if mcp_config:
            self.mcp_client = MultiServerMCPClient(mcp_config)
    
    async def _handle_message_async(self, post: Post, bot_id: str, system_prompt: str):
        messages = self._build_conversation_history(post, bot_id, system_prompt)
        
        if self.mcp_client:
            tools = await self.mcp_client.get_tools()
            if tools:
                # Create agent with middleware for robustness
                agent = create_agent(
                    self.anthropic_model,
                    tools=tools,
                    system_prompt=system_prompt,
                    middleware=[
                        ToolRetryMiddleware(max_retries=2),
                        ModelCallLimitMiddleware(run_limit=10),
                    ],
                )
                response = await agent.ainvoke({"messages": messages})
                # Extract final message
                last_message = response["messages"][-1]
                return last_message.content
        
        # Fallback to basic invocation
        response = self.anthropic_model.invoke(messages)
        return response.content
```

### Extended Thinking for Complex Tasks

```python
# Source: LangChain Anthropic docs
from langchain_anthropic import ChatAnthropic
from langchain.agents import create_agent

def create_thinking_agent(tools: list):
    """Create an agent with extended thinking enabled."""
    model = ChatAnthropic(
        model="claude-sonnet-4-5-20250929",
        max_tokens=5000,
        thinking={"type": "enabled", "budget_tokens": 2000},
    )
    
    return create_agent(
        model,
        tools=tools,
        system_prompt=(
            "You are a thoughtful assistant that carefully reasons "
            "through complex problems step by step."
        ),
    )

# Usage
agent = create_thinking_agent(tools)
result = await agent.ainvoke({
    "messages": [{"role": "user", "content": "Analyze this complex scenario..."}]
})

# Access thinking content from response
for block in result["messages"][-1].content_blocks:
    if block.get("type") == "reasoning":
        print(f"Reasoning: {block['reasoning']}")
    elif block.get("type") == "text":
        print(f"Answer: {block['text']}")
```

### Custom Tool Error Handling

```python
# Source: LangChain middleware docs
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage

@wrap_tool_call
def graceful_tool_errors(request, handler):
    """Handle tool errors gracefully, returning informative messages."""
    try:
        return handler(request)
    except ConnectionError as e:
        return ToolMessage(
            content=f"Connection failed: {e}. Please try again.",
            tool_call_id=request.tool_call["id"]
        )
    except TimeoutError as e:
        return ToolMessage(
            content=f"Request timed out: {e}. The service may be slow.",
            tool_call_id=request.tool_call["id"]
        )
    except Exception as e:
        return ToolMessage(
            content=f"Tool error: {str(e)}. Let me try another approach.",
            tool_call_id=request.tool_call["id"]
        )

agent = create_agent(
    model,
    tools=tools,
    middleware=[graceful_tool_errors],
)
```

### Dynamic System Prompt Based on Context

```python
# Source: LangChain context engineering docs
from langchain.agents import create_agent
from langchain.agents.middleware import dynamic_prompt, ModelRequest

@dynamic_prompt
def context_aware_prompt(request: ModelRequest) -> str:
    """Generate system prompt based on conversation context."""
    message_count = len(request.messages)
    
    base = "You are a helpful AI assistant."
    
    if message_count > 10:
        base += "\nThis is a long conversation - be extra concise."
    
    # Could also check state for user preferences, etc.
    return base

agent = create_agent(
    model="anthropic:claude-sonnet-4-5-20250929",
    tools=tools,
    middleware=[context_aware_prompt],
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom ReAct loops | `create_agent` with middleware | LangChain 1.0 (2025) | Standardized agent creation |
| `create_react_agent` only | `create_agent` (higher level) | LangChain 1.0 (2025) | Simpler API, built-in middleware |
| Manual prompt engineering for thinking | Anthropic `thinking` parameter | Claude 3.7+ (2025) | Native extended thinking |
| Manual context management | `SummarizationMiddleware` | LangChain 1.0 (2025) | Automatic summarization |
| Custom tool selection logic | `LLMToolSelectorMiddleware` | LangChain 1.0 (2025) | LLM-based tool selection |
| Manual planning | `TodoListMiddleware` / `deepagents` | 2025 | Built-in planning capabilities |

**Deprecated/outdated:**
- `AgentExecutor`: Use `create_agent` instead
- Manual ReAct implementation: Use prebuilt agents
- `LLMChain` with tools: Use `create_agent`
- Custom iteration limiting: Use `ModelCallLimitMiddleware`

## Open Questions

Things that couldn't be fully resolved:

1. **deepagents Integration**
   - What we know: `deepagents` provides advanced planning and subagent capabilities
   - What's unclear: Whether the complexity is needed for Mattermost plugin use cases
   - Recommendation: Start with middleware; add deepagents if planning becomes critical

2. **Persistence for Long Conversations**
   - What we know: LangGraph supports checkpointers for persistence
   - What's unclear: How to integrate with Mattermost's threading model
   - Recommendation: Use in-memory for now; add sqlite checkpointer if needed

3. **Human-in-the-Loop for Mattermost**
   - What we know: LangGraph `interrupt` enables HITL patterns
   - What's unclear: How to surface interrupts in Mattermost UI
   - Recommendation: Defer HITL to future phase; document pattern for later

4. **Extended Thinking Token Budget**
   - What we know: Must set `budget_tokens` to control thinking
   - What's unclear: Optimal budget for different task types
   - Recommendation: Start with 2000 tokens; tune based on usage

## Sources

### Primary (HIGH confidence)
- LangChain Agents docs - https://docs.langchain.com/oss/python/langchain/agents
- LangChain Middleware docs - https://docs.langchain.com/oss/python/langchain/middleware/overview
- LangChain Built-in Middleware - https://docs.langchain.com/oss/python/langchain/middleware/built-in
- LangGraph Workflows docs - https://docs.langchain.com/oss/python/langgraph/workflows-agents
- ChatAnthropic docs - https://docs.langchain.com/oss/python/integrations/chat/anthropic
- LangChain Context Engineering - https://docs.langchain.com/oss/python/langchain/context-engineering

### Secondary (MEDIUM confidence)
- Deep Agents Overview - https://docs.langchain.com/oss/python/deepagents/overview
- LangGraph Interrupts - https://docs.langchain.com/oss/python/langgraph/interrupts
- LangChain Tools docs - https://docs.langchain.com/oss/python/langchain/tools

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official LangChain documentation (2026-01-20)
- Architecture patterns: HIGH - Patterns from official docs and examples
- Pitfalls: HIGH - Based on documented middleware features and API design
- Extended thinking: HIGH - Verified in ChatAnthropic official docs

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - LangChain 1.x is stable, middleware API established)

## Phase Integration Notes

### Building on Phase 17 (MCP Client)

Phase 17 established:
- `MultiServerMCPClient` for MCP tool connections
- `create_react_agent` from `langgraph.prebuilt` for basic agents
- `asyncio.run()` wrapper pattern for async in sync hooks
- Graceful fallback when MCP unavailable

Phase 18 enhances by:
- Replacing `create_react_agent` with `create_agent` + middleware (or adding middleware)
- Adding `ToolRetryMiddleware` for robust tool execution
- Adding `ModelCallLimitMiddleware` to prevent runaway loops
- Optionally enabling extended thinking for complex queries
- Optionally adding `SummarizationMiddleware` for long conversations

### Migration Path

The simplest migration:
1. Keep existing `create_react_agent` usage
2. Wrap with middleware via `create_agent` for enhanced capabilities
3. Add extended thinking configuration for Anthropic model
4. No breaking changes to existing functionality

### Future Considerations (Phase 19+)

- Human-in-the-loop via LangGraph interrupts (needs Mattermost UI integration)
- Persistent memory via LangGraph Store
- Multi-agent patterns via deepagents
- Streaming responses to Mattermost
