# Phase 17: MCP Client - Research

**Researched:** 2026-01-20
**Domain:** Model Context Protocol (MCP) integration for LangChain agents
**Confidence:** HIGH

## Summary

The Model Context Protocol (MCP) is an open standard by Anthropic for connecting AI applications to external tools, data sources, and workflows. Think of MCP as "USB-C for AI" - a standardized way to connect AI applications to external systems. MCP servers expose **tools**, **resources**, and **prompts** that AI agents can discover and use.

For Phase 17, we integrate MCP client capabilities into our LangChain plugin using `langchain-mcp-adapters` - the official LangChain library for MCP. This library converts MCP tools into LangChain-compatible tools that work seamlessly with `create_agent()` and LangGraph workflows.

The integration supports two transport mechanisms:
1. **HTTP (Streamable HTTP)**: For remote MCP servers, ideal for shared services
2. **STDIO**: For local subprocess-based servers, simpler but tied to the host machine

**Primary recommendation:** Use `langchain-mcp-adapters>=0.2.0` with `MultiServerMCPClient` for connecting to multiple MCP servers. Configure servers via plugin settings, with each server specifying its transport type and connection details. The MCP tools integrate directly with Phase 15's chat models via `create_agent()`.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langchain-mcp-adapters` | >=0.2.0 | MCP-to-LangChain bridge | Official LangChain library, handles tool conversion |
| `mcp` | >=1.25.0 | MCP Python SDK | Official Anthropic SDK, provides transports and protocol |
| `langgraph` | >=0.2.0 | Agent framework | Required for `create_agent()`, tool execution loop |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastmcp` | >=0.2.0 | MCP server creation | Testing, demo servers |
| `httpx` | (transitive) | HTTP client | Used by MCP SDK for HTTP transport |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `langchain-mcp-adapters` | Raw `mcp` SDK | Would need to manually convert tools, handle tool calling |
| `MultiServerMCPClient` | Direct `ClientSession` | More control but more boilerplate |
| HTTP transport | STDIO only | HTTP enables remote servers, better for production |

**Installation:**
```bash
pip install langchain-mcp-adapters langgraph
```

**Requirements.txt update:**
```
mattermost-plugin
langchain>=1.2.0
langchain-openai>=1.1.0
langchain-anthropic>=1.3.0
langchain-mcp-adapters>=0.2.0
langgraph>=0.2.0
```

## Architecture Patterns

### Recommended Project Structure

For Phase 17, add MCP configuration and client management to the existing plugin:

```
plugins/langchain-agent/
├── plugin.py           # Main plugin - add MCP client initialization
├── plugin.json         # Manifest - add MCP server configuration settings
├── requirements.txt    # Add langchain-mcp-adapters, langgraph
└── Makefile           # Build tooling
```

### Pattern 1: MultiServerMCPClient for Multi-Server Connections

**What:** Use `MultiServerMCPClient` to connect to multiple MCP servers simultaneously
**When to use:** Always - even for single server, this pattern scales well

```python
# Source: langchain-mcp-adapters official docs
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent

client = MultiServerMCPClient(
    {
        "math": {
            "command": "python",
            "args": ["/path/to/math_server.py"],
            "transport": "stdio",
        },
        "weather": {
            "url": "http://localhost:8000/mcp",
            "transport": "http",
        }
    }
)

# Get tools from all servers
tools = await client.get_tools()

# Create agent with tools and existing model
agent = create_agent("openai:gpt-4o", tools)
response = await agent.ainvoke({"messages": "what's 2 + 2?"})
```

### Pattern 2: create_agent() with Chat Models

**What:** Use `create_agent()` to create a ReAct-style agent with tools
**When to use:** When you want the LLM to decide when to use tools

```python
# Source: LangChain official docs
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

# Can use model instance or string identifier
model = ChatOpenAI(model="gpt-4o")
agent = create_agent(model, tools)

# Invoke with messages
response = await agent.ainvoke({
    "messages": [{"role": "user", "content": "What's the weather in NYC?"}]
})
```

### Pattern 3: Explicit Session Management (Stateful)

**What:** Create persistent sessions for servers that maintain state
**When to use:** When server needs context across tool calls

```python
# Source: langchain-mcp-adapters docs
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools

client = MultiServerMCPClient({...})

# Create a session explicitly
async with client.session("server_name") as session:
    tools = await load_mcp_tools(session)
    # All tool calls use same session
    agent = create_agent("openai:gpt-4o", tools)
    response = await agent.ainvoke({"messages": "..."})
```

### Pattern 4: Transport Configuration

**What:** Configure connection based on transport type
**When to use:** When configuring MCP servers

```python
# Source: langchain-mcp-adapters docs

# STDIO transport (local subprocess)
stdio_config = {
    "transport": "stdio",
    "command": "python",
    "args": ["/absolute/path/to/server.py"],
}

# HTTP transport (remote server)
http_config = {
    "transport": "http",
    "url": "http://localhost:8000/mcp",
    "headers": {  # Optional authentication
        "Authorization": "Bearer token",
    },
}

client = MultiServerMCPClient({
    "local_tools": stdio_config,
    "remote_tools": http_config,
})
```

### Anti-Patterns to Avoid

- **Creating clients per request:** `MultiServerMCPClient` should be created once on plugin activation, not per message. Each tool invocation already creates fresh sessions by default.
- **Using relative paths for STDIO:** Always use absolute paths for subprocess commands to avoid working directory issues.
- **Blocking on async without event loop:** MCP adapters are async-first. Use `asyncio.run()` or integrate with existing event loop.
- **Ignoring STDIO warnings in web servers:** STDIO transport is designed for local machine use. For production web servers, prefer HTTP transport.
- **Not validating MCP server availability:** Always handle connection failures gracefully.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP tool to LangChain tool conversion | Custom tool wrapper | `load_mcp_tools()` | Handles schema conversion, input validation |
| Multi-server management | Manual session tracking | `MultiServerMCPClient` | Handles connection lifecycle |
| Subprocess lifecycle | Manual `subprocess.Popen` | STDIO transport | Handles stdin/stdout properly |
| HTTP+SSE streaming | Manual SSE client | HTTP transport | Protocol compliance, session management |
| Tool calling loop | Custom while loop | `create_agent()` | ReAct pattern, error handling |
| JSON-RPC protocol | Custom implementation | `mcp` SDK | Full spec compliance |

**Key insight:** The `langchain-mcp-adapters` library handles the complex bridging between MCP's JSON-RPC protocol and LangChain's tool interface. Don't try to parse MCP responses manually.

## Common Pitfalls

### Pitfall 1: Async Context Requirements

**What goes wrong:** Runtime errors when calling async MCP methods from sync code
**Why it happens:** MCP adapters are async-first; the underlying `mcp` SDK uses asyncio
**How to avoid:**
- Use `async def` handlers or wrap with `asyncio.run()`
- The Mattermost plugin hook handlers can be async
- Create event loop once, reuse for all MCP operations
**Warning signs:** `RuntimeError: no running event loop`, `coroutine never awaited`

```python
# Wrong - sync context
def on_message(self, post):
    tools = client.get_tools()  # Error!

# Right - async context
async def on_message(self, post):
    tools = await client.get_tools()

# Right - sync wrapper
def on_message(self, post):
    asyncio.run(self._handle_async(post))
```

### Pitfall 2: STDIO Subprocess Not Starting

**What goes wrong:** STDIO transport fails to connect, server process doesn't start
**Why it happens:** Wrong command/args, relative paths, missing dependencies
**How to avoid:**
- Use absolute paths for server scripts
- Verify the server script is executable
- Test server independently first: `python /path/to/server.py`
- Ensure server's dependencies are installed
**Warning signs:** `FileNotFoundError`, connection timeout, no subprocess created

### Pitfall 3: Session Lifecycle Mismatch

**What goes wrong:** Tools fail after initial success, or state not maintained
**Why it happens:** `MultiServerMCPClient` is stateless by default - each tool call creates a new session
**How to avoid:**
- For stateless servers (most cases): default behavior is fine
- For stateful servers: use explicit `async with client.session("name")` context
- Understand that STDIO keeps subprocess running but sessions are still recreated
**Warning signs:** Tool works once then fails, server state resets between calls

### Pitfall 4: HTTP Transport CORS/Security Issues

**What goes wrong:** Connection refused, CORS errors from browser clients
**Why it happens:** MCP servers need proper CORS configuration for browser-based clients
**How to avoid:**
- For server-to-server (our case): not an issue
- If exposing to browsers: configure CORS on MCP server
- Validate `Origin` header to prevent DNS rebinding attacks
**Warning signs:** HTTP 403, CORS errors in browser console

### Pitfall 5: Tool Schema Validation Errors

**What goes wrong:** Tool calls fail with validation errors
**Why it happens:** MCP tools use JSON Schema; LLM may generate invalid arguments
**How to avoid:**
- Provide clear tool descriptions
- Include type information in MCP tool definitions
- Handle validation errors gracefully, inform user
**Warning signs:** `ValidationError`, "invalid arguments" in tool result

### Pitfall 6: Agent Not Using Tools

**What goes wrong:** Agent responds without using available tools
**Why it happens:** Tools not bound to model, or model doesn't support tool calling
**How to avoid:**
- Verify model supports tool calling (GPT-4, Claude 3+)
- Use `create_agent()` which handles tool binding
- Check tools list is not empty before creating agent
**Warning signs:** Generic responses when tool should be used, empty tool list

## Code Examples

Verified patterns from official sources:

### Basic MCP Integration with Plugin

```python
# Source: langchain-mcp-adapters docs + Mattermost plugin pattern
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

class LangChainAgentPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.mcp_client: MultiServerMCPClient | None = None
        self.openai_model: ChatOpenAI | None = None
    
    @hook(HookName.OnActivate)
    def on_activate(self):
        # Initialize model (from Phase 15)
        self.openai_model = ChatOpenAI(model="gpt-4o")
        
        # Initialize MCP client with configured servers
        mcp_servers = self._get_mcp_server_config()
        if mcp_servers:
            self.mcp_client = MultiServerMCPClient(mcp_servers)
            self.logger.info(f"MCP client initialized with {len(mcp_servers)} servers")
    
    def _get_mcp_server_config(self) -> dict:
        """Build MCP server config from plugin settings."""
        # Example: could read from plugin configuration
        return {
            "math": {
                "transport": "stdio",
                "command": "python",
                "args": ["/path/to/math_server.py"],
            },
        }
    
    @hook(HookName.MessageHasBeenPosted)
    def on_message_posted(self, context, post: Post):
        # Run async handler
        asyncio.run(self._handle_message_async(post))
    
    async def _handle_message_async(self, post: Post):
        if self.mcp_client is None:
            # Fall back to basic chat (no tools)
            return self._handle_basic_chat(post)
        
        # Get tools from MCP servers
        tools = await self.mcp_client.get_tools()
        
        if not tools:
            self.logger.warning("No MCP tools available")
            return self._handle_basic_chat(post)
        
        # Create agent with tools
        agent = create_agent(self.openai_model, tools)
        
        # Invoke agent
        response = await agent.ainvoke({
            "messages": [{"role": "user", "content": post.message}]
        })
        
        # Extract response text
        last_message = response["messages"][-1]
        self._send_response(post.channel_id, last_message.content)
```

### HTTP Transport with Authentication

```python
# Source: langchain-mcp-adapters docs
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "secure_server": {
        "transport": "http",
        "url": "https://api.example.com/mcp",
        "headers": {
            "Authorization": "Bearer ${API_TOKEN}",
            "X-Custom-Header": "value",
        },
    },
})
```

### STDIO Transport for Local Tools

```python
# Source: langchain-mcp-adapters docs
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "local_tools": {
        "transport": "stdio",
        "command": "python",
        "args": ["/absolute/path/to/tool_server.py"],
        # Optional: environment variables
        # "env": {"DEBUG": "1"},
    },
})
```

### Creating a Test MCP Server

```python
# Source: mcp SDK docs - use for testing
# math_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    return a * b

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Using with LangGraph StateGraph (Advanced)

```python
# Source: langchain-mcp-adapters docs
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, MessagesState, START
from langgraph.prebuilt import ToolNode, tools_condition
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o")

client = MultiServerMCPClient({...})
tools = await client.get_tools()

def call_model(state: MessagesState):
    response = model.bind_tools(tools).invoke(state["messages"])
    return {"messages": response}

builder = StateGraph(MessagesState)
builder.add_node(call_model)
builder.add_node(ToolNode(tools))
builder.add_edge(START, "call_model")
builder.add_conditional_edges("call_model", tools_condition)
builder.add_edge("tools", "call_model")
graph = builder.compile()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE transport | Streamable HTTP | MCP spec 2025-03-26 | Better scalability, JSON responses |
| Manual tool conversion | `load_mcp_tools()` | langchain-mcp-adapters 0.1.0 | Automatic schema handling |
| Single server clients | `MultiServerMCPClient` | langchain-mcp-adapters 0.2.0 | Multi-server support |
| `http` transport name | `streamable-http` (alias `http`) | MCP spec 2025-03-26 | Clearer naming |

**Deprecated/outdated:**
- SSE transport: Deprecated in favor of Streamable HTTP (2025-03-26 spec)
- Direct `ClientSession` usage: Prefer `MultiServerMCPClient` for simplified management
- `LLMChain` with tools: Use `create_agent()` instead

## Open Questions

Things that couldn't be fully resolved:

1. **Plugin Configuration Schema**
   - What we know: MCP servers need transport, command/url, optional headers
   - What's unclear: Best way to expose this in plugin.json settings
   - Recommendation: Use JSON configuration in plugin settings, parse on activation

2. **Event Loop Management**
   - What we know: MCP adapters are async, Mattermost hooks can be sync or async
   - What's unclear: Whether plugin SDK runs async hooks or needs wrapping
   - Recommendation: Test both patterns; use `asyncio.run()` if sync hooks

3. **Server Discovery**
   - What we know: Servers must be pre-configured
   - What's unclear: Whether dynamic discovery is needed for our use case
   - Recommendation: Start with static configuration; add discovery later if needed

4. **Error Recovery**
   - What we know: Network failures, server crashes can happen
   - What's unclear: Best retry strategy for production
   - Recommendation: Use interceptors for retry logic, log failures clearly

## Sources

### Primary (HIGH confidence)
- PyPI langchain-mcp-adapters (v0.2.1) - https://pypi.org/project/langchain-mcp-adapters/
- PyPI mcp (v1.25.0) - https://pypi.org/project/mcp/
- LangChain MCP documentation - https://docs.langchain.com/oss/python/langchain/mcp
- GitHub langchain-mcp-adapters - https://github.com/langchain-ai/langchain-mcp-adapters
- MCP Specification (2025-03-26) - https://modelcontextprotocol.io/specification/2025-03-26/

### Secondary (MEDIUM confidence)
- MCP Introduction - https://modelcontextprotocol.io/introduction
- MCP Transports specification - https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- MCP Tools specification - https://modelcontextprotocol.io/specification/2025-03-26/server/tools

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official PyPI packages and LangChain documentation
- Architecture: HIGH - Patterns from official langchain-mcp-adapters docs and examples
- Pitfalls: MEDIUM - Combination of docs, GitHub issues, and common async patterns
- Transport details: HIGH - MCP specification is authoritative

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - MCP and langchain-mcp-adapters are stable)

## Phase Integration Notes

### Integration with Phase 15 (LangChain Core)
- MCP tools work with Phase 15's `ChatOpenAI` and `ChatAnthropic` models
- Use `create_agent(model, tools)` to combine model with MCP tools
- Model instances created in Phase 15 can be directly passed to `create_agent()`

### Integration with Phase 16 (Session Memory)
- MCP client is stateless by default - compatible with session-based memory
- Agent state (conversation history) managed separately from MCP sessions
- Memory can track tool usage across conversations

### Preparation for Phase 18 (Agentic Loop)
- `create_agent()` provides the agentic loop (ReAct pattern)
- MCP tools become actions the agent can take
- Phase 18 may add custom loop logic, tool selection strategies
