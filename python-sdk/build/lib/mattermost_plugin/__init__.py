# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Mattermost Plugin SDK for Python.

This SDK provides a Pythonic interface to the Mattermost Plugin API via gRPC.
Python plugins can use this SDK to interact with the Mattermost server.

Plugin development::

    from mattermost_plugin import Plugin, hook, HookName

    class MyPlugin(Plugin):
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            self.logger.info("Plugin activated!")
            version = self.api.get_server_version()
            self.logger.info(f"Server version: {version}")

        @hook(HookName.MessageWillBePosted)
        def filter_messages(self, context, post):
            if "spam" in post.message.lower():
                return None, "Spam detected"
            return post, ""

    if __name__ == "__main__":
        from mattermost_plugin.server import run_plugin
        run_plugin(MyPlugin)

Basic API client usage::

    from mattermost_plugin import PluginAPIClient, PluginAPIError

    # Use with context manager for automatic cleanup
    with PluginAPIClient(target="localhost:50051") as client:
        try:
            version = client.get_server_version()
            print(f"Server version: {version}")
        except PluginAPIError as e:
            print(f"Error: {e}")

Async usage::

    from mattermost_plugin import AsyncPluginAPIClient

    async with AsyncPluginAPIClient(target="localhost:50051") as client:
        version = await client.get_server_version()
        print(f"Server version: {version}")
"""

from mattermost_plugin.client import PluginAPIClient
from mattermost_plugin.async_client import AsyncPluginAPIClient
from mattermost_plugin.exceptions import (
    PluginAPIError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
    AlreadyExistsError,
    UnavailableError,
    convert_grpc_error,
)
from mattermost_plugin.hooks import (
    HookName,
    hook,
    HookRegistrationError,
)
from mattermost_plugin.plugin import Plugin
from mattermost_plugin.runtime_config import RuntimeConfig, load_runtime_config
from mattermost_plugin._internal.wrappers import Command

__version__ = "0.1.0"

__all__ = [
    # Plugin development
    "Plugin",
    "hook",
    "HookName",
    "HookRegistrationError",
    "Command",
    # Configuration
    "RuntimeConfig",
    "load_runtime_config",
    # Clients
    "PluginAPIClient",
    "AsyncPluginAPIClient",
    # Exceptions
    "PluginAPIError",
    "NotFoundError",
    "PermissionDeniedError",
    "ValidationError",
    "AlreadyExistsError",
    "UnavailableError",
    # Utilities
    "convert_grpc_error",
    # Version
    "__version__",
]
