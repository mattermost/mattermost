# Python Plugin Development Guide

This guide covers developing Mattermost plugins using Python. Python plugins provide a familiar development experience for Python developers while maintaining full access to the Mattermost Plugin API.

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Plugin Manifest](#plugin-manifest)
- [SDK Reference](#sdk-reference)
- [Hook Reference](#hook-reference)
- [API Reference](#api-reference)
- [ServeHTTP](#servehttp)
- [Best Practices](#best-practices)
- [Server Integration](#server-integration)
- [Troubleshooting](#troubleshooting)

## Introduction

### What Python Plugins Enable

Python plugins allow you to:

- Extend Mattermost functionality using Python
- Leverage the vast Python ecosystem (data science, AI/ML, integrations)
- Write plugins with familiar Python idioms and patterns
- Use async/await for non-blocking operations

### When to Use Python vs Go Plugins

**Choose Python when:**
- Your team has strong Python expertise
- You need libraries primarily available in Python (pandas, numpy, transformers)
- Rapid prototyping is a priority
- The plugin is primarily I/O-bound

**Choose Go when:**
- Maximum performance is critical
- The plugin is CPU-bound with heavy computation
- You need minimal resource overhead
- You're comfortable with Go's type system

### Performance Considerations

Python plugins communicate with the Mattermost server via gRPC, which introduces some overhead compared to native Go plugins:

- **API calls**: ~35-40 microseconds per call (vs direct function calls in Go)
- **Hook invocations**: Similar overhead per hook callback
- **Memory**: Python runtime adds memory overhead

For most use cases, this overhead is negligible. The gRPC protocol provides efficient binary serialization and multiplexed connections.

## Getting Started

### Prerequisites

- Python 3.9 or higher
- Mattermost Server with Python plugin support
- The `mattermost-plugin-sdk` Python package

### Creating a Plugin Project

1. Create a new directory for your plugin:

```bash
mkdir my-python-plugin
cd my-python-plugin
```

2. Create the plugin structure:

```
my-python-plugin/
  plugin.json          # Plugin manifest
  server/
    plugin.py          # Main plugin code
    requirements.txt   # Python dependencies
```

3. Create `plugin.json`:

```json
{
  "id": "com.example.myplugin",
  "name": "My Python Plugin",
  "version": "0.1.0",
  "min_server_version": "9.5.0",
  "server": {
    "executable": "server/plugin.py",
    "runtime": "python",
    "python_version": "3.9"
  }
}
```

4. Create `server/plugin.py`:

```python
from mattermost_plugin import Plugin, hook, HookName


class MyPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        self.logger.info("My plugin activated!")
        version = self.api.get_server_version()
        self.logger.info(f"Server version: {version}")

    @hook(HookName.OnDeactivate)
    def on_deactivate(self) -> None:
        self.logger.info("My plugin deactivated!")


if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin
    run_plugin(MyPlugin)
```

5. Create `server/requirements.txt`:

```
mattermost-plugin-sdk>=0.1.0
```

## Plugin Manifest

The plugin manifest (`plugin.json` or `plugin.yaml`) tells Mattermost how to run your plugin.

### Python-Specific Fields

```yaml
id: com.example.myplugin
name: My Python Plugin
version: 0.1.0
min_server_version: "9.5.0"

server:
  executable: server/plugin.py
  runtime: python                    # Required for Python plugins
  python_version: "3.9"              # Minimum Python version (informational)
  python:                            # Optional Python configuration
    dependency_mode: venv            # How to manage dependencies
    venv_path: server/venv           # Path to virtual environment
    requirements_path: server/requirements.txt
```

### Field Reference

| Field | Description |
|-------|-------------|
| `server.runtime` | Set to `"python"` for Python plugins |
| `server.python_version` | Minimum Python version required (e.g., `"3.9"`, `">=3.11"`) |
| `server.executable` | Path to the Python entry point script |
| `server.python.dependency_mode` | `"system"`, `"venv"`, or `"bundled"` |
| `server.python.venv_path` | Path to virtual environment (when using venv mode) |
| `server.python.requirements_path` | Path to requirements.txt |

## SDK Reference

### Plugin Base Class

All Python plugins should inherit from the `Plugin` base class:

```python
from mattermost_plugin import Plugin


class MyPlugin(Plugin):
    pass
```

The `Plugin` class provides:

- `self.api` - The Plugin API client for calling Mattermost APIs
- `self.logger` - A logger instance for plugin logging

### Hook Decorator

The `@hook` decorator registers methods as hook handlers:

```python
from mattermost_plugin import Plugin, hook, HookName


class MyPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        pass

    # Also valid: using string names
    @hook("OnDeactivate")
    def handle_deactivate(self) -> None:
        pass
```

### API Client Access

Access the API client via `self.api`:

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    # Get server info
    version = self.api.get_server_version()

    # Get user
    user = self.api.get_user("user-id")
    self.logger.info(f"User: {user.username}")

    # Create a post
    post = self.api.create_post(
        channel_id="channel-id",
        user_id="bot-user-id",
        message="Hello from Python!"
    )
```

### Logger Access

Use `self.logger` for plugin logging:

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    self.logger.debug("Debug message")
    self.logger.info("Info message")
    self.logger.warning("Warning message")
    self.logger.error("Error message")
```

## Hook Reference

### Lifecycle Hooks

| Hook | Description | Signature |
|------|-------------|-----------|
| `OnActivate` | Called when plugin is activated | `() -> None` |
| `OnDeactivate` | Called when plugin is deactivated | `() -> None` |
| `OnConfigurationChange` | Called when configuration changes | `() -> None` |
| `OnInstall` | Called when plugin is installed | `(context, event) -> None` |

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    self.logger.info("Plugin activated!")

@hook(HookName.OnDeactivate)
def on_deactivate(self) -> None:
    self.logger.info("Plugin deactivated!")

@hook(HookName.OnConfigurationChange)
def on_config_change(self) -> None:
    self.logger.info("Configuration changed!")
```

### Message Hooks

| Hook | Description | Return Value |
|------|-------------|--------------|
| `MessageWillBePosted` | Before message is posted | `(post, rejection_reason)` |
| `MessageWillBeUpdated` | Before message is updated | `(post, rejection_reason)` |
| `MessageHasBeenPosted` | After message is posted | None |
| `MessageHasBeenUpdated` | After message is updated | None |
| `MessageHasBeenDeleted` | After message is deleted | None |

**Allow/Reject/Modify Pattern:**

```python
@hook(HookName.MessageWillBePosted)
def filter_message(self, context, post):
    # Allow: return the post (optionally modified) with empty rejection
    if self.is_valid(post):
        return post, ""

    # Reject: return None with rejection reason
    if self.contains_spam(post):
        return None, "Message rejected: spam detected"

    # Modify: modify the post and return it
    post.message = self.sanitize(post.message)
    return post, ""
```

### User Hooks

| Hook | Description |
|------|-------------|
| `UserHasBeenCreated` | After user is created |
| `UserWillLogIn` | Before user logs in (can reject) |
| `UserHasLoggedIn` | After user logs in |
| `UserHasBeenDeactivated` | After user is deactivated |

```python
@hook(HookName.UserWillLogIn)
def on_user_login(self, context, user):
    if self.is_blocked(user.id):
        return "Login blocked by plugin"
    return ""  # Allow login
```

### Channel and Team Hooks

| Hook | Description |
|------|-------------|
| `ChannelHasBeenCreated` | After channel is created |
| `UserHasJoinedChannel` | After user joins channel |
| `UserHasLeftChannel` | After user leaves channel |
| `UserHasJoinedTeam` | After user joins team |
| `UserHasLeftTeam` | After user leaves team |

```python
@hook(HookName.UserHasJoinedChannel)
def on_user_joined(self, context, channel_member, actor_id):
    self.logger.info(
        f"User {channel_member.user_id} joined channel {channel_member.channel_id}"
    )
```

### Command Hook

```python
@hook(HookName.ExecuteCommand)
def execute_command(self, context, args):
    if args.command == "/hello":
        return {
            "response_type": "ephemeral",
            "text": "Hello from Python!"
        }
    return {"response_type": "ephemeral", "text": "Unknown command"}
```

## API Reference

### Overview

The API client provides methods organized by entity type:

- **Users**: `get_user()`, `get_users()`, `create_user()`, `update_user()`
- **Teams**: `get_team()`, `get_teams()`, `create_team()`
- **Channels**: `get_channel()`, `create_channel()`, `get_channel_members()`
- **Posts**: `get_post()`, `create_post()`, `update_post()`, `delete_post()`
- **Files**: `upload_file()`, `get_file()`, `get_file_info()`
- **KV Store**: `kv_get()`, `kv_set()`, `kv_delete()`, `kv_list()`
- **Config**: `get_config()`, `get_plugin_config()`

### Error Handling

All API methods may raise exceptions:

```python
from mattermost_plugin import (
    PluginAPIError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


@hook(HookName.OnActivate)
def on_activate(self) -> None:
    try:
        user = self.api.get_user("invalid-id")
    except NotFoundError:
        self.logger.warning("User not found")
    except PermissionDeniedError:
        self.logger.error("Permission denied")
    except PluginAPIError as e:
        self.logger.error(f"API error: {e.error_id} - {e.message}")
```

### Exception Hierarchy

```
PluginAPIError (base)
  - NotFoundError (404)
  - PermissionDeniedError (403)
  - ValidationError (400)
  - AlreadyExistsError (409)
  - UnavailableError (503)
```

### Async Client

For async operations, use `AsyncPluginAPIClient`:

```python
from mattermost_plugin import AsyncPluginAPIClient


async def async_operation():
    async with AsyncPluginAPIClient(target="localhost:50051") as client:
        user = await client.get_user("user-id")
        print(f"User: {user.username}")
```

## ServeHTTP

Python plugins can handle HTTP requests via the `ServeHTTP` hook:

```python
@hook(HookName.ServeHTTP)
def serve_http(self, context, request):
    if request.path == "/api/hello":
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": '{"message": "Hello from Python!"}'
        }

    if request.path == "/api/data":
        data = self.process_request(request.body)
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(data)
        }

    return {"status_code": 404, "body": "Not found"}
```

### Request Object

| Field | Description |
|-------|-------------|
| `request.method` | HTTP method (GET, POST, etc.) |
| `request.path` | Request path |
| `request.query` | Query string |
| `request.headers` | Request headers (dict) |
| `request.body` | Request body (bytes) |

### Response Format

Return a dict with:

| Field | Description |
|-------|-------------|
| `status_code` | HTTP status code (int) |
| `headers` | Response headers (dict, optional) |
| `body` | Response body (str or bytes) |

## Best Practices

### Error Handling

Always handle potential errors from API calls:

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    try:
        self.initialize()
    except Exception as e:
        self.logger.error(f"Failed to initialize: {e}")
        raise  # Re-raise to indicate activation failure
```

### Logging Guidelines

- Use appropriate log levels (`debug`, `info`, `warning`, `error`)
- Include context in log messages
- Avoid logging sensitive data (passwords, tokens)

```python
self.logger.debug(f"Processing message in channel {channel_id}")
self.logger.info(f"User {user_id} action completed")
self.logger.warning(f"Rate limit approaching for user {user_id}")
self.logger.error(f"Failed to process webhook: {error}")
```

### Testing Your Plugin

Create tests using pytest:

```python
# tests/test_plugin.py
import pytest
from unittest.mock import MagicMock
from server.plugin import MyPlugin


def test_message_filter():
    plugin = MyPlugin()
    plugin.api = MagicMock()
    plugin.logger = MagicMock()

    # Test that spam is rejected
    post = MagicMock(message="This is spam")
    result, reason = plugin.filter_message(None, post)
    assert result is None
    assert "spam" in reason.lower()

    # Test that normal messages pass
    post = MagicMock(message="Hello, world!")
    result, reason = plugin.filter_message(None, post)
    assert result is not None
    assert reason == ""
```

### Resource Management

Clean up resources in `OnDeactivate`:

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    self.db_connection = self.connect_to_database()
    self.background_task = self.start_background_task()

@hook(HookName.OnDeactivate)
def on_deactivate(self) -> None:
    if hasattr(self, 'background_task'):
        self.background_task.cancel()
    if hasattr(self, 'db_connection'):
        self.db_connection.close()
```

### Configuration

Access plugin configuration:

```python
@hook(HookName.OnActivate)
def on_activate(self) -> None:
    config = self.api.get_plugin_config()
    self.api_key = config.get("api_key", "")
    self.enabled_features = config.get("features", [])

@hook(HookName.OnConfigurationChange)
def on_config_change(self) -> None:
    # Reload configuration
    config = self.api.get_plugin_config()
    self.api_key = config.get("api_key", "")
```

## Example Plugin

For a complete example, see the [Hello Python Plugin](../examples/hello_python/plugin.py) which demonstrates:

- Plugin lifecycle hooks (OnActivate, OnDeactivate)
- Message filtering (MessageWillBePosted)
- Slash command handling (ExecuteCommand)
- API client usage
- Logging

```python
from mattermost_plugin import Plugin, hook, HookName


class HelloPythonPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        self.logger.info("Hello Python plugin activated!")
        version = self.api.get_server_version()
        self.logger.info(f"Server version: {version}")

    @hook(HookName.MessageWillBePosted)
    def filter_message(self, context, post):
        blocked_words = ["badword"]
        for word in blocked_words:
            if word in post.message.lower():
                return None, "Message blocked"
        return post, ""


if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin
    run_plugin(HelloPythonPlugin)
```

## Server Integration

Python plugins are fully integrated with the Mattermost server and operate identically to Go plugins from the server's perspective.

### How It Works

1. **Plugin Detection**: When a plugin is loaded, the server detects Python plugins by the `.py` extension in the executable path or the `runtime: python` field in the manifest.

2. **gRPC Protocol**: Python plugins communicate with the server via gRPC (instead of net/rpc used by Go plugins). The server automatically selects the appropriate protocol based on plugin type.

3. **Hook Dispatch**: All hooks (OnActivate, MessageHasBeenPosted, ServeHTTP, etc.) are dispatched to Python plugins through the same infrastructure as Go plugins. The server queries which hooks are implemented via the `Implemented()` gRPC call.

4. **HTTP Routing**: HTTP requests to `/plugins/{plugin_id}/*` are routed to Python plugins via the ServeHTTP hook using bidirectional gRPC streaming for efficient request/response handling.

### Parity with Go Plugins

Python plugins have feature parity with Go plugins:

| Feature | Go Plugins | Python Plugins |
|---------|------------|----------------|
| Lifecycle hooks | Yes | Yes |
| Message hooks | Yes | Yes |
| User/Channel/Team hooks | Yes | Yes |
| Slash commands | Yes | Yes |
| ServeHTTP | Yes | Yes (streaming) |
| KV Store | Yes | Yes |
| Plugin API | Yes | Yes |
| Health checks | Yes | Yes |
| Crash recovery | Yes | Yes |

### Known Differences

- **Startup Time**: Python plugins have a slightly longer startup time (~2-5 seconds) due to Python interpreter initialization and module imports.
- **Memory Overhead**: Python plugins use more memory than equivalent Go plugins due to the Python runtime.
- **ServeMetrics**: The ServeMetrics hook is not yet implemented for Python plugins.

## Troubleshooting

### Plugin Fails to Start

**Symptoms**: Plugin activation fails, logs show "failed to start plugin"

**Possible Causes**:

1. **Python not found**: Ensure Python 3.9+ is installed and available in PATH
   ```bash
   python3 --version
   ```

2. **grpcio not installed**: The plugin SDK requires grpcio
   ```bash
   pip install grpcio grpcio-tools
   ```

3. **Virtual environment not found**: If using venv mode, ensure the virtual environment exists
   ```bash
   # Create virtual environment in plugin directory
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Script syntax error**: Check the plugin script for Python syntax errors
   ```bash
   python3 -m py_compile server/plugin.py
   ```

### Hooks Not Called

**Symptoms**: Plugin activates but hooks are never invoked

**Possible Causes**:

1. **Implemented() not returning hooks**: Verify your plugin's `Implemented()` returns the correct hook names
   ```python
   # The SDK handles this automatically when using @hook decorator
   @hook(HookName.MessageHasBeenPosted)
   def on_message(self, context, post):
       pass
   ```

2. **Hook method signature mismatch**: Ensure hook methods have the correct signature
   ```python
   # Correct: includes self parameter
   def message_has_been_posted(self, context, post):
       pass
   ```

3. **Exception in hook**: Check server logs for gRPC errors indicating hook failures

### HTTP Requests Fail

**Symptoms**: Requests to `/plugins/{plugin_id}/...` return 404 or 503

**Possible Causes**:

1. **ServeHTTP not implemented**: Ensure your plugin implements ServeHTTP
   ```python
   @hook(HookName.ServeHTTP)
   def serve_http(self, context, request):
       return {"status_code": 200, "body": "OK"}
   ```

2. **Plugin not active**: Verify the plugin is active in System Console > Plugins

3. **Incorrect plugin ID**: Ensure the plugin ID in the URL matches your manifest's `id` field

### API Calls Fail

**Symptoms**: API calls from Python plugin return errors

**Possible Causes**:

1. **MATTERMOST_API_TARGET not set**: The environment variable should be set automatically by the supervisor. Check server logs for plugin startup messages.

2. **Permission denied**: Ensure your plugin has the required permissions for the API call

3. **Invalid parameters**: Check API method signatures and parameter types

### Performance Issues

**Symptoms**: Plugin operations are slow

**Possible Solutions**:

1. **Batch API calls**: Instead of multiple individual calls, use batch methods when available

2. **Cache frequently used data**: Use the KV store for caching
   ```python
   # Cache user data
   cached = self.api.kv_get("user_cache")
   if not cached:
       user = self.api.get_user(user_id)
       self.api.kv_set("user_cache", user, expires_in=300)
   ```

3. **Use async operations**: For I/O-bound operations, use the async API client

### Debugging Tips

1. **Enable debug logging**: Set log level to debug in your plugin
   ```python
   self.logger.debug("Detailed debug information")
   ```

2. **Check server logs**: Plugin errors appear in Mattermost server logs
   ```bash
   tail -f /var/log/mattermost/mattermost.log | grep plugin
   ```

3. **Test locally**: Run your plugin script directly to check for Python errors
   ```bash
   python3 server/plugin.py
   # Should print gRPC handshake line and wait for connections
   ```
