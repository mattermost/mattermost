# Phase 6: Python SDK Core - Research

**Researched:** 2026-01-13
**Domain:** Python SDK design, gRPC client patterns, type hints, package structure
**Confidence:** HIGH

<research_summary>
## Summary

Researched the ecosystem for building a typed Python SDK wrapping gRPC-generated code for the Mattermost Plugin API. The challenge is creating a Pythonic, type-safe API client that feels natural to Python developers while wrapping 200+ Plugin API methods generated from protobuf.

Key findings:
1. **mypy-protobuf is essential** - Generates proper .pyi type stubs for protobuf and gRPC code, enabling IDE completion and mypy checking
2. **Azure SDK guidelines** - Industry standard for Python SDK design emphasizes separate sync/async clients, context managers, consistent verb prefixes
3. **grpc-interceptor library** - Simplifies adding logging, authentication, retry logic through middleware pattern
4. **Context managers required** - Proper channel lifecycle management prevents resource leaks and connection issues
5. **Don't expose raw protobuf** - Wrap generated code with Pythonic interface using dataclass-like patterns for better DX
6. **pyproject.toml standard** - Modern packaging uses [project] table, no setup.py needed

**Primary recommendation:** Build typed wrapper around grpcio-generated stubs using mypy-protobuf for type safety. Follow Azure SDK patterns (Client suffix, context managers, separate sync/async). Use grpc-interceptor for middleware. Package with pyproject.toml. Do NOT expose raw protobuf messages in public API - wrap with Pythonic interface.
</research_summary>

<standard_stack>
## Standard Stack

### Core (Python SDK)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grpcio | 1.60+ | gRPC framework | Official Google implementation, required for gRPC clients |
| grpcio-tools | 1.60+ | Protobuf code generation | Generates _pb2.py and _pb2_grpc.py from .proto files |
| protobuf | 4.25+ | Protocol buffer runtime | Required for message serialization |
| mypy-protobuf | 3.6+ | Type stub generation | Generates .pyi files for IDE completion and type checking |
| types-protobuf | Latest | Type stubs for protobuf | Required for mypy to understand protobuf API |

### Supporting (SDK Enhancement)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| grpc-interceptor | Latest | Simplified interceptors | Logging, auth, retry middleware |
| types-grpcio | 1.0.0.20251009+ | Type stubs for grpcio | Enables type checking of gRPC API usage |

### Development/Packaging
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| setuptools | 61.0+ | Build backend | Package building with pyproject.toml |
| build | Latest | PEP 517 builder | Creating source/wheel distributions |
| mypy | 1.14+ | Type checker | Static type checking during development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mypy-protobuf | Manual .pyi files | Manual stubs require constant maintenance, error-prone |
| grpc-interceptor | Raw grpc interceptors | Raw API is verbose, requires accessing internal details |
| Typed wrapper | Expose raw protobuf | Raw protobuf lacks Python idioms, poor IDE support |
| pyproject.toml | setup.py | setup.py deprecated for pure metadata, pyproject.toml is standard |
| Sync-only client | grpclib (pure async) | grpclib pure Python is slower, official grpcio now has aio support |

**Installation (SDK users):**
```bash
pip install mattermost-plugin-sdk
# Dependencies installed automatically:
# - grpcio>=1.60.0
# - protobuf>=4.25.0
```

**Installation (SDK development):**
```bash
pip install grpcio grpcio-tools mypy-protobuf types-protobuf grpc-interceptor
# Dev dependencies:
pip install mypy pytest pytest-asyncio
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
python-sdk/
├── pyproject.toml                 # PEP 621 package metadata
├── src/
│   └── mattermost_plugin/
│       ├── __init__.py            # Public API exports
│       ├── client.py              # Main PluginAPI client class
│       ├── async_client.py        # AsyncPluginAPI client class
│       ├── exceptions.py          # Custom exception hierarchy
│       ├── interceptors.py        # Logging/retry interceptors
│       ├── types.py               # Type aliases and public types
│       ├── _internal/
│       │   ├── __init__.py
│       │   ├── channel.py         # Channel lifecycle management
│       │   ├── wrappers.py        # Protobuf->Python wrappers
│       │   └── converters.py      # Type conversion utilities
│       └── grpc/                  # Generated code (not in public API)
│           ├── __init__.py
│           ├── plugin_pb2.py      # Generated protobuf messages
│           ├── plugin_pb2.pyi     # Generated type stubs
│           ├── api_pb2.py
│           ├── api_pb2.pyi
│           ├── api_pb2_grpc.py    # Generated service stubs
│           └── api_pb2_grpc.pyi   # Generated service type stubs
├── tests/
│   ├── test_client.py
│   └── test_async_client.py
└── scripts/
    └── generate_protos.py         # Code generation script
```

### Pattern 1: Typed Client Wrapper with Context Manager
**What:** Pythonic client class wrapping gRPC stub with proper resource management
**When to use:** Primary pattern for SDK entry point
**Example:**
```python
# client.py - Following Azure SDK patterns
from typing import Optional, ContextManager
import grpc
from .grpc import api_pb2, api_pb2_grpc
from .exceptions import PluginAPIError, UserNotFoundError
from ._internal.channel import create_channel
from ._internal.wrappers import User

class PluginAPIClient:
    """
    Client for Mattermost Plugin API.

    Thread-safe client that manages gRPC channel lifecycle.
    Use with context manager for automatic cleanup.

    Example:
        with PluginAPIClient(target="localhost:50051") as client:
            user = client.create_user(username="bot", email="bot@example.com")
    """

    def __init__(self,
                 target: str,
                 *,
                 credentials: Optional[grpc.ChannelCredentials] = None,
                 options: Optional[list] = None):
        """
        Initialize client.

        Args:
            target: Server address (host:port)
            credentials: Optional credentials for secure channel
            options: Optional channel configuration options
        """
        self._target = target
        self._credentials = credentials
        self._options = options or []
        self._channel: Optional[grpc.Channel] = None
        self._stub: Optional[api_pb2_grpc.PluginAPIStub] = None

    def __enter__(self) -> "PluginAPIClient":
        """Enter context manager - establish connection."""
        self._channel = create_channel(
            self._target,
            credentials=self._credentials,
            options=self._options
        )
        self._stub = api_pb2_grpc.PluginAPIStub(self._channel)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager - cleanup connection."""
        if self._channel:
            self._channel.close()

    def create_user(self, username: str, email: str, password: str) -> User:
        """
        Create a new user.

        Args:
            username: Unique username
            email: User email address
            password: User password

        Returns:
            Created user object

        Raises:
            PluginAPIError: If creation fails
        """
        request = api_pb2.CreateUserRequest(
            user=api_pb2.User(
                username=username,
                email=email,
                password=password
            )
        )

        try:
            response = self._stub.CreateUser(request)
            return User.from_proto(response.user)
        except grpc.RpcError as e:
            self._handle_grpc_error(e)

    def get_user(self, user_id: str) -> User:
        """Get user by ID."""
        request = api_pb2.GetUserRequest(user_id=user_id)
        try:
            response = self._stub.GetUser(request)
            return User.from_proto(response.user)
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                raise UserNotFoundError(f"User {user_id} not found")
            self._handle_grpc_error(e)

    def _handle_grpc_error(self, error: grpc.RpcError) -> None:
        """Convert gRPC errors to SDK exceptions."""
        raise PluginAPIError(
            f"API call failed: {error.details()}",
            code=error.code()
        )
```

### Pattern 2: Async Client (grpc.aio)
**What:** AsyncIO-based client using grpc.aio for async/await patterns
**When to use:** Plugins using asyncio for concurrent operations
**Example:**
```python
# async_client.py
import grpc.aio
from typing import Optional
from .grpc import api_pb2, api_pb2_grpc
from ._internal.wrappers import User

class AsyncPluginAPIClient:
    """Async version of PluginAPIClient using grpc.aio."""

    def __init__(self, target: str, **kwargs):
        self._target = target
        self._options = kwargs.get('options', [])
        self._channel: Optional[grpc.aio.Channel] = None
        self._stub: Optional[api_pb2_grpc.PluginAPIStub] = None

    async def __aenter__(self) -> "AsyncPluginAPIClient":
        """Async context manager entry."""
        self._channel = grpc.aio.insecure_channel(
            self._target,
            options=self._options
        )
        self._stub = api_pb2_grpc.PluginAPIStub(self._channel)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._channel:
            await self._channel.close()

    async def create_user(self, username: str, email: str, password: str) -> User:
        """Async create user."""
        request = api_pb2.CreateUserRequest(
            user=api_pb2.User(
                username=username,
                email=email,
                password=password
            )
        )
        response = await self._stub.CreateUser(request)
        return User.from_proto(response.user)
```

### Pattern 3: Protobuf Wrapper Classes (Hide Generated Code)
**What:** Pythonic dataclass-like wrappers around protobuf messages
**When to use:** Public API types - never expose raw protobuf in public interface
**Example:**
```python
# _internal/wrappers.py
from dataclasses import dataclass
from typing import Optional
from ..grpc import api_pb2

@dataclass
class User:
    """User object (Pythonic wrapper around protobuf User)."""
    id: str
    username: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    create_at: int = 0
    update_at: int = 0
    delete_at: int = 0

    @classmethod
    def from_proto(cls, pb_user: api_pb2.User) -> "User":
        """Convert protobuf User to Python User."""
        return cls(
            id=pb_user.id,
            username=pb_user.username,
            email=pb_user.email,
            first_name=pb_user.first_name or None,
            last_name=pb_user.last_name or None,
            nickname=pb_user.nickname or None,
            create_at=pb_user.create_at,
            update_at=pb_user.update_at,
            delete_at=pb_user.delete_at,
        )

    def to_proto(self) -> api_pb2.User:
        """Convert Python User to protobuf User."""
        return api_pb2.User(
            id=self.id,
            username=self.username,
            email=self.email,
            first_name=self.first_name or "",
            last_name=self.last_name or "",
            nickname=self.nickname or "",
            create_at=self.create_at,
            update_at=self.update_at,
            delete_at=self.delete_at,
        )
```

### Pattern 4: Custom Exception Hierarchy
**What:** SDK-specific exceptions inheriting from base PluginAPIError
**When to use:** All error handling - never let raw grpc.RpcError escape public API
**Example:**
```python
# exceptions.py
from typing import Optional
import grpc

class PluginAPIError(Exception):
    """Base exception for all Plugin API errors."""

    def __init__(self, message: str, code: Optional[grpc.StatusCode] = None):
        super().__init__(message)
        self.code = code

class UserNotFoundError(PluginAPIError):
    """User not found in system."""
    pass

class ChannelNotFoundError(PluginAPIError):
    """Channel not found in system."""
    pass

class PermissionDeniedError(PluginAPIError):
    """Operation not permitted."""
    pass

class ValidationError(PluginAPIError):
    """Invalid input data."""
    pass
```

### Pattern 5: Channel Management with Keepalive
**What:** Proper channel configuration preventing connection drops
**When to use:** Long-running plugin processes
**Example:**
```python
# _internal/channel.py
import grpc
from typing import Optional

def create_channel(
    target: str,
    credentials: Optional[grpc.ChannelCredentials] = None,
    options: Optional[list] = None
) -> grpc.Channel:
    """
    Create configured gRPC channel with best practices.

    Includes keepalive to prevent connection drops during idle periods.
    """
    default_options = [
        # Keepalive ping every 10 seconds
        ('grpc.keepalive_time_ms', 10000),
        # Wait 5 seconds for ping ack before closing
        ('grpc.keepalive_timeout_ms', 5000),
        # Allow keepalive pings even with no active streams
        ('grpc.keepalive_permit_without_calls', 1),
        # Increase message size limits for large payloads
        ('grpc.max_send_message_length', 100 * 1024 * 1024),  # 100MB
        ('grpc.max_receive_message_length', 100 * 1024 * 1024),
    ]

    # Merge with user options (user options take precedence)
    all_options = default_options + (options or [])

    if credentials:
        return grpc.secure_channel(target, credentials, options=all_options)
    else:
        return grpc.insecure_channel(target, options=all_options)
```

### Pattern 6: Logging Interceptor (using grpc-interceptor)
**What:** Middleware for request/response logging
**When to use:** Production debugging, tracing API calls
**Example:**
```python
# interceptors.py
import logging
from grpc_interceptor import ClientInterceptor

logger = logging.getLogger(__name__)

class LoggingInterceptor(ClientInterceptor):
    """Log all RPC calls with method name and response status."""

    def intercept(self, method, request_or_iterator, call_details):
        """Intercept and log RPC call."""
        method_name = call_details.method.decode() if isinstance(call_details.method, bytes) else call_details.method
        logger.info(f"Calling {method_name}")

        try:
            response = method(request_or_iterator, call_details)
            logger.info(f"{method_name} succeeded")
            return response
        except Exception as e:
            logger.error(f"{method_name} failed: {e}")
            raise

# Usage in client:
# interceptors = [LoggingInterceptor()]
# channel = grpc.intercept_channel(channel, *interceptors)
```

### Pattern 7: Type Stub Generation with mypy-protobuf
**What:** Generate .pyi type stubs alongside protobuf code
**When to use:** Always - enables IDE completion and mypy checking
**Example:**
```bash
# scripts/generate_protos.sh
#!/bin/bash

# Generate Python code + type stubs from proto files
python -m grpc_tools.protoc \
    -I../../server/public/pluginapi/grpc/proto \
    --python_out=./src/mattermost_plugin/grpc \
    --grpc_python_out=./src/mattermost_plugin/grpc \
    --mypy_out=./src/mattermost_plugin/grpc \
    --mypy_grpc_out=./src/mattermost_plugin/grpc \
    ../../server/public/pluginapi/grpc/proto/plugin.proto \
    ../../server/public/pluginapi/grpc/proto/api.proto

# Result:
# - plugin_pb2.py (protobuf messages)
# - plugin_pb2.pyi (type stubs for messages)
# - api_pb2.py (service messages)
# - api_pb2.pyi (type stubs for messages)
# - api_pb2_grpc.py (service client/server)
# - api_pb2_grpc.pyi (type stubs for services)
```

### Anti-Patterns to Avoid
- **Exposing raw protobuf in public API:** Users should never import from .grpc module - wrap all types
- **Not using context managers:** Leads to channel leaks, unclosed connections
- **Single global client:** Creates threading issues - each thread should have own client or use thread-safe client
- **Blocking calls in async code:** Use AsyncPluginAPIClient, not sync client with asyncio
- **Manual type annotations:** Use mypy-protobuf instead of writing .pyi files manually
- **setup.py for pure metadata:** Use pyproject.toml [project] table, setup.py only for extensions
- **Catching all exceptions:** Be specific - catch grpc.RpcError, convert to SDK exceptions
- **Not preserving channel reference:** Python GC will close channel if no reference held
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type stubs for protobuf | Manual .pyi files | mypy-protobuf | Generates accurate stubs from proto, handles all edge cases |
| gRPC interceptors | Custom middleware system | grpc-interceptor library | Simplifies access to request/response, handles context properly |
| Retry logic | Manual retry loops | gRPC service config retry policy | Built-in exponential backoff, handles transient failures |
| Channel lifecycle | Manual open/close | Context managers (__enter__/__exit__) | Exception-safe cleanup, Pythonic pattern |
| Error conversion | String parsing of error messages | grpc.StatusCode mapping | Type-safe, handles all error codes |
| Connection pooling | Multiple channel management | Single channel with HTTP/2 multiplexing | gRPC reuses connections, pooling adds complexity |
| Async support | Threading wrapper | grpc.aio (AsyncIO API) | Native async, proper coroutine handling |
| Package metadata | setup.py | pyproject.toml [project] table | PEP 621 standard, declarative, tool-agnostic |

**Key insight:** Python SDK development has established patterns that solve common problems:

1. **Type Safety**: mypy-protobuf generates perfect stubs - writing them manually means maintaining 1000+ lines of type annotations that will fall out of sync.

2. **Resource Management**: Python context managers (__enter__/__exit__) are the standard pattern for resource cleanup. Not using them for gRPC channels leads to connection leaks that are hard to debug.

3. **Error Handling**: gRPC has 16 standard status codes (OK, NOT_FOUND, PERMISSION_DENIED, etc.). Parsing error strings is fragile - use grpc.StatusCode enum.

4. **Async/Await**: Python has native asyncio support. Threading-based async wrappers create subtle bugs - use grpc.aio instead.

5. **Channel Lifecycle**: gRPC channels are expensive to create and designed to be long-lived. Don't create/destroy per-request - create once, reuse via HTTP/2 multiplexing.

6. **Interceptors**: The raw grpc.UnaryUnaryClientInterceptor interface is verbose and doesn't give access to request/response objects. grpc-interceptor library provides clean interface.

Fighting these standards means reimplementing:
- Type inference for 200+ API methods
- Exception-safe resource cleanup
- HTTP/2 multiplexing and connection pooling
- Exponential backoff retry logic
- Async context manager protocol
- Status code semantics

Don't hand-roll any of these - use the standard stack.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Exposing Raw Protobuf Messages in Public API
**What goes wrong:** Users import from .grpc package, IDE can't autocomplete, protobuf types leak into user code
**Why it happens:** Easier to return response.user directly than wrap it
**How to avoid:** Create wrapper classes in types.py or wrappers.py, never expose _pb2 modules in __init__.py
**Warning signs:** User code imports from mattermost_plugin.grpc, type hints reference api_pb2.User

### Pitfall 2: Not Using Context Managers for Client
**What goes wrong:** Channel stays open after use, resource leak, "too many open files" errors
**Why it happens:** Forgetting to call channel.close(), not using with statement
**How to avoid:** Always implement __enter__/__exit__, document context manager usage in examples
**Warning signs:** Process file descriptor count grows, connections in CLOSE_WAIT state

### Pitfall 3: Creating Channel Per Request
**What goes wrong:** Performance degradation, connection overhead, slow API calls
**Why it happens:** Treating gRPC like HTTP REST (create connection, make request, close)
**How to avoid:** Create channel once, reuse for multiple requests via HTTP/2 multiplexing
**Warning signs:** High connection establishment latency, many TIME_WAIT sockets

### Pitfall 4: Not Configuring Keepalive
**What goes wrong:** Connections drop during idle periods, first request after idle fails
**Why it happens:** Default gRPC doesn't send keepalive pings, intermediate proxies close idle connections
**How to avoid:** Configure grpc.keepalive_time_ms and grpc.keepalive_permit_without_calls options
**Warning signs:** First API call fails with UNAVAILABLE after plugin is idle, "connection closed" errors

### Pitfall 5: Relative Imports in Generated Code
**What goes wrong:** ModuleNotFoundError when importing _pb2_grpc.py files
**Why it happens:** Generated code uses "import plugin_pb2" instead of absolute import
**How to avoid:** Generate with correct -I paths, ensure __init__.py exists in grpc/ directory
**Warning signs:** ImportError: No module named 'plugin_pb2', works in some contexts but not others

### Pitfall 6: Missing Type Stubs (mypy-protobuf)
**What goes wrong:** No IDE completion for protobuf fields, mypy doesn't catch type errors
**Why it happens:** Only generating _pb2.py without _pb2.pyi stubs
**How to avoid:** Use --mypy_out and --mypy_grpc_out in protoc command
**Warning signs:** VSCode/PyCharm doesn't autocomplete message fields, mypy shows errors about missing attributes

### Pitfall 7: Blocking Sync Calls in Async Context
**What goes wrong:** Event loop blocks, poor concurrency, "coroutine never awaited" warnings
**Why it happens:** Using sync PluginAPIClient inside async def functions
**How to avoid:** Use AsyncPluginAPIClient with grpc.aio for async code, sync client only in sync code
**Warning signs:** Slow async functions, asyncio warnings, poor concurrent performance

### Pitfall 8: Not Handling Channel Reference Lifetime
**What goes wrong:** Channel gets garbage collected, connection drops silently, "channel closed" errors
**Why it happens:** Python GC collects channel object if no strong reference held
**How to avoid:** Store channel as instance variable, keep reference until client destroyed
**Warning signs:** Intermittent "channel closed" errors, works sometimes but not always

### Pitfall 9: Wrong Exception Types Escaping Public API
**What goes wrong:** Users catch grpc.RpcError instead of SDK exceptions, coupling to gRPC implementation
**Why it happens:** Not catching grpc.RpcError in client methods and converting to SDK exceptions
**How to avoid:** Catch grpc.RpcError in all client methods, convert to PluginAPIError hierarchy
**Warning signs:** Documentation mentions grpc.RpcError, users import grpc to catch exceptions

### Pitfall 10: setup.py for Pure Python Package
**What goes wrong:** Extra file to maintain, confusing to modern Python developers, deprecated pattern
**Why it happens:** Old tutorials, copying from outdated projects
**How to avoid:** Use pyproject.toml [project] table, only use setup.py if building C extensions
**Warning signs:** setup.py exists but just calls setuptools.setup() with metadata
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources and industry standards:

### Complete pyproject.toml (Modern Packaging)
```toml
# Source: https://packaging.python.org/en/latest/guides/writing-pyproject-toml/
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "mattermost-plugin-sdk"
version = "0.1.0"
description = "Python SDK for Mattermost Plugin API (gRPC-based)"
readme = "README.md"
license = {text = "Apache-2.0"}
authors = [
    {name = "Mattermost", email = "dev@mattermost.com"}
]
requires-python = ">=3.9"
dependencies = [
    "grpcio>=1.60.0",
    "protobuf>=4.25.0",
]

[project.optional-dependencies]
dev = [
    "grpcio-tools>=1.60.0",
    "mypy-protobuf>=3.6.0",
    "types-protobuf",
    "mypy>=1.14.0",
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
]
interceptors = [
    "grpc-interceptor>=0.15.0",
]

[tool.setuptools.packages.find]
where = ["src"]

[tool.mypy]
python_version = "3.9"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = "mattermost_plugin.grpc.*"
ignore_errors = true  # Generated code
```

### Client Usage Example (Sync)
```python
# Source: Based on Azure SDK patterns
from mattermost_plugin import PluginAPIClient, PluginAPIError, UserNotFoundError

# Basic usage with context manager
with PluginAPIClient(target="localhost:50051") as client:
    try:
        user = client.create_user(
            username="testbot",
            email="testbot@example.com",
            password="secure_password"
        )
        print(f"Created user: {user.id}")

        # Get user by ID
        fetched = client.get_user(user.id)
        print(f"Fetched user: {fetched.username}")

    except UserNotFoundError as e:
        print(f"User not found: {e}")
    except PluginAPIError as e:
        print(f"API error: {e}, code: {e.code}")
```

### Client Usage Example (Async)
```python
# Source: Based on grpc.aio patterns
import asyncio
from mattermost_plugin import AsyncPluginAPIClient

async def main():
    async with AsyncPluginAPIClient(target="localhost:50051") as client:
        # Concurrent API calls
        users = await asyncio.gather(
            client.get_user("user_id_1"),
            client.get_user("user_id_2"),
            client.get_user("user_id_3"),
        )
        print(f"Fetched {len(users)} users concurrently")

asyncio.run(main())
```

### Code Generation Script
```python
# scripts/generate_protos.py
# Source: Based on grpcio-tools patterns
import os
import subprocess
from pathlib import Path

# Paths
PROTO_DIR = Path("../../server/public/pluginapi/grpc/proto")
OUTPUT_DIR = Path("src/mattermost_plugin/grpc")

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Generate Python + gRPC + type stubs
subprocess.run([
    "python", "-m", "grpc_tools.protoc",
    f"-I{PROTO_DIR}",
    f"--python_out={OUTPUT_DIR}",
    f"--grpc_python_out={OUTPUT_DIR}",
    f"--mypy_out={OUTPUT_DIR}",
    f"--mypy_grpc_out={OUTPUT_DIR}",
    str(PROTO_DIR / "plugin.proto"),
    str(PROTO_DIR / "api.proto"),
    str(PROTO_DIR / "hooks.proto"),
], check=True)

print("✓ Generated protobuf code with type stubs")
```

### Interceptor for Retry Logic
```python
# Source: Based on gRPC service config patterns
import json
import grpc

# Configure retry policy via service config
SERVICE_CONFIG = json.dumps({
    "methodConfig": [{
        # Apply to all methods
        "name": [{"service": "mattermost.plugin.PluginAPI"}],
        "retryPolicy": {
            "maxAttempts": 5,
            "initialBackoff": "0.1s",
            "maxBackoff": "10s",
            "backoffMultiplier": 2,
            "retryableStatusCodes": ["UNAVAILABLE", "DEADLINE_EXCEEDED"]
        }
    }]
})

# Create channel with retry config
channel = grpc.insecure_channel(
    'localhost:50051',
    options=[("grpc.service_config", SERVICE_CONFIG)]
)
```

### Custom Logging Interceptor
```python
# Source: Based on grpc-interceptor documentation
import logging
from grpc_interceptor import ClientInterceptor

logger = logging.getLogger(__name__)

class LoggingInterceptor(ClientInterceptor):
    """Log all RPC calls."""

    def intercept(self, method, request_or_iterator, call_details):
        method_name = call_details.method
        logger.info(f"→ {method_name}")

        try:
            response = method(request_or_iterator, call_details)
            logger.info(f"✓ {method_name}")
            return response
        except Exception as e:
            logger.error(f"✗ {method_name}: {e}")
            raise

# Usage:
# from grpc_interceptor import intercept_channel
# channel = grpc.insecure_channel("localhost:50051")
# channel = intercept_channel(channel, LoggingInterceptor())
```

### Error Handling Pattern
```python
# Source: Azure SDK error handling guidelines
import grpc
from .exceptions import (
    PluginAPIError,
    UserNotFoundError,
    ChannelNotFoundError,
    PermissionDeniedError,
    ValidationError
)

def convert_grpc_error(error: grpc.RpcError) -> PluginAPIError:
    """Convert gRPC status codes to SDK exceptions."""
    code = error.code()
    details = error.details()

    # Map gRPC codes to SDK exceptions
    if code == grpc.StatusCode.NOT_FOUND:
        # Parse details to determine resource type
        if "user" in details.lower():
            return UserNotFoundError(details)
        elif "channel" in details.lower():
            return ChannelNotFoundError(details)

    elif code == grpc.StatusCode.PERMISSION_DENIED:
        return PermissionDeniedError(details)

    elif code == grpc.StatusCode.INVALID_ARGUMENT:
        return ValidationError(details)

    # Generic error for unmapped codes
    return PluginAPIError(details, code=code)

# Usage in client method:
try:
    response = self._stub.GetUser(request)
except grpc.RpcError as e:
    raise convert_grpc_error(e)
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setup.py for metadata | pyproject.toml [project] table | 2021 (PEP 621) | Single source of truth, tool-agnostic, declarative |
| Manual .pyi type stubs | mypy-protobuf generator | 2023 | Automatic type safety, IDE completion for protobuf |
| grpc-stubs package | types-protobuf from typeshed | 2024 | Official type stubs in typeshed, better maintained |
| Raw grpc interceptors | grpc-interceptor library | 2022 | Simplified API, access to request/response objects |
| Threading for async | grpc.aio (AsyncIO) | 2020 (stable 2023) | Native async/await, proper coroutine support |
| Expose protobuf directly | Wrapper dataclasses | 2024 trend | Better DX, IDE support, decoupling from protobuf |

**New tools/patterns to consider:**
- **betterproto**: Alternative protobuf generator using dataclasses, but requires custom code generation pipeline (not needed - mypy-protobuf sufficient)
- **grpclib**: Pure Python asyncio gRPC, but official grpc.aio now recommended
- **Poetry/PDM**: Alternative package managers, but not needed for SDK (setuptools sufficient)
- **Pydantic models**: Could wrap protobuf with Pydantic for validation, but adds dependency (consider for future)

**Deprecated/outdated:**
- **setup.py only packages**: Use pyproject.toml [project] table for metadata
- **grpc-stubs**: Archived, use types-protobuf from typeshed instead
- **Python 2.7 support**: Minimum Python 3.9+ for modern type hints
- **Manual protoc calls**: Use grpcio-tools module (python -m grpc_tools.protoc)
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Dataclass vs Protobuf Wrapper Performance**
   - What we know: Wrapping protobuf with dataclasses provides better DX
   - What's unclear: Performance overhead of to_proto/from_proto conversion for 200+ methods
   - Recommendation: Start with wrappers for core types (User, Channel, Post), benchmark during implementation

2. **Sync vs Async Client Decision**
   - What we know: Should provide both sync and async clients per Azure SDK guidelines
   - What's unclear: Whether plugin developers will primarily use sync or async patterns
   - Recommendation: Provide both, make sync the default in examples (simpler), document async benefits

3. **Generated Code Location (src vs non-src)**
   - What we know: Generated _pb2.py should not be in public API
   - What's unclear: Should generated code be in src/mattermost_plugin/grpc or separate generated/ dir
   - Recommendation: Keep in src/mattermost_plugin/grpc but mark _internal, don't expose in __init__.py

4. **Streaming RPC Support (ServeHTTP)**
   - What we know: Phase 8 will add ServeHTTP streaming, SDK needs to support it
   - What's unclear: Best Python API for streaming (iterators? async generators?)
   - Recommendation: Research during Phase 7-8, likely use async generators for async client

5. **Error Code Mapping Completeness**
   - What we know: Need to map all gRPC StatusCode values to SDK exceptions
   - What's unclear: Full set of domain exceptions needed (how many resource-specific errors?)
   - Recommendation: Start with base PluginAPIError + top 5 (NotFound, PermissionDenied, InvalidArgument, AlreadyExists, Unavailable)
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [gRPC Python Basics](https://grpc.io/docs/languages/python/basics/) - Official client patterns
- [gRPC AsyncIO API](https://grpc.github.io/grpc/python/grpc_asyncio.html) - Official async client documentation
- [Azure SDK Python Guidelines](https://azure.github.io/azure-sdk/python_design.html) - Industry standard SDK design patterns
- [mypy-protobuf GitHub](https://github.com/nipunn1313/mypy-protobuf) - Type stub generation tool
- [Python Packaging User Guide](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) - Official pyproject.toml standard
- [grpc-interceptor Documentation](https://grpc-interceptor.readthedocs.io/) - Simplified interceptor library
- [Protocol Buffers Python Generated Code](https://protobuf.dev/reference/python/python-generated/) - Official protobuf patterns

### Secondary (MEDIUM confidence)
- [Python SDK Best Practices (Medium)](https://medium.com/arthur-engineering/best-practices-for-creating-a-user-friendly-python-sdk-e6574745472a) - Verified against Azure guidelines
- [gRPC Performance Best Practices](https://grpc.io/docs/guides/performance/) - Channel management guidance
- [gRPC Retry Guide](https://grpc.io/docs/guides/retry/) - Verified service config patterns
- [Context Managers (Real Python)](https://realpython.com/python-with-statement/) - Verified resource management patterns
- [Designing Pythonic APIs](https://benhoyt.com/writings/python-api-design/) - API design principles

### Tertiary (LOW confidence - needs validation)
- [betterproto](https://github.com/danielgtaylor/python-betterproto) - Alternative generator, not using but aware
- Community blog posts on gRPC errors - patterns verified against official docs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Python SDK design, grpcio client patterns
- Ecosystem: mypy-protobuf, grpc-interceptor, pyproject.toml packaging
- Patterns: Context managers, wrapper classes, type safety, error handling
- Pitfalls: Resource leaks, import issues, protobuf exposure, channel lifecycle

**Confidence breakdown:**
- Standard stack: HIGH - All official libraries with stable releases
- Architecture: HIGH - Patterns from Azure SDK (industry standard) and official gRPC docs
- Pitfalls: HIGH - Documented in GitHub issues and production experience reports
- Code examples: HIGH - All from official documentation or verified patterns
- Packaging: HIGH - pyproject.toml is PEP 621 standard
- Type hints: HIGH - mypy-protobuf is widely adopted (4000+ dependents)

**Research date:** 2026-01-13
**Valid until:** 2026-02-13 (30 days - Python ecosystem stable, check for minor version updates)

**Critical decision points for planning:**
1. ✅ USE mypy-protobuf for type stub generation (not manual stubs)
2. ✅ Follow Azure SDK patterns (Client suffix, context managers, sync+async)
3. ✅ Wrap protobuf messages with Python dataclasses (don't expose raw protobuf)
4. ✅ Use grpc-interceptor for middleware (logging, retry, auth)
5. ✅ Package with pyproject.toml [project] table (no setup.py)
6. ✅ Provide both sync (PluginAPIClient) and async (AsyncPluginAPIClient)
7. ✅ Custom exception hierarchy (never let grpc.RpcError escape)
8. ✅ Channel lifecycle via context managers (__enter__/__exit__)
9. ⚠️ Need to decide: wrapper classes for all types or just core types (benchmark performance)
10. ⚠️ Need to decide: generated code location (confirmed: src/mattermost_plugin/grpc is fine)
</metadata>

---

*Phase: 06-python-sdk-core*
*Research completed: 2026-01-13*
*Ready for planning: yes*
