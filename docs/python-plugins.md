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
