# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Plugin server bootstrap for Mattermost Python plugins.

This module provides the gRPC server infrastructure for Python plugins:
- Async gRPC server with configurable options
- Health service registration (grpc.health.v1.Health)
- go-plugin compatible handshake line output
- Graceful shutdown handling

Usage:
    from mattermost_plugin import Plugin, hook, HookName
    from mattermost_plugin.server import serve_plugin

    class MyPlugin(Plugin):
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            self.logger.info("Plugin activated!")

    if __name__ == "__main__":
        import asyncio
        asyncio.run(serve_plugin(MyPlugin))
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys
from typing import Optional, Sequence, Tuple, Type, TYPE_CHECKING

import grpc
from grpc import aio as grpc_aio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from mattermost_plugin.runtime_config import RuntimeConfig, load_runtime_config
from mattermost_plugin._internal.hook_runner import DEFAULT_HOOK_TIMEOUT
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl
from mattermost_plugin.grpc import hooks_pb2_grpc

if TYPE_CHECKING:
    from mattermost_plugin.plugin import Plugin
    from mattermost_plugin.client import PluginAPIClient

logger = logging.getLogger(__name__)

# Default gRPC server options (consistent with Phase 6 channel options)
DEFAULT_SERVER_OPTIONS: Sequence[Tuple[str, int]] = [
    ("grpc.max_send_message_length", 64 * 1024 * 1024),  # 64MB
    ("grpc.max_receive_message_length", 64 * 1024 * 1024),  # 64MB
]

# go-plugin handshake protocol version
GO_PLUGIN_CORE_PROTOCOL_VERSION = "1"
GO_PLUGIN_APP_PROTOCOL_VERSION = "1"


def format_handshake_line(port: int) -> str:
    """
    Format the go-plugin handshake line.

    The handshake format is:
        CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL

    Args:
        port: The port number the gRPC server is listening on.

    Returns:
        The handshake line string (without newline).
    """
    return f"{GO_PLUGIN_CORE_PROTOCOL_VERSION}|{GO_PLUGIN_APP_PROTOCOL_VERSION}|tcp|127.0.0.1:{port}|grpc"


class PluginServer:
    """
    gRPC server wrapper for Mattermost Python plugins.

    This class manages the gRPC server lifecycle, including:
    - Server creation with health service
    - Handshake line output
    - Graceful shutdown

    The server binds to an ephemeral port on localhost (127.0.0.1:0)
    and outputs the actual port in the handshake line.
    """

    def __init__(
        self,
        plugin_instance: "Plugin",
        config: Optional[RuntimeConfig] = None,
        options: Optional[Sequence[Tuple[str, int]]] = None,
    ) -> None:
        """
        Initialize the plugin server.

        Args:
            plugin_instance: The Plugin instance to serve.
            config: Runtime configuration. If None, loaded from environment.
            options: gRPC server options. If None, uses defaults.
        """
        self.plugin = plugin_instance
        self.config = config or load_runtime_config()
        self.options = options or DEFAULT_SERVER_OPTIONS

        self._server: Optional[grpc_aio.Server] = None
        self._port: Optional[int] = None
        self._shutdown_event: Optional[asyncio.Event] = None
        self._health_servicer: Optional[health.HealthServicer] = None
        self._hooks_servicer: Optional[PluginHooksServicerImpl] = None

    @property
    def port(self) -> Optional[int]:
        """The port the server is listening on, or None if not started."""
        return self._port

    async def start(self) -> int:
        """
        Start the gRPC server.

        This method:
        1. Creates the async gRPC server
        2. Registers the health service
        3. Binds to an ephemeral port
        4. Starts the server
        5. Outputs the handshake line to stdout

        Returns:
            The port number the server is listening on.

        Raises:
            RuntimeError: If the server is already started.
        """
        if self._server is not None:
            raise RuntimeError("Server is already started")

        # Create the async server
        self._server = grpc_aio.server(options=list(self.options))

        # Register health service
        self._health_servicer = health.HealthServicer()
        health_pb2_grpc.add_HealthServicer_to_server(
            self._health_servicer, self._server
        )

        # Set health status for "plugin" service (required by go-plugin)
        self._health_servicer.set(
            "plugin",
            health_pb2.HealthCheckResponse.SERVING,
        )

        # Also set overall health (empty service name)
        self._health_servicer.set(
            "",
            health_pb2.HealthCheckResponse.SERVING,
        )

        # Register hook servicer
        self._hooks_servicer = PluginHooksServicerImpl(
            plugin=self.plugin,
            timeout=DEFAULT_HOOK_TIMEOUT,
        )
        hooks_pb2_grpc.add_PluginHooksServicer_to_server(
            self._hooks_servicer, self._server
        )
        logger.debug("Hook servicer registered")

        # Bind to ephemeral port on localhost
        self._port = self._server.add_insecure_port("127.0.0.1:0")

        # Start the server
        await self._server.start()

        logger.info(f"Plugin server started on port {self._port}")

        # Output handshake line to stdout (MUST be first stdout line)
        # This is critical for go-plugin compatibility
        handshake = format_handshake_line(self._port)
        print(handshake, flush=True)

        logger.debug(f"Handshake output: {handshake}")

        return self._port

    async def stop(self, grace_period: float = 5.0) -> None:
        """
        Stop the gRPC server gracefully.

        Args:
            grace_period: Time in seconds to wait for ongoing RPCs to complete.
        """
        if self._server is None:
            return

        logger.info("Stopping plugin server...")

        # Set health to NOT_SERVING before shutdown
        if self._health_servicer is not None:
            self._health_servicer.set(
                "plugin",
                health_pb2.HealthCheckResponse.NOT_SERVING,
            )
            self._health_servicer.set(
                "",
                health_pb2.HealthCheckResponse.NOT_SERVING,
            )

        # Stop the server with grace period
        await self._server.stop(grace_period)

        self._server = None
        self._port = None

        logger.info("Plugin server stopped")

    async def wait_for_termination(self) -> None:
        """
        Wait for the server to terminate.

        This method blocks until the server is stopped, either by
        calling stop() or by receiving a shutdown signal.
        """
        if self._server is None:
            return

        await self._server.wait_for_termination()


async def serve_plugin(
    plugin_class: Type["Plugin"],
    config: Optional[RuntimeConfig] = None,
    options: Optional[Sequence[Tuple[str, int]]] = None,
) -> None:
    """
    Start a plugin server and wait for termination.

    This is the main entry point for running a Python plugin. It:
    1. Loads runtime configuration from environment
    2. Creates the plugin instance with API client
    3. Starts the gRPC server with health service
    4. Outputs the go-plugin handshake line
    5. Waits for termination (signal or explicit stop)

    Args:
        plugin_class: The Plugin subclass to instantiate and serve.
        config: Optional runtime configuration. If None, loaded from env.
        options: Optional gRPC server options.

    Example:
        from mattermost_plugin import Plugin, hook, HookName
        from mattermost_plugin.server import serve_plugin

        class MyPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                self.logger.info("Activated!")

        if __name__ == "__main__":
            import asyncio
            asyncio.run(serve_plugin(MyPlugin))
    """
    # Load configuration
    if config is None:
        config = load_runtime_config()

    # Configure logging (to stderr, not stdout)
    config.configure_logging()

    logger.info(f"Starting plugin: {config.plugin_id or plugin_class.__name__}")
    logger.debug(f"API target: {config.api_target}")

    # Create API client (optional - may not be connected yet)
    api_client: Optional["PluginAPIClient"] = None
    try:
        from mattermost_plugin.client import PluginAPIClient

        if config.api_target:
            api_client = PluginAPIClient(target=config.api_target)
            # Note: We don't connect yet - hooks will connect when needed
    except Exception as e:
        logger.warning(f"Could not create API client: {e}")

    # Create plugin instance
    plugin_instance = plugin_class(
        api=api_client,
        config=config,
    )

    logger.info(
        f"Plugin implements hooks: {plugin_class.implemented_hooks()}"
    )

    # Create and start server
    server = PluginServer(
        plugin_instance=plugin_instance,
        config=config,
        options=options,
    )

    # Set up signal handlers for graceful shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(sig: signal.Signals) -> None:
        logger.info(f"Received signal {sig.name}, initiating shutdown...")
        shutdown_event.set()

    # Register signal handlers
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, signal_handler, sig)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler for all signals
            pass

    try:
        # Start the server
        await server.start()

        # Wait for shutdown signal or server termination
        await asyncio.wait(
            [
                asyncio.create_task(shutdown_event.wait()),
                asyncio.create_task(server.wait_for_termination()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )

    except Exception as e:
        logger.exception(f"Error running plugin server: {e}")
        raise

    finally:
        # Clean shutdown
        await server.stop()

        # Close API client if connected
        if api_client is not None:
            api_client.close()

        logger.info("Plugin shutdown complete")


def run_plugin(plugin_class: Type["Plugin"]) -> None:
    """
    Convenience function to run a plugin synchronously.

    This function handles the asyncio event loop creation and
    runs the plugin until termination.

    Args:
        plugin_class: The Plugin subclass to run.

    Example:
        from mattermost_plugin import Plugin, hook, HookName
        from mattermost_plugin.server import run_plugin

        class MyPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                pass

        if __name__ == "__main__":
            run_plugin(MyPlugin)
    """
    asyncio.run(serve_plugin(plugin_class))
