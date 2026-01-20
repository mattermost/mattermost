# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Mattermost Python plugins.

## Repository Purpose

This is an example Mattermost Python plugin demonstrating the Python Plugin SDK. Use it as a template for building your own Python plugins.

## Key Commands

### Setup

```bash
# Create virtual environment with SDK
make venv

# Activate the environment
source venv/bin/activate
```

### Development

```bash
# Run linting
make lint

# Package for upload to Mattermost
make dist
```

### Packaging

```bash
# Create plugin bundle (includes vendored SDK)
make dist

# Create minimal bundle (server must have SDK installed)
make dist-minimal

# Clean build artifacts
make clean
```

## Architecture Overview

### Plugin Structure

- `plugin.json` - Plugin manifest defining metadata and runtime
- `plugin.py` - Main plugin implementation
- `requirements.txt` - Python dependencies

### Plugin Implementation Pattern

```python
from mattermost_plugin import Plugin, hook, HookName

class MyPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        self.logger.info("Plugin activated!")
        # Initialize state, register commands

    @hook(HookName.MessageWillBePosted)
    def filter_message(self, context, post):
        # Return (post, "") to allow, (None, "reason") to reject
        return post, ""

if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin
    run_plugin(MyPlugin)
```

### Available Hooks

- `OnActivate` / `OnDeactivate` - Lifecycle events
- `MessageWillBePosted` / `MessageHasBeenPosted` - Message filtering
- `ExecuteCommand` - Slash command handling
- `ServeHTTP` - HTTP endpoint handling
- See `mattermost_plugin.HookName` for full list

### API Client Usage

```python
# In any hook handler, use self.api:
user = self.api.get_user(user_id)
self.api.create_post(post)
self.api.kv_set("key", value_bytes)
```

## Best Practices

1. **Logging**: Use `self.logger` instead of print()
2. **Error Handling**: Wrap API calls in try/except
3. **State**: Use KV store for persistent state, not module-level variables
4. **Commands**: Register commands in OnActivate, they persist across restarts
5. **Testing**: Test locally before packaging

## Manifest Format (plugin.json)

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "min_server_version": "10.0.0",
  "server": {
    "executable": "plugin.py",
    "runtime": "python",
    "python_version": ">=3.9"
  }
}
```
