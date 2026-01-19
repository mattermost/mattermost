# Hello Python - Example Mattermost Plugin

A complete example demonstrating the Mattermost Python Plugin SDK.

## Overview

This plugin showcases the core features of the Python SDK:

- **Lifecycle Hooks**: `OnActivate` and `OnDeactivate` for plugin setup/teardown
- **Message Filtering**: `MessageWillBePosted` to inspect and modify messages
- **Slash Commands**: `ExecuteCommand` to handle custom `/hello` command
- **API Client**: Accessing Mattermost APIs via `self.api`
- **Logging**: Using `self.logger` for plugin logging

## Prerequisites

- Python 3.9 or higher
- Mattermost server with Python plugin support enabled

## Plugin Structure

```
hello_python/
  plugin.json        # Plugin manifest with Python runtime configuration
  plugin.py          # Main plugin implementation
  requirements.txt   # Python dependencies
  README.md          # This file
```

### plugin.json

The manifest declares this as a Python plugin:

```json
{
  "server": {
    "runtime": "python",
    "python_version": ">=3.9",
    "python": {
      "entry_point": "plugin.py"
    }
  }
}
```

Key fields:
- `server.runtime`: Set to `"python"` to indicate this is a Python plugin
- `server.python_version`: Minimum Python version required
- `server.python.entry_point`: The Python file containing the plugin class

### plugin.py

The main plugin implementation. Key patterns:

```python
from mattermost_plugin import Plugin, hook, HookName

class HelloPythonPlugin(Plugin):
    @hook(HookName.OnActivate)
    def on_activate(self) -> None:
        self.logger.info("Plugin activated!")
        version = self.api.get_server_version()

    @hook(HookName.MessageWillBePosted)
    def filter_message(self, context, post):
        # Return (post, "") to allow, (None, "reason") to reject
        return post, ""

    @hook(HookName.ExecuteCommand)
    def execute_command(self, context, args):
        return {"response_type": "ephemeral", "text": "Hello!"}

if __name__ == "__main__":
    from mattermost_plugin.server import run_plugin
    run_plugin(HelloPythonPlugin)
```

## Installation (Development)

1. Create and activate a virtual environment:

```bash
cd examples/hello_python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install the SDK in development mode:

```bash
pip install -e ../../python-sdk
```

3. Verify the plugin parses correctly:

```bash
python3 -c "import plugin; print('Plugin loaded successfully')"
```

## Installation (Production)

For production deployments, the SDK will be available via pip:

```bash
pip install mattermost-plugin-sdk
```

## Hooks Demonstrated

### OnActivate

Called when the plugin is enabled. Use for:
- Initializing plugin state
- Registering slash commands
- Connecting to external services

### OnDeactivate

Called when the plugin is disabled. Use for:
- Cleaning up resources
- Saving state
- Disconnecting from services

### MessageWillBePosted

Called before a message is posted. Return values:
- `(post, "")` - Allow the message (optionally modified)
- `(None, "reason")` - Reject the message with a reason

### ExecuteCommand

Called when a slash command is invoked. Return a response dict:
- `response_type`: `"ephemeral"` (private) or `"in_channel"` (public)
- `text`: The response message

## Running the Plugin

The plugin is designed to be run by the Mattermost server's Python plugin supervisor. The supervisor:

1. Starts the plugin process
2. Establishes gRPC communication
3. Invokes hooks as events occur

For standalone testing:

```bash
python plugin.py
```

Note: The plugin will output a go-plugin handshake line and wait for gRPC connections. In standalone mode, most functionality requires a connected Mattermost server.

## Next Steps

- Modify the word filter in `MessageWillBePosted`
- Add new slash commands in `ExecuteCommand`
- Implement additional hooks from `HookName` enum
- Use `self.api` to interact with Mattermost (users, channels, posts, etc.)

## Resources

- [Mattermost Plugin Documentation](https://developers.mattermost.com/extend/plugins/)
- [Python SDK API Reference](../../python-sdk/README.md)
