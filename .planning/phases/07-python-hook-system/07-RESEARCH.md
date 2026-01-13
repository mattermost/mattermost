# Phase 7: Python Hook System - Research

**Researched:** 2026-01-13
**Domain:** Python hook registration patterns + gRPC bidirectional streaming for callbacks
**Confidence:** HIGH

<research_summary>
## Summary

Researched Pythonic patterns for implementing a plugin hook system where Python plugins receive callbacks from the Mattermost server via gRPC. Mattermost has 40+ hooks (OnActivate, MessageWillBePosted, ServeHTTP, etc.) that need to be invoked by the Go server and handled by Python plugins.

Key findings:
1. **Decorator-based registration is the Pythonic standard** - Flask, FastAPI, and modern Python frameworks use decorators (@hook) for callback registration
2. **grpcio server with ThreadPoolExecutor** is standard for implementing servicers that receive RPC calls (the plugin acts as a gRPC server)
3. **__init_subclass__ for class-based registration** - Simpler than metaclasses, enables automatic hook discovery by inheriting from Plugin base class
4. **AsyncIO is recommended over threading** for grpcio servers - better resource utilization, single-threaded event loop avoids thread safety issues
5. **Context object pattern** - ServicerContext provides error handling via set_code() and set_details(), matches gRPC status codes
6. **Type hints with ParamSpec** - Preserve function signatures in decorators for IDE autocomplete and type checking

**Primary recommendation:** Hybrid approach - decorator-based registration (@hook decorator) on methods of a Plugin base class (using __init_subclass__ for automatic discovery). Plugin runs asyncio gRPC server receiving hook calls from Go. Use grpcio-tools for code generation, grpc.StatusCode for error propagation.
</research_summary>

<standard_stack>
## Standard Stack

### Core (Python Side)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grpcio | v1.60+ | gRPC framework for Python | Official Google implementation, mature async support |
| grpcio-tools | v1.60+ | Protocol buffer compiler | Code generation for servicers |
| protobuf | v4.25+ | Protocol buffer runtime | Required for message serialization |

### Concurrency Model
| Approach | Version | Purpose | Why Standard |
|----------|---------|---------|--------------|
| asyncio | Python 3.11+ | Event loop for async gRPC | Single-threaded, better performance than threading for RPC |
| grpc.aio | Part of grpcio | Async gRPC API | Official async implementation, recommended modern approach |

### Type Hints & Decorators
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| typing.ParamSpec | Python 3.10+ | Preserve function signatures in decorators | All hook decorators |
| functools.wraps | Stdlib | Preserve metadata (__name__, __doc__) | All decorators |
| typing.Callable | Stdlib | Type hint for callable objects | Hook registry type hints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Decorator registration | __init_subclass__ only | Decorators are more explicit, better for optional hooks |
| asyncio | Threading with ThreadPoolExecutor | Threading has GIL overhead, worse performance per gRPC docs |
| grpc.aio.server | grpc.server (sync) | Sync server blocks threads, async recommended for performance |
| Method decorators | Function decorators | Methods allow access to self.api, self.logger in hooks |

**Installation:**
```bash
pip install grpcio grpcio-tools protobuf
# Or in requirements.txt
grpcio>=1.60.0
grpcio-tools>=1.60.0
protobuf>=4.25.0
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
python-sdk/
├── mattermost_plugin/
│   ├── grpc/                      # Generated code from Phase 1-3
│   │   ├── hooks_pb2.py
│   │   └── hooks_pb2_grpc.py
│   ├── plugin.py                  # Base Plugin class with __init_subclass__
│   ├── hooks.py                   # Hook decorator and registry
│   ├── server.py                  # gRPC server lifecycle management
│   └── decorators.py              # Utility decorators (error handling, etc.)
examples/
├── example_plugin/
│   └── main.py                    # Example plugin implementation
```

### Pattern 1: Decorator-Based Hook Registration
**What:** @hook decorator registers methods to be invoked when server calls hook
**When to use:** All plugin hooks (lifecycle, messages, users, etc.)
**Example:**
```python
# mattermost_plugin/hooks.py
from typing import Callable, TypeVar, ParamSpec
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

# Registry: hook_name -> list of handler functions
_hook_registry: dict[str, list[Callable]] = {}

def hook(name: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Register a method as a hook handler"""
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        if name not in _hook_registry:
            _hook_registry[name] = []
        _hook_registry[name].append(func)

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Usage in plugin
from mattermost_plugin import Plugin, hook

class MyPlugin(Plugin):

    @hook("on_activate")
    def on_activate(self) -> None:
        """Called when plugin starts"""
        self.logger.info("Plugin activated")

    @hook("message_will_be_posted")
    def message_filter(self, post) -> tuple[object, str]:
        """Called before message is posted"""
        if "badword" in post.message.lower():
            return None, "Message rejected"
        return post, ""
```

### Pattern 2: Plugin Base Class with __init_subclass__
**What:** Base class automatically discovers hooks using __init_subclass__
**When to use:** Plugin class structure for all Python plugins
**Example:**
```python
# mattermost_plugin/plugin.py
from typing import Optional
import grpc

class Plugin:
    """Base class for all Mattermost Python plugins"""

    # Class-level hook registry populated by subclasses
    _hooks: dict[str, Callable] = {}

    def __init_subclass__(cls, **kwargs):
        """Called when Plugin is subclassed - discovers decorated hooks"""
        super().__init_subclass__(**kwargs)

        # Scan class methods for @hook decorations
        for name, method in cls.__dict__.items():
            if hasattr(method, '_hook_name'):
                hook_name = method._hook_name
                cls._hooks[hook_name] = method

    def __init__(self, api_client: grpc.Channel):
        self.api = PluginAPI(api_client)
        self.logger = logging.getLogger(self.__class__.__name__)

    def has_hook(self, hook_name: str) -> bool:
        """Check if plugin implements a hook"""
        return hook_name in self._hooks

    def invoke_hook(self, hook_name: str, *args, **kwargs):
        """Invoke a hook if implemented"""
        if hook_name in self._hooks:
            handler = self._hooks[hook_name]
            return handler(self, *args, **kwargs)
        return None
```

### Pattern 3: AsyncIO gRPC Server for Hook Callbacks
**What:** Plugin runs async gRPC server, Go server acts as client calling hooks
**When to use:** Plugin server startup in main()
**Example:**
```python
# mattermost_plugin/server.py
import grpc.aio
from .grpc import hooks_pb2_grpc
from .plugin import Plugin

class PluginHooksServicer(hooks_pb2_grpc.PluginHooksServicer):
    """gRPC servicer that receives hook calls from Mattermost server"""

    def __init__(self, plugin_instance: Plugin):
        self.plugin = plugin_instance

    async def OnActivate(self, request, context):
        """Called when plugin is activated"""
        try:
            self.plugin.invoke_hook("on_activate")
            return hooks_pb2.OnActivateResponse()
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return hooks_pb2.OnActivateResponse()

    async def MessageWillBePosted(self, request, context):
        """Called before message is posted"""
        try:
            post, reject_reason = self.plugin.invoke_hook(
                "message_will_be_posted",
                request.post
            )
            return hooks_pb2.MessageWillBePostedResponse(
                post=post,
                reject_reason=reject_reason
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Hook error: {e}")
            raise

async def serve_plugin(plugin: Plugin, port: int):
    """Start async gRPC server for plugin hooks"""
    server = grpc.aio.server()
    hooks_pb2_grpc.add_PluginHooksServicer_to_server(
        PluginHooksServicer(plugin),
        server
    )
    server.add_insecure_port(f'127.0.0.1:{port}')
    await server.start()
    await server.wait_for_termination()
```

### Pattern 4: Error Handling in Hooks
**What:** Use gRPC status codes for structured error responses
**When to use:** All hook implementations that can fail
**Example:**
```python
# In servicer
async def UserWillLogIn(self, request, context):
    """Hook that can reject login"""
    try:
        reject_reason = self.plugin.invoke_hook("user_will_log_in", request.user)

        if reject_reason:
            # Login rejected - this is NOT an error, it's expected behavior
            return hooks_pb2.UserWillLogInResponse(reject_reason=reject_reason)

        return hooks_pb2.UserWillLogInResponse(reject_reason="")

    except ValueError as e:
        # Expected error - invalid input
        context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
        context.set_details(str(e))
        return hooks_pb2.UserWillLogInResponse(reject_reason="Invalid user data")

    except Exception as e:
        # Unexpected error - plugin bug
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(f"Plugin error: {e}")
        self.plugin.logger.exception("Hook failed")
        return hooks_pb2.UserWillLogInResponse(reject_reason="")
```

### Pattern 5: Flask-Style Hook Decorator (Optional Alternative)
**What:** Simplified decorator without explicit names, infers from function name
**When to use:** When hook names exactly match method names
**Example:**
```python
# Alternative: auto-detect hook name from function name
def hook(func: Callable[P, R]) -> Callable[P, R]:
    """Register function as hook handler based on function name"""
    hook_name = func.__name__  # on_activate -> on_activate
    func._hook_name = hook_name  # Mark for __init_subclass__ discovery

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return func(*args, **kwargs)
    return wrapper

# Usage - no need to specify hook name
class MyPlugin(Plugin):
    @hook
    def on_activate(self):  # Name automatically becomes hook name
        pass

    @hook
    def message_will_be_posted(self, post):
        return post, ""
```

### Pattern 6: Bidirectional Streaming (Future - Phase 8)
**What:** Use async generators for streaming hooks like ServeHTTP
**When to use:** Phase 8 - ServeHTTP hook with request/response streaming
**Example:**
```python
# Phase 8 preview - not needed for Phase 7
async def ServeHTTP(self, request_iterator, context):
    """Stream HTTP request chunks, yield response chunks"""
    # Accumulate request
    request = await self._accumulate_request(request_iterator)

    # Invoke plugin hook
    response = self.plugin.invoke_hook("serve_http", request)

    # Stream response back
    async for chunk in self._stream_response(response):
        yield chunk
```

### Anti-Patterns to Avoid
- **Not using @wraps in decorators:** Loses __name__, __doc__, breaks introspection
- **Blocking operations in async hooks:** Blocks event loop, starves other RPCs - use asyncio.to_thread() for blocking work
- **Raising exceptions without context.set_code():** Client gets UNKNOWN error instead of proper status code
- **Threading with grpcio server:** Lower performance than asyncio per official gRPC docs
- **Forgetting super().__init_subclass__():** Breaks MRO chain, prevents mixin usage
- **Global state in decorators:** Not thread-safe, use instance attributes instead
- **Not preserving signatures with ParamSpec:** Breaks IDE autocomplete and type checking
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gRPC async server | Custom asyncio server | grpc.aio.server() | Handles connection management, concurrent requests, graceful shutdown, error handling |
| Decorator signature preservation | Manual wrapper with *args, **kwargs | functools.wraps + ParamSpec | Preserves __name__, __doc__, type hints, IDE understands decorated functions |
| Hook registry management | Custom dict with manual add/remove | __init_subclass__ pattern | Automatic registration on class definition, no manual bookkeeping |
| Error status codes | String error messages | grpc.StatusCode enum + context.set_code() | Structured errors, client can handle specific cases (NOT_FOUND vs INTERNAL) |
| Method discovery | inspect.getmembers() at runtime | Decorator marks + __init_subclass__ | Discovery at class definition time, no runtime introspection overhead |
| Exception handling in hooks | Try/except in every hook | Error handling decorator | DRY, consistent error propagation, logging in one place |
| Type hints for decorators | No types or manual Callable | ParamSpec + TypeVar | Type checker validates decorator usage, IDE autocomplete works |

**Key insight:** Python's decorator ecosystem and gRPC's async support are mature and battle-tested. Flask has used decorator-based callback registration for 15+ years (before_request, after_request, route). grpcio's async API is the recommended modern approach per official docs. ParamSpec (Python 3.10+) solved decorator typing properly after years of workarounds. Fighting these patterns means:
- Losing IDE support (no autocomplete, no type checking)
- Manual error handling boilerplate in every hook
- Thread safety issues (threading vs asyncio)
- Debugging difficulty (implicit registration vs explicit decorators)
- Performance issues (threading overhead vs async event loop)

Don't hand-roll any of these - use the standard patterns that Python and gRPC communities converged on.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Blocking Operations in Async Hooks
**What goes wrong:** Plugin becomes unresponsive, other hooks timeout, server marks plugin unhealthy
**Why it happens:** Calling time.sleep(), requests.get(), or file I/O in async hook blocks event loop
**How to avoid:** Use await asyncio.sleep(), aiohttp for HTTP, aiofiles for I/O, or asyncio.to_thread() for sync libraries
**Warning signs:** Other plugins' hooks slow down, "coroutine not awaited" warnings, server logs plugin timeouts

### Pitfall 2: Forgetting functools.wraps in Decorators
**What goes wrong:** Hook function loses __name__, __doc__, type hints - IDE autocomplete breaks, debugging shows "wrapper" instead of actual function name
**Why it happens:** Decorator returns new function without copying metadata
**How to avoid:** Always use @wraps(func) in decorator implementation
**Warning signs:** Stack traces show "wrapper" instead of hook names, help() shows decorator docstring not hook docstring

### Pitfall 3: Not Setting gRPC Status Code on Errors
**What goes wrong:** Client receives grpc.StatusCode.UNKNOWN for all errors, can't distinguish "user not found" from "database down"
**Why it happens:** Raising Python exception without context.set_code() defaults to UNKNOWN
**How to avoid:** Use context.set_code(grpc.StatusCode.NOT_FOUND) etc. before raising or returning
**Warning signs:** All errors show as UNKNOWN in server logs, client can't handle specific error types

### Pitfall 4: Threading Instead of AsyncIO for gRPC Server
**What goes wrong:** Poor performance, thread exhaustion under load, GIL contention
**Why it happens:** Using grpc.server(futures.ThreadPoolExecutor()) instead of grpc.aio.server()
**How to avoid:** Use grpc.aio.server() - official docs say "asyncio could improve performance"
**Warning signs:** High thread count, poor concurrency, CPU-bound despite I/O workload

### Pitfall 5: Module Import Side Effects for Decorator Registration
**What goes wrong:** Hook never registers because module was never imported
**Why it happens:** Decorator runs at import time - if module not imported, decorator never executes
**How to avoid:** Import all plugin module files in main.py, or use __init_subclass__ which runs when class is defined
**Warning signs:** Hook silently never called, no error messages, works in dev but not production

### Pitfall 6: Mutable Default Arguments in Decorator Registry
**What goes wrong:** Hook registry shared across plugin instances, one plugin's hooks affect another
**Why it happens:** Python evaluates default arguments once at function definition: def hook(registry={}): ...
**How to avoid:** Use None as default and create new dict inside: def hook(registry=None): registry = registry or {}
**Warning signs:** Hooks from one plugin instance called in another instance, weird cross-plugin behavior

### Pitfall 7: Not Preserving Signature with ParamSpec
**What goes wrong:** Type checker can't validate hook function signatures, IDE autocomplete doesn't work
**Why it happens:** Using Callable[..., Any] instead of Callable[P, R] with ParamSpec
**How to avoid:** Use P = ParamSpec("P") and Callable[P, R] in decorator type hints
**Warning signs:** mypy/pyright don't catch signature errors, IDE shows generic *args/**kwargs instead of actual parameters

### Pitfall 8: Async Decorator on Sync Function (or vice versa)
**What goes wrong:** RuntimeWarning: coroutine was never awaited, or hook blocks event loop
**Why it happens:** Decorator doesn't detect if function is async and adjust wrapper accordingly
**How to avoid:** Use inspect.iscoroutinefunction() to detect async, create appropriate wrapper
**Warning signs:** "Coroutine never awaited" warnings, mysterious hangs, hooks not executing

### Pitfall 9: Not Handling None Return Values in Hooks
**What goes wrong:** NoneType errors when hook returns None but server expects object
**Why it happens:** Hook like MessageWillBePosted can return None (allow post) but protobuf expects message
**How to avoid:** Check return value, use original message if None: result = hook_result if hook_result is not None else original
**Warning signs:** TypeError: NoneType object is not iterable, crashes on None returns

### Pitfall 10: Context Object Not Thread-Safe Across Hooks
**What goes wrong:** Context.set_code() from one hook affects another hook's context
**Why it happens:** Reusing same context object across multiple hook invocations
**How to avoid:** Each RPC call gets own context - never store context globally, always use parameter
**Warning signs:** Error codes bleeding between hook calls, wrong status codes on client
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Decorator-Based Hook Registration Pattern
```python
# Source: https://blog.miguelgrinberg.com/post/the-ultimate-guide-to-python-decorators-part-i-function-registration
# Adapted for Mattermost plugin hooks
from typing import Callable, TypeVar, ParamSpec
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def hook(func: Callable[P, R]) -> Callable[P, R]:
    """
    Decorator to register a method as a plugin hook handler.

    The hook name is inferred from the method name.
    Example: def on_activate(self) -> @hook converts to "on_activate" hook.
    """
    # Mark function with hook metadata for __init_subclass__ discovery
    func._is_hook = True
    func._hook_name = func.__name__

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        # Decorator is transparent - just registers, doesn't modify behavior
        return func(*args, **kwargs)

    return wrapper


# Usage in plugin
class MyPlugin(Plugin):

    @hook
    def on_activate(self) -> None:
        """Called when plugin is activated"""
        self.logger.info("Plugin starting")
        user = self.api.get_user("admin")
        self.logger.info(f"Admin user: {user.username}")

    @hook
    def message_will_be_posted(self, post) -> tuple[object, str]:
        """Filter messages before posting"""
        if "spam" in post.message.lower():
            return None, "Message rejected: spam detected"
        return post, ""  # Allow message
```

### Plugin Base Class with __init_subclass__
```python
# Source: https://peps.python.org/pep-0487/ (PEP 487 - Simpler class customisation)
# Pattern: Automatic hook discovery using __init_subclass__
import logging
from typing import Dict, Callable

class Plugin:
    """
    Base class for all Mattermost Python plugins.

    Automatically discovers methods decorated with @hook when subclass is defined.
    """

    def __init_subclass__(cls, **kwargs):
        """Called when Plugin is subclassed - discovers @hook decorated methods"""
        super().__init_subclass__(**kwargs)

        # Build hook registry for this plugin class
        cls._hook_registry: Dict[str, Callable] = {}

        # Scan all methods in the class
        for attr_name in dir(cls):
            attr = getattr(cls, attr_name)

            # Check if method has _is_hook marker from @hook decorator
            if callable(attr) and hasattr(attr, '_is_hook'):
                hook_name = attr._hook_name
                cls._hook_registry[hook_name] = attr
                logging.debug(f"Registered hook: {cls.__name__}.{hook_name}")

    def __init__(self, api_channel):
        """Initialize plugin with API client"""
        from .api import PluginAPI
        self.api = PluginAPI(api_channel)
        self.logger = logging.getLogger(self.__class__.__name__)

    def has_hook(self, hook_name: str) -> bool:
        """Check if this plugin implements a specific hook"""
        return hook_name in self._hook_registry

    def invoke_hook(self, hook_name: str, *args, **kwargs):
        """
        Invoke a hook if implemented by this plugin.

        Returns None if hook not implemented.
        Propagates exceptions from hook implementation.
        """
        if not self.has_hook(hook_name):
            return None

        handler = self._hook_registry[hook_name]
        return handler(self, *args, **kwargs)
```

### AsyncIO gRPC Server for Plugin Hooks
```python
# Source: https://grpc.io/docs/languages/python/basics/ + https://grpc.github.io/grpc/python/grpc_asyncio.html
# Pattern: Async gRPC servicer receiving hook calls from Mattermost server
import grpc.aio
from typing import Optional
from .grpc import hooks_pb2, hooks_pb2_grpc
from .plugin import Plugin

class PluginHooksServicer(hooks_pb2_grpc.PluginHooksServicer):
    """
    gRPC servicer that receives hook invocations from Mattermost server.

    The Go server acts as a gRPC client calling these methods.
    The Python plugin acts as a gRPC server responding to hook calls.
    """

    def __init__(self, plugin_instance: Plugin):
        self.plugin = plugin_instance

    async def OnActivate(self, request, context: grpc.aio.ServicerContext):
        """
        Lifecycle hook - plugin is being activated.

        This is the first hook called. Plugin should initialize here.
        """
        try:
            error = self.plugin.invoke_hook("on_activate")

            if error:
                # OnActivate returned error - reject activation
                context.set_code(grpc.StatusCode.FAILED_PRECONDITION)
                context.set_details(error)
                return hooks_pb2.OnActivateResponse(error=error)

            return hooks_pb2.OnActivateResponse()

        except Exception as e:
            # Unexpected error during activation
            self.plugin.logger.exception("OnActivate hook failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Plugin activation failed: {e}")
            return hooks_pb2.OnActivateResponse(error=str(e))

    async def MessageWillBePosted(self, request, context: grpc.aio.ServicerContext):
        """
        Message hook - called before message is saved to database.

        Plugin can reject, modify, or allow message.
        """
        try:
            result = self.plugin.invoke_hook("message_will_be_posted", request.post)

            if result is None:
                # Hook not implemented - allow message unchanged
                return hooks_pb2.MessageWillBePostedResponse(
                    post=request.post,
                    reject_reason=""
                )

            modified_post, reject_reason = result

            if reject_reason:
                # Message rejected
                return hooks_pb2.MessageWillBePostedResponse(
                    post=None,
                    reject_reason=reject_reason
                )

            # Message allowed (possibly modified)
            return hooks_pb2.MessageWillBePostedResponse(
                post=modified_post or request.post,
                reject_reason=""
            )

        except Exception as e:
            # Error in hook - log and allow message (fail open)
            self.plugin.logger.exception("MessageWillBePosted hook failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Hook error: {e}")
            return hooks_pb2.MessageWillBePostedResponse(
                post=request.post,
                reject_reason=""
            )

async def serve_plugin(plugin: Plugin, port: int = 50051):
    """
    Start async gRPC server for plugin hooks.

    This function blocks until server terminates.
    """
    server = grpc.aio.server()

    hooks_pb2_grpc.add_PluginHooksServicer_to_server(
        PluginHooksServicer(plugin),
        server
    )

    # Bind to localhost only - security
    listen_addr = f'127.0.0.1:{port}'
    server.add_insecure_port(listen_addr)

    await server.start()
    plugin.logger.info(f"Plugin gRPC server listening on {listen_addr}")

    # Block until terminated
    await server.wait_for_termination()
```

### Error Handling Pattern with Status Codes
```python
# Source: https://grpc.io/docs/guides/error/ + https://grpc.github.io/grpc/python/grpc.html
# Pattern: Structured error handling with gRPC status codes
import grpc.aio

async def ExecuteCommand(self, request, context: grpc.aio.ServicerContext):
    """
    Execute slash command - demonstrates error handling patterns.
    """
    try:
        # Invoke plugin hook
        response = self.plugin.invoke_hook("execute_command", request.args)

        if response is None:
            # Hook not implemented or returned None
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(f"Command '{request.args.command}' not implemented")
            return hooks_pb2.ExecuteCommandResponse(
                response=None,
                error="Command not found"
            )

        return hooks_pb2.ExecuteCommandResponse(response=response, error="")

    except KeyError as e:
        # Missing required data
        context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
        context.set_details(f"Invalid command arguments: {e}")
        return hooks_pb2.ExecuteCommandResponse(error=str(e))

    except PermissionError as e:
        # User not authorized
        context.set_code(grpc.StatusCode.PERMISSION_DENIED)
        context.set_details(f"Permission denied: {e}")
        return hooks_pb2.ExecuteCommandResponse(error="Permission denied")

    except Exception as e:
        # Unexpected error
        self.plugin.logger.exception("ExecuteCommand hook failed")
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(f"Internal error: {e}")
        return hooks_pb2.ExecuteCommandResponse(error="Internal error")
```

### Type-Safe Decorator with ParamSpec
```python
# Source: https://docs.python.org/3/library/typing.html#typing.ParamSpec
# Source: https://buutticonsulting.com/en/blog/2024/11/26/type-hinting-python-decorators-part-1/
# Pattern: Modern decorator with full type preservation (Python 3.10+)
from typing import Callable, TypeVar, ParamSpec
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def hook(func: Callable[P, R]) -> Callable[P, R]:
    """
    Type-safe hook decorator that preserves function signature.

    ParamSpec (P) captures all parameters (positional, keyword, types).
    TypeVar (R) captures return type.
    IDE and type checkers understand the decorated function's exact signature.
    """
    func._is_hook = True
    func._hook_name = func.__name__

    @wraps(func)  # Preserves __name__, __doc__, __annotations__
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return func(*args, **kwargs)

    return wrapper

# Type checker validates this works
@hook
def on_activate(self) -> None:
    pass

# Type checker catches this error - wrong signature
@hook
def message_will_be_posted(self, post: int) -> str:  # ❌ Should return tuple[object, str]
    return "error"

# IDE autocomplete knows exact parameters and return type
# mypy/pyright validate hook signatures match expected types
```

### Error Handling Decorator (Utility Pattern)
```python
# Source: https://medium.com/@stefan.herdy/upgrade-your-python-exception-handling-with-decorators-e30cc6a4eefa
# Pattern: Reusable error handling for all hooks
from functools import wraps
import logging

def handle_hook_errors(default_return=None):
    """
    Decorator that catches exceptions in hooks and logs them.

    Prevents one failing hook from crashing the entire plugin.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                return func(self, *args, **kwargs)
            except Exception as e:
                logger = getattr(self, 'logger', logging.getLogger(__name__))
                logger.exception(f"Hook {func.__name__} failed")
                return default_return
        return wrapper
    return decorator

# Usage
class MyPlugin(Plugin):

    @hook
    @handle_hook_errors(default_return=("", None))
    def message_will_be_posted(self, post):
        # If this raises, decorator catches and returns ("", None)
        result = self.some_risky_operation(post)
        return result, ""
```

### Complete Plugin Example
```python
# Example: Complete plugin using all patterns
import logging
from mattermost_plugin import Plugin, hook, serve_plugin

class ExamplePlugin(Plugin):
    """Example plugin demonstrating hook patterns"""

    def __init__(self, api_channel):
        super().__init__(api_channel)
        self.message_count = 0

    @hook
    def on_activate(self) -> None:
        """Initialize plugin"""
        self.logger.info("Plugin activated")
        # Can call API methods
        user = self.api.get_user("admin")
        self.logger.info(f"Found admin: {user.username}")

    @hook
    def message_will_be_posted(self, post) -> tuple:
        """Filter messages"""
        self.message_count += 1

        if "spam" in post.message.lower():
            return None, "Spam detected"

        # Allow message
        return post, ""

    @hook
    def user_has_logged_in(self, user) -> None:
        """React to user login"""
        self.logger.info(f"User logged in: {user.username}")
        # Post welcome message
        post = self.api.create_post(
            channel_id="town-square",
            message=f"Welcome back, {user.username}!"
        )

# Main entry point
if __name__ == "__main__":
    import asyncio
    import grpc

    # Create API client channel (received from go-plugin handshake)
    api_channel = grpc.insecure_channel('localhost:50051')

    # Create plugin instance
    plugin = ExamplePlugin(api_channel)

    # Start gRPC server to receive hook calls
    asyncio.run(serve_plugin(plugin, port=50052))
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeVar("T") for decorators | ParamSpec + TypeVar | Python 3.10 (2021) | Full signature preservation, IDE autocomplete works |
| grpc.server(ThreadPoolExecutor) | grpc.aio.server() | grpcio 1.32+ (2020) | Better performance, recommended modern approach |
| Manual type hints | Python 3.12+ [**P, T] syntax | Python 3.12 (2023) | Cleaner generic syntax |
| Metaclasses for registration | __init_subclass__ | Python 3.6+ (2016) | Simpler, no metaclass conflicts |
| Decorator without wraps | Always use @wraps | Longstanding | Preserves metadata, debugging works |

**New tools/patterns to consider:**
- **Python 3.12+ decorator syntax:** `def decorator[**P, T](func: Callable[P, T]) -> Callable[P, T]:` - cleaner than ParamSpec("P")
- **grpc-interceptor library:** Middleware for gRPC servers (logging, auth, metrics) - not essential but useful
- **grpc-status library:** Rich error details with multiple error messages - advanced error handling
- **typing.Protocol:** Structural subtyping for plugin interfaces - alternative to base class
- **wrapt library:** Advanced decorator tools if functools.wraps insufficient - generally not needed

**Deprecated/outdated:**
- **Callable[..., Any] for decorators:** Use ParamSpec for proper type preservation
- **grpc.server (sync) for new projects:** Use grpc.aio.server (async)
- **Metaclasses for plugin registration:** Use __init_subclass__ instead
- **Manual wrapper without @wraps:** Always use functools.wraps
- **Function-based plugins:** Use class-based Plugin with instance methods for cleaner state management
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Async vs sync hook implementations**
   - What we know: gRPC servicer should be async, but plugin hooks might be sync functions
   - What's unclear: Best pattern for supporting both sync and async hook implementations
   - Recommendation: Start with sync hooks in Phase 7, wrap in asyncio.to_thread() if needed. Add native async hook support in later phase if performance requires it.

2. **Hook timeout handling**
   - What we know: Server needs to timeout slow hooks to prevent blocking
   - What's unclear: Should timeout be per-hook, global, or configurable per plugin?
   - Recommendation: Implement timeout in servicer using asyncio.wait_for(), start with 30s global timeout, make configurable in Phase 9 manifest.

3. **Hook error reporting to plugin developer**
   - What we know: Errors should be logged, but how should plugin know hook failed?
   - What's unclear: Should there be a hook_error callback, or just rely on logging?
   - Recommendation: Log errors via standard Python logging, let plugin configure handlers. Don't add hook_error callback (infinite loop potential).

4. **Multiple hooks with same name**
   - What we know: Flask allows multiple @before_request decorators
   - What's unclear: Should Mattermost plugins support multiple handlers per hook?
   - Recommendation: Start with single handler per hook (simpler, matches Go plugin pattern). Add multiple handlers if user requests it.

5. **Hook discovery vs explicit registration**
   - What we know: __init_subclass__ auto-discovers, but requires inheritance
   - What's unclear: Should we support standalone functions as hooks (no Plugin base class)?
   - Recommendation: Require Plugin base class for Phase 7 (simpler, gives self.api access). Add standalone function support if needed later.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [gRPC Python Basics Tutorial](https://grpc.io/docs/languages/python/basics/) - Official servicer implementation patterns
- [gRPC AsyncIO API Documentation](https://grpc.github.io/grpc/python/grpc_asyncio.html) - Async server patterns, thread safety
- [PEP 487 - Simpler Customisation of Class Creation](https://peps.python.org/pep-0487/) - __init_subclass__ for plugin registration
- [Python typing Documentation](https://docs.python.org/3/library/typing.html) - ParamSpec and decorator typing
- [The Ultimate Guide to Python Decorators, Part I: Function Registration](https://blog.miguelgrinberg.com/post/the-ultimate-guide-to-python-decorators-part-i-function-registration) - Decorator registration pattern
- [gRPC Error Handling Guide](https://grpc.io/docs/guides/error/) - Status codes and error patterns
- [Mattermost Plugin Hooks (Go)](https://github.com/mattermost/mattermost/blob/master/server/public/plugin/hooks.go) - Existing hook signatures

### Secondary (MEDIUM confidence)
- [Using gRPC with Python Best Practices Guide](https://speedscale.com/blog/using-grpc-with-python/) - Verified servicer patterns against official docs
- [Type Hinting Python Decorators (Nov 2024)](https://buutticonsulting.com/en/blog/2024/11/26/type-hinting-python-decorators-part-1/) - ParamSpec patterns for Python 3.13
- [Decorated Plugins](https://kaleidoescape.github.io/decorated-plugins/) - Verified decorator registration pattern
- [Flask before/after request decorators](https://medium.com/innovation-incubator/flask-before-and-after-request-decorators-e639b06c2128) - Real-world hook pattern example
- [Python Registry Pattern (DEV.to)](https://dev.to/dentedlogic/stop-writing-giant-if-else-chains-master-the-python-registry-pattern-ldm) - __init_subclass__ for registry
- [Upgrade Python Exception Handling With Decorators](https://medium.com/@stefan.herdy/upgrade-your-python-exception-handling-with-decorators-e30cc6a4eefa) - Error handling decorator patterns

### Tertiary (LOW confidence - needs validation during implementation)
- [Python Decorator Best Practices](https://www.pythontutorials.net/blog/python-decorator-best-practice-using-a-class-vs-a-function/) - General guidance
- Various Stack Overflow discussions on decorator typing - cross-checked with official typing docs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Python decorators + gRPC async servicers
- Ecosystem: grpcio, grpc.aio, typing, functools
- Patterns: Hook registration (decorator vs __init_subclass__), gRPC server patterns, error handling
- Pitfalls: Blocking operations, signature preservation, error propagation, import side effects
- Existing system: Mattermost has 40+ hooks with specific signatures

**Confidence breakdown:**
- Standard stack: HIGH - grpcio is official Google implementation, mature and stable
- Decorator patterns: HIGH - Well-established Python pattern used by Flask, FastAPI, etc.
- AsyncIO vs Threading: HIGH - Official gRPC docs explicitly recommend asyncio
- Type hints with ParamSpec: HIGH - Official Python typing feature since 3.10
- __init_subclass__ pattern: HIGH - PEP 487 accepted, standard Python feature since 3.6
- Error handling: MEDIUM - gRPC patterns clear, but plugin-specific error propagation needs design

**Research date:** 2026-01-13
**Valid until:** 2026-02-13 (30 days - Python and gRPC are stable, but check for grpcio minor updates)

**Critical decision points for planning:**
1. ✅ USE decorator-based registration (@hook decorator)
2. ✅ USE Plugin base class with __init_subclass__ for auto-discovery
3. ✅ USE grpc.aio.server() (async) not grpc.server() (threading)
4. ✅ USE ParamSpec for type-safe decorators (Python 3.10+)
5. ✅ USE context.set_code() for structured error responses
6. ✅ PLUGIN acts as gRPC server, GO server acts as client (bidirectional pattern)
7. ⚠️ Need to handle both sync and async hook implementations (start with sync)
8. ⚠️ Need timeout mechanism for long-running hooks (use asyncio.wait_for)
9. ⚠️ Need to integrate with go-plugin handshake from Phase 1 research

**Integration with prior phases:**
- Phase 1: Protocol foundation defines gRPC infrastructure
- Phase 3: Hook protobuf definitions define service interface
- Phase 6: Python SDK core provides PluginAPI client for self.api calls
- Phase 7 (this phase): Implements hook receiving side (servicer)
- Phase 8: ServeHTTP streaming will extend this hook system
</metadata>

---

*Phase: 07-python-hook-system*
*Research completed: 2026-01-13*
*Ready for planning: yes*
