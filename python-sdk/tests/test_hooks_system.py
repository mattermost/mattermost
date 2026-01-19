# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for system, websocket, cluster, and shared channels hook implementations.

Tests verify:
- System hooks: OnInstall, OnSendDailyTelemetry, RunDataRetention, OnCloudLimitsUpdated
- WebSocket hooks: OnWebSocketConnect/Disconnect, WebSocketMessageHasBeenPosted
- Cluster hook: OnPluginClusterEvent
- Shared Channels hooks: OnSharedChannelsSyncMsg, OnSharedChannelsPing, etc.
- Support hook: GenerateSupportData
"""

import pytest
from unittest.mock import MagicMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl
from mattermost_plugin.grpc import hooks_lifecycle_pb2
from mattermost_plugin.grpc import hooks_command_pb2
from mattermost_plugin.grpc import hooks_common_pb2
from mattermost_plugin.grpc import file_pb2


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


class TestOnInstall:
    """Tests for OnInstall hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test install succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnInstallRequest(
            plugin_context=make_plugin_context(),
            event=hooks_lifecycle_pb2.OnInstallEvent(),
        )
        response = await servicer.OnInstall(request, context)

        # Not implemented = success
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_handler_success(self) -> None:
        """Test successful install handler."""
        install_called = [False]

        class TestPlugin(Plugin):
            @hook(HookName.OnInstall)
            def on_install(self, ctx, event):
                install_called[0] = True
                return None  # Success

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnInstallRequest(
            plugin_context=make_plugin_context(),
            event=hooks_lifecycle_pb2.OnInstallEvent(),
        )
        response = await servicer.OnInstall(request, context)

        assert install_called[0]
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_handler_returns_error(self) -> None:
        """Test install handler returning an error."""

        class TestPlugin(Plugin):
            @hook(HookName.OnInstall)
            def on_install(self, ctx, event):
                return "Installation failed: missing dependency"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnInstallRequest(
            plugin_context=make_plugin_context(),
            event=hooks_lifecycle_pb2.OnInstallEvent(),
        )
        response = await servicer.OnInstall(request, context)

        assert response.HasField("error")
        assert "Installation failed" in response.error.message


class TestOnSendDailyTelemetry:
    """Tests for OnSendDailyTelemetry hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test telemetry hook succeeds when not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnSendDailyTelemetryRequest()
        response = await servicer.OnSendDailyTelemetry(request, context)

        assert isinstance(response, hooks_lifecycle_pb2.OnSendDailyTelemetryResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that telemetry handler is called."""
        called = [False]

        class TestPlugin(Plugin):
            @hook(HookName.OnSendDailyTelemetry)
            def on_telemetry(self):
                called[0] = True

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnSendDailyTelemetryRequest()
        await servicer.OnSendDailyTelemetry(request, context)

        assert called[0]


class TestRunDataRetention:
    """Tests for RunDataRetention hook."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_not_implemented(self) -> None:
        """Test default returns 0 deleted items."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.RunDataRetentionRequest(
            now_time=1234567890000,
            batch_size=100,
        )
        response = await servicer.RunDataRetention(request, context)

        assert response.deleted_count == 0
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_returns_deleted_count(self) -> None:
        """Test returning count of deleted items."""

        class TestPlugin(Plugin):
            @hook(HookName.RunDataRetention)
            def run_retention(self, now_time, batch_size):
                # Simulate deleting 50 items
                return 50, None

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.RunDataRetentionRequest(
            now_time=1234567890000,
            batch_size=100,
        )
        response = await servicer.RunDataRetention(request, context)

        assert response.deleted_count == 50
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_returns_error(self) -> None:
        """Test returning an error during retention."""

        class TestPlugin(Plugin):
            @hook(HookName.RunDataRetention)
            def run_retention(self, now_time, batch_size):
                return 0, "Database error during cleanup"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.RunDataRetentionRequest(
            now_time=1234567890000,
            batch_size=100,
        )
        response = await servicer.RunDataRetention(request, context)

        assert response.HasField("error")
        assert "Database error" in response.error.message


class TestOnCloudLimitsUpdated:
    """Tests for OnCloudLimitsUpdated hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that cloud limits handler is called."""
        limits_received = []

        class TestPlugin(Plugin):
            @hook(HookName.OnCloudLimitsUpdated)
            def on_limits_updated(self, limits):
                limits_received.append(limits)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnCloudLimitsUpdatedRequest(
            limits=hooks_lifecycle_pb2.ProductLimits(),
        )
        await servicer.OnCloudLimitsUpdated(request, context)

        assert len(limits_received) == 1


class TestOnWebSocketConnect:
    """Tests for OnWebSocketConnect hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that WebSocket connect handler is called."""
        connections = []

        class TestPlugin(Plugin):
            @hook(HookName.OnWebSocketConnect)
            def on_connect(self, web_conn_id, user_id):
                connections.append((web_conn_id, user_id))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.OnWebSocketConnectRequest(
            web_conn_id="conn123",
            user_id="user123",
        )
        await servicer.OnWebSocketConnect(request, context)

        assert ("conn123", "user123") in connections


class TestOnWebSocketDisconnect:
    """Tests for OnWebSocketDisconnect hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that WebSocket disconnect handler is called."""
        disconnections = []

        class TestPlugin(Plugin):
            @hook(HookName.OnWebSocketDisconnect)
            def on_disconnect(self, web_conn_id, user_id):
                disconnections.append((web_conn_id, user_id))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.OnWebSocketDisconnectRequest(
            web_conn_id="conn123",
            user_id="user123",
        )
        await servicer.OnWebSocketDisconnect(request, context)

        assert ("conn123", "user123") in disconnections


class TestWebSocketMessageHasBeenPosted:
    """Tests for WebSocketMessageHasBeenPosted hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that WebSocket message handler is called."""
        messages = []

        class TestPlugin(Plugin):
            @hook(HookName.WebSocketMessageHasBeenPosted)
            def on_ws_message(self, web_conn_id, user_id, request):
                messages.append((web_conn_id, user_id))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.WebSocketMessageHasBeenPostedRequest(
            web_conn_id="conn123",
            user_id="user123",
            request=hooks_command_pb2.WebSocketRequest(
                seq=1,
                action="test_action",
            ),
        )
        await servicer.WebSocketMessageHasBeenPosted(request, context)

        assert ("conn123", "user123") in messages


class TestOnPluginClusterEvent:
    """Tests for OnPluginClusterEvent hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that cluster event handler is called."""
        events = []

        class TestPlugin(Plugin):
            @hook(HookName.OnPluginClusterEvent)
            def on_cluster_event(self, ctx, event):
                events.append(event.id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        from mattermost_plugin.grpc import api_remaining_pb2
        request = hooks_command_pb2.OnPluginClusterEventRequest(
            plugin_context=make_plugin_context(),
            event=api_remaining_pb2.PluginClusterEvent(
                id="event123",
                data=b"event data",
            ),
        )
        await servicer.OnPluginClusterEvent(request, context)

        assert "event123" in events


class TestOnSharedChannelsPing:
    """Tests for OnSharedChannelsPing hook."""

    @pytest.mark.asyncio
    async def test_returns_healthy_when_not_implemented(self) -> None:
        """Test default returns healthy=True."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.OnSharedChannelsPingRequest(
            remote_cluster=hooks_command_pb2.RemoteCluster(),
        )
        response = await servicer.OnSharedChannelsPing(request, context)

        assert response.healthy is True

    @pytest.mark.asyncio
    async def test_returns_unhealthy(self) -> None:
        """Test returning unhealthy status."""

        class TestPlugin(Plugin):
            @hook(HookName.OnSharedChannelsPing)
            def health_check(self, remote_cluster):
                return False

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.OnSharedChannelsPingRequest(
            remote_cluster=hooks_command_pb2.RemoteCluster(),
        )
        response = await servicer.OnSharedChannelsPing(request, context)

        assert response.healthy is False


class TestGenerateSupportData:
    """Tests for GenerateSupportData hook."""

    @pytest.mark.asyncio
    async def test_returns_empty_when_not_implemented(self) -> None:
        """Test default returns empty files list."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.GenerateSupportDataRequest(
            plugin_context=make_plugin_context(),
        )
        response = await servicer.GenerateSupportData(request, context)

        assert len(response.files) == 0
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_returns_files(self) -> None:
        """Test returning support files."""

        class TestPlugin(Plugin):
            @hook(HookName.GenerateSupportData)
            def generate_data(self, ctx):
                return [
                    file_pb2.FileData(
                        filename="plugin_state.json",
                        data=b'{"state": "healthy"}',
                    ),
                    file_pb2.FileData(
                        filename="plugin_logs.txt",
                        data=b"Log entry 1\nLog entry 2",
                    ),
                ], None

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.GenerateSupportDataRequest(
            plugin_context=make_plugin_context(),
        )
        response = await servicer.GenerateSupportData(request, context)

        assert len(response.files) == 2
        filenames = [f.filename for f in response.files]
        assert "plugin_state.json" in filenames
        assert "plugin_logs.txt" in filenames

    @pytest.mark.asyncio
    async def test_returns_error(self) -> None:
        """Test returning an error during support data generation."""

        class TestPlugin(Plugin):
            @hook(HookName.GenerateSupportData)
            def generate_data(self, ctx):
                return [], "Failed to generate support data"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.GenerateSupportDataRequest(
            plugin_context=make_plugin_context(),
        )
        response = await servicer.GenerateSupportData(request, context)

        assert response.HasField("error")
        assert "Failed to generate" in response.error.message
