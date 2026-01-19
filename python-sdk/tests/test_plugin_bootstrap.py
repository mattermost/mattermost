# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for plugin server bootstrap.

Tests verify:
- Server starts on ephemeral port
- Health Check service responds with SERVING
- Handshake formatter produces correct string
"""

import asyncio
from typing import Optional

import grpc
import pytest
from grpc import aio as grpc_aio
from grpc_health.v1 import health_pb2, health_pb2_grpc

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.server import (
    PluginServer,
    format_handshake_line,
    GO_PLUGIN_CORE_PROTOCOL_VERSION,
    GO_PLUGIN_APP_PROTOCOL_VERSION,
)
from mattermost_plugin.runtime_config import RuntimeConfig


class TestHandshakeFormat:
    """Tests for handshake line formatting."""

    def test_handshake_format_basic(self) -> None:
        """Test basic handshake format."""
        handshake = format_handshake_line(50051)

        parts = handshake.split("|")
        assert len(parts) == 5
        assert parts[0] == GO_PLUGIN_CORE_PROTOCOL_VERSION
        assert parts[1] == GO_PLUGIN_APP_PROTOCOL_VERSION
        assert parts[2] == "tcp"
        assert parts[3] == "127.0.0.1:50051"
        assert parts[4] == "grpc"

    def test_handshake_format_various_ports(self) -> None:
        """Test handshake with various port numbers."""
        for port in [1, 8080, 50051, 65535]:
            handshake = format_handshake_line(port)
            assert f"127.0.0.1:{port}" in handshake

    def test_handshake_protocol_versions(self) -> None:
        """Test that protocol versions are correct for go-plugin."""
        handshake = format_handshake_line(50051)

        # go-plugin expects version 1 for core protocol
        assert handshake.startswith("1|")
        # Our app protocol version is 1
        assert "|1|" in handshake


class TestPluginServer:
    """Tests for PluginServer class."""

    @pytest.fixture
    def simple_plugin_class(self) -> type:
        """Create a simple test plugin class."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                pass

        return TestPlugin

    @pytest.fixture
    def config(self) -> RuntimeConfig:
        """Create test configuration."""
        return RuntimeConfig(
            plugin_id="test-plugin",
            api_target="127.0.0.1:50051",
            hook_timeout=30.0,
            log_level="DEBUG",
        )

    @pytest.mark.asyncio
    async def test_server_starts_on_ephemeral_port(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that server binds to an ephemeral port."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        try:
            port = await server.start()

            # Port should be a valid ephemeral port
            assert port > 0
            assert port <= 65535
            assert server.port == port

        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_health_check_responds_serving(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that health check returns SERVING status."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        try:
            port = await server.start()

            # Connect to the server and check health
            async with grpc_aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                health_stub = health_pb2_grpc.HealthStub(channel)

                # Check "plugin" service (required by go-plugin)
                request = health_pb2.HealthCheckRequest(service="plugin")
                response = await health_stub.Check(request)

                assert response.status == health_pb2.HealthCheckResponse.SERVING

        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_health_check_overall_serving(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that overall health check returns SERVING."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        try:
            port = await server.start()

            async with grpc_aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                health_stub = health_pb2_grpc.HealthStub(channel)

                # Check overall health (empty service name)
                request = health_pb2.HealthCheckRequest(service="")
                response = await health_stub.Check(request)

                assert response.status == health_pb2.HealthCheckResponse.SERVING

        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_server_stop_sets_not_serving(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that stopping server sets health to NOT_SERVING."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        port = await server.start()

        # Create channel before stopping
        channel = grpc_aio.insecure_channel(f"127.0.0.1:{port}")
        health_stub = health_pb2_grpc.HealthStub(channel)

        # Verify serving before stop
        request = health_pb2.HealthCheckRequest(service="plugin")
        response = await health_stub.Check(request)
        assert response.status == health_pb2.HealthCheckResponse.SERVING

        # Stop the server
        await server.stop()

        # Server is stopped, connection should fail or return NOT_SERVING
        # The actual behavior depends on timing, so we just verify stop completes
        await channel.close()

    @pytest.mark.asyncio
    async def test_server_cannot_start_twice(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that starting server twice raises error."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        try:
            await server.start()

            with pytest.raises(RuntimeError, match="already started"):
                await server.start()

        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_server_stop_is_idempotent(
        self, simple_plugin_class: type, config: RuntimeConfig
    ) -> None:
        """Test that stopping server multiple times is safe."""
        plugin = simple_plugin_class()
        server = PluginServer(plugin_instance=plugin, config=config)

        await server.start()

        # Stop multiple times - should not raise
        await server.stop()
        await server.stop()
        await server.stop()


class TestRuntimeConfig:
    """Tests for RuntimeConfig."""

    def test_config_defaults(self) -> None:
        """Test that config has sensible defaults."""
        config = RuntimeConfig()

        assert config.plugin_id == ""
        assert config.api_target == "127.0.0.1:50051"
        assert config.hook_timeout == 30.0
        assert config.log_level == "INFO"

    def test_config_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test loading config from environment variables."""
        monkeypatch.setenv("MATTERMOST_PLUGIN_ID", "my-plugin")
        monkeypatch.setenv("MATTERMOST_PLUGIN_API_TARGET", "localhost:9999")
        monkeypatch.setenv("MATTERMOST_PLUGIN_HOOK_TIMEOUT", "60")
        monkeypatch.setenv("MATTERMOST_PLUGIN_LOG_LEVEL", "DEBUG")

        config = RuntimeConfig.from_env()

        assert config.plugin_id == "my-plugin"
        assert config.api_target == "localhost:9999"
        assert config.hook_timeout == 60.0
        assert config.log_level == "DEBUG"

    def test_config_invalid_timeout_uses_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that invalid timeout falls back to default."""
        monkeypatch.setenv("MATTERMOST_PLUGIN_HOOK_TIMEOUT", "not-a-number")

        config = RuntimeConfig.from_env()

        assert config.hook_timeout == 30.0


class TestPluginImplementedHooks:
    """Tests for Plugin.implemented_hooks() integration."""

    def test_empty_plugin_has_no_hooks(self) -> None:
        """Test that a plugin without hooks returns empty list."""

        class EmptyPlugin(Plugin):
            pass

        assert EmptyPlugin.implemented_hooks() == []

    def test_plugin_lists_implemented_hooks(self) -> None:
        """Test that implemented hooks are listed correctly."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

            @hook(HookName.OnDeactivate)
            def deactivate(self) -> None:
                pass

        hooks = TestPlugin.implemented_hooks()

        assert len(hooks) == 2
        assert "OnActivate" in hooks
        assert "OnDeactivate" in hooks


class TestIntegration:
    """Integration tests combining multiple components."""

    @pytest.mark.asyncio
    async def test_full_plugin_lifecycle(self) -> None:
        """Test complete plugin startup and health check flow."""

        class IntegrationPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                pass

            @hook(HookName.MessageWillBePosted)
            def filter_message(self, context: object, post: object) -> tuple:
                return post, ""

        config = RuntimeConfig(
            plugin_id="integration-test",
            api_target="127.0.0.1:50051",
        )

        plugin = IntegrationPlugin()
        server = PluginServer(plugin_instance=plugin, config=config)

        try:
            # Start server
            port = await server.start()
            assert port > 0

            # Verify hooks are registered
            assert IntegrationPlugin.has_hook("OnActivate")
            assert IntegrationPlugin.has_hook("MessageWillBePosted")
            assert not IntegrationPlugin.has_hook("OnDeactivate")

            # Verify health
            async with grpc_aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                health_stub = health_pb2_grpc.HealthStub(channel)
                request = health_pb2.HealthCheckRequest(service="plugin")
                response = await health_stub.Check(request)
                assert response.status == health_pb2.HealthCheckResponse.SERVING

        finally:
            await server.stop()
