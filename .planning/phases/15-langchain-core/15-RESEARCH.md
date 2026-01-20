# Phase 15: LangChain Core - Research

**Researched:** 2026-01-20
**Domain:** LangChain Python SDK, Multi-provider LLM integration
**Confidence:** HIGH

## Summary

LangChain v1.x (current: 1.2.6) provides a unified interface for building AI agents with multiple LLM providers. The modern architecture uses `init_chat_model()` for provider-agnostic model initialization and `create_agent()` for building agents with tools and memory support.

For Phase 15 (simple chat responses without tools/agents), we should use the chat model interface directly (`ChatOpenAI`, `ChatAnthropic`) rather than the full agent framework. This provides a clean foundation that Phase 16-18 can extend.

**Primary recommendation:** Use `langchain-openai` and `langchain-anthropic` packages with direct chat model invocation. Structure handlers to accept message history for easy Phase 16 memory integration.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langchain` | >=1.2.0 | Core LangChain framework | Official package, required for `init_chat_model()` |
| `langchain-openai` | >=1.1.0 | OpenAI integration | Official provider package, includes `ChatOpenAI` |
| `langchain-anthropic` | >=1.3.0 | Anthropic integration | Official provider package, includes `ChatAnthropic` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `langchain-core` | (transitive) | Core abstractions | Installed automatically, provides message types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `langchain` | Raw `openai`/`anthropic` SDKs | Would lose unified interface, harder Phase 16-18 integration |
| Provider packages | `langchain[openai,anthropic]` extras | Same result, extras syntax works too |

**Installation:**
```bash
pip install langchain langchain-openai langchain-anthropic
```

**Requirements.txt update:**
```
mattermost-plugin
langchain>=1.2.0
langchain-openai>=1.1.0
langchain-anthropic>=1.3.0
```

## Architecture Patterns

### Recommended Project Structure

For Phase 15, keep LangChain code in the plugin file. Extract to modules in later phases:

```
plugins/langchain-agent/
├── plugin.py           # Main plugin with handlers
├── plugin.json         # Manifest
├── requirements.txt    # Dependencies including langchain
└── Makefile           # Build tooling
```

### Pattern 1: Provider Factory Pattern

**What:** Create chat models using a factory function that reads from environment/config
**When to use:** Multi-provider setup where provider is determined at runtime

```python
# Source: LangChain official docs - init_chat_model()
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

def create_openai_model():
    """Create OpenAI chat model with default settings."""
    return init_chat_model(
        "gpt-4o",
        temperature=0.7,
        # API key from OPENAI_API_KEY env var automatically
    )

def create_anthropic_model():
    """Create Anthropic chat model with default settings."""
    return init_chat_model(
        "claude-sonnet-4-5-20250929",
        temperature=0.7,
        # API key from ANTHROPIC_API_KEY env var automatically
    )
```

### Pattern 2: Direct Chat Model Classes (Recommended for Phase 15)

**What:** Use provider-specific classes directly for explicit control
**When to use:** When you need provider-specific configuration or want explicit imports

```python
# Source: LangChain official docs
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

# Create models
openai_model = ChatOpenAI(
    model="gpt-4o",
    temperature=0.7,
    # API key from OPENAI_API_KEY env var
)

anthropic_model = ChatAnthropic(
    model="claude-sonnet-4-5-20250929",
    temperature=0.7,
    # API key from ANTHROPIC_API_KEY env var
)

# Simple invocation
messages = [
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="Hello!")
]
response = openai_model.invoke(messages)
print(response.content)  # AIMessage.content contains the text
```

### Pattern 3: Handler Pattern for Mattermost Integration

**What:** Structure handlers to accept messages and return response text
**When to use:** All bot handlers in the plugin

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

class LangChainAgentPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.openai_model: ChatOpenAI | None = None
        self.anthropic_model: ChatAnthropic | None = None
    
    @hook(HookName.OnActivate)
    def on_activate(self):
        # Initialize models on activation (lazy - only if API keys present)
        try:
            self.openai_model = ChatOpenAI(model="gpt-4o")
        except Exception as e:
            self.logger.warning(f"OpenAI model not available: {e}")
        
        try:
            self.anthropic_model = ChatAnthropic(model="claude-sonnet-4-5-20250929")
        except Exception as e:
            self.logger.warning(f"Anthropic model not available: {e}")
    
    def _handle_openai_message(self, post: Post) -> None:
        if self.openai_model is None:
            self._send_error_response(post.channel_id, "OpenAI not configured")
            return
        
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content=post.message)
        ]
        
        try:
            response = self.openai_model.invoke(messages)
            self._send_response(post.channel_id, response.content)
        except Exception as e:
            self.logger.error(f"OpenAI API error: {e}")
            self._send_error_response(post.channel_id, str(e))
```

### Anti-Patterns to Avoid

- **Creating models per-request:** Models should be created once on activation, not per message. The underlying HTTP client is thread-safe.
- **Blocking the hook handler:** LLM calls can take seconds. The plugin SDK supports both sync and async handlers - use async if available, but sync is acceptable since MessageHasBeenPosted is fire-and-forget.
- **Hard-coding API keys:** Always use environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
- **Ignoring errors:** Always handle API errors gracefully and inform the user.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message formatting | Custom message classes | `langchain_core.messages` | Standard types for all providers |
| API retries | Custom retry logic | Built into LangChain clients | Handles rate limits, transient errors |
| Token counting | Manual token estimation | Model's `get_num_tokens()` | Provider-specific tokenizers |
| Streaming | Custom chunking | `model.stream()` method | Proper async iteration |
| Multi-provider abstraction | Provider switch/case | `init_chat_model()` | Unified interface |

**Key insight:** LangChain's abstractions handle provider differences (message format, API structure, error handling) so you write code once that works with any provider.

## Common Pitfalls

### Pitfall 1: API Key Not Set

**What goes wrong:** Model initialization fails or API calls return auth errors
**Why it happens:** Environment variables not set in plugin runtime
**How to avoid:** 
- Check for API key presence on activation
- Log clear warning if key missing
- Gracefully disable the bot that can't function
**Warning signs:** `AuthenticationError`, empty API key errors

### Pitfall 2: Synchronous Blocking in Async Context

**What goes wrong:** Hook handler blocks event loop, causing timeouts
**Why it happens:** LLM calls take 1-10+ seconds
**How to avoid:**
- The Mattermost Plugin SDK's HookRunner supports both sync and async handlers
- For MessageHasBeenPosted (fire-and-forget), sync is acceptable
- Model's `invoke()` is sync, `ainvoke()` is async
**Warning signs:** Hook timeout errors, slow plugin responses

### Pitfall 3: Message Type Confusion

**What goes wrong:** Incorrect message types cause API errors or unexpected behavior
**Why it happens:** Different providers have different message role requirements
**How to avoid:**
- Always use `SystemMessage`, `HumanMessage`, `AIMessage` from `langchain_core.messages`
- System message should be first if used
- Don't mix raw dicts with message objects
**Warning signs:** API validation errors, "invalid role" errors

### Pitfall 4: Not Handling Rate Limits

**What goes wrong:** API returns 429 errors, bot stops responding
**Why it happens:** High message volume exceeds API rate limits
**How to avoid:**
- LangChain has built-in retry with exponential backoff
- For Phase 15, accept default retry behavior
- Log rate limit warnings for visibility
**Warning signs:** Repeated 429 errors in logs

### Pitfall 5: Memory Leak from Model Objects

**What goes wrong:** Memory grows over time
**Why it happens:** Creating new model instances per request
**How to avoid:** Create models once in `on_activate`, reuse for all requests
**Warning signs:** Growing memory usage, eventual OOM

## Code Examples

Verified patterns from official sources:

### Basic Chat Completion

```python
# Source: LangChain official docs - Chat Models
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

model = ChatOpenAI(model="gpt-4o")

messages = [
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="What is 2 + 2?"),
]

response = model.invoke(messages)
print(response.content)  # "4" or similar
```

### Provider-Agnostic Model Creation

```python
# Source: LangChain official docs - init_chat_model
from langchain.chat_models import init_chat_model

# Works with any supported provider
model = init_chat_model(
    "gpt-4o",           # or "claude-sonnet-4-5-20250929"
    temperature=0.7,
    timeout=30,
    max_tokens=1000,
)
```

### Error Handling Pattern

```python
# Source: Best practices from LangChain docs
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

model = ChatOpenAI(model="gpt-4o")

try:
    response = model.invoke([HumanMessage(content="Hello")])
    return response.content
except Exception as e:
    # LangChain raises specific exceptions:
    # - AuthenticationError: Invalid API key
    # - RateLimitError: Too many requests  
    # - APIError: General API error
    logger.error(f"LLM API error: {type(e).__name__}: {e}")
    return f"Sorry, I encountered an error: {e}"
```

### Conversation History (Prep for Phase 16)

```python
# Source: LangChain official docs - Messages
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Build conversation history
history = [
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="My name is Bob"),
    AIMessage(content="Hello Bob! How can I help you today?"),
    HumanMessage(content="What's my name?"),
]

response = model.invoke(history)
# Response will reference "Bob" from context
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `langchain.chat_models.ChatOpenAI` | `langchain_openai.ChatOpenAI` | LangChain 0.1.0 (Jan 2024) | Import from provider packages |
| `LLMChain` for simple chat | Direct `model.invoke()` | LangChain 1.0 (Oct 2025) | Simpler API, chains deprecated |
| Manual message dicts | `langchain_core.messages` types | LangChain 0.2.0 | Type safety, validation |
| `langchain[all]` | Individual provider packages | LangChain 0.1.0 | Smaller install, better versioning |

**Deprecated/outdated:**
- `langchain.llms` module: Use `langchain.chat_models` for chat models
- `LLMChain`, `ConversationChain`: Deprecated in favor of direct invocation or agents
- `langchain.schema` messages: Use `langchain_core.messages`

## Open Questions

Things that couldn't be fully resolved:

1. **Streaming vs Non-Streaming**
   - What we know: LangChain supports streaming via `model.stream()`
   - What's unclear: Whether Phase 15 should implement streaming for better UX
   - Recommendation: Defer streaming to later phase; simple `invoke()` is sufficient for Phase 15

2. **API Key Storage**
   - What we know: Environment variables are standard for API keys
   - What's unclear: How Mattermost plugin runtime exposes environment to Python subprocess
   - Recommendation: Use environment variables; document in plugin setup instructions

3. **Model Selection**
   - What we know: Both providers have multiple models with different capabilities/costs
   - What's unclear: Which specific models to default to
   - Recommendation: Default to `gpt-4o` and `claude-sonnet-4-5-20250929` (capable, widely available)

## Sources

### Primary (HIGH confidence)
- PyPI langchain package (v1.2.6) - https://pypi.org/project/langchain/
- PyPI langchain-openai package (v1.1.7) - https://pypi.org/project/langchain-openai/
- PyPI langchain-anthropic package (v1.3.1) - https://pypi.org/project/langchain-anthropic/
- LangChain official docs - https://docs.langchain.com/oss/python/langchain/overview
- LangChain quickstart - https://docs.langchain.com/oss/python/langchain/quickstart
- LangChain install docs - https://docs.langchain.com/oss/python/langchain/install

### Secondary (MEDIUM confidence)
- LangChain short-term memory docs - https://docs.langchain.com/oss/python/langchain/short-term-memory
- LangChain MCP docs - https://docs.langchain.com/oss/python/langchain/mcp

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official PyPI packages and documentation
- Architecture: HIGH - Based on official documentation patterns
- Pitfalls: MEDIUM - Combination of docs and common knowledge
- Future compatibility: HIGH - Memory/MCP patterns verified in official docs

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - LangChain is stable post-1.0)

## Phase 16+ Compatibility Notes

For **Phase 16 (Session Memory)**:
- LangChain's `InMemorySaver` checkpointer provides conversation persistence
- Handler pattern in Phase 15 should accept message history list (easy to extend)
- Can use Mattermost KV store as custom checkpointer backend

For **Phase 17 (MCP Client)**:
- LangChain has official MCP support via `langchain-mcp-adapters`
- `create_agent()` accepts tools from MCP servers
- Phase 15's model instances can be reused in agents

For **Phase 18 (Agentic Loop)**:
- `create_agent()` builds on chat models from Phase 15
- Tools, memory, and models compose cleanly
- LangGraph (underlying LangChain agents) handles the agent loop
