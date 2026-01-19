# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for lifecycle hook implementations in the hook servicer.

Tests verify:
- Implemented RPC returns correct hook list
- OnActivate success/failure propagation
- OnDeactivate best-effort semantics
- OnConfigurationChange error handling
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import (
    PluginHooksServicerImpl,
    _make_app_error,
)
from mattermost_plugin.grpc import hooks_lifecycle_pb2


class TestImplementedRPC:
    """Tests for the Implemented RPC method."""

    @pytest.mark.asyncio
    async def test_returns_empty_list_for_no_hooks(self) -> None:
        """Test that plugin with no hooks returns empty list."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ImplementedRequest()
        response = await servicer.Implemented(request, context)

        assert list(response.hooks) == []

    @pytest.mark.asyncio
    async def test_returns_implemented_hooks(self) -> None:
        """Test that implemented hooks are returned."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

            @hook(HookName.MessageWillBePosted)
            def filter_post(self, ctx, post):
                return post, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ImplementedRequest()
        response = await servicer.Implemented(request, context)

        hooks = list(response.hooks)
        assert "OnActivate" in hooks
        assert "MessageWillBePosted" in hooks
        assert len(hooks) == 2

    @pytest.mark.asyncio
    async def test_returns_sorted_list(self) -> None:
        """Test that hooks are returned in sorted order."""

        class TestPlugin(Plugin):
            @hook(HookName.UserHasLoggedIn)
            def login(self) -> None:
                pass

            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                return post, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ImplementedRequest()
        response = await servicer.Implemented(request, context)

        hooks = list(response.hooks)
        assert hooks == sorted(hooks)


class TestOnActivate:
    """Tests for OnActivate hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test that activation succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await servicer.OnActivate(request, context)

        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_success_when_handler_succeeds(self) -> None:
        """Test successful activation when handler returns None."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await servicer.OnActivate(request, context)

        assert call_count[0] == 1
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_failure_when_handler_raises(self) -> None:
        """Test that handler exceptions propagate as errors."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                raise ValueError("Activation failed!")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await servicer.OnActivate(request, context)

        assert response.HasField("error")
        assert "Activation failed" in response.error.message or "ValueError" in response.error.message

    @pytest.mark.asyncio
    async def test_failure_when_handler_returns_error_string(self) -> None:
        """Test that returning non-empty string is treated as error."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> str:
                return "Configuration invalid"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await servicer.OnActivate(request, context)

        assert response.HasField("error")
        assert "Configuration invalid" in response.error.message

    @pytest.mark.asyncio
    async def test_async_handler_works(self) -> None:
        """Test that async OnActivate handlers work."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            async def activate(self) -> None:
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await servicer.OnActivate(request, context)

        assert call_count[0] == 1
        assert not response.HasField("error")


class TestOnDeactivate:
    """Tests for OnDeactivate hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test deactivation succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnDeactivateRequest()
        response = await servicer.OnDeactivate(request, context)

        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that deactivate handler is called."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.OnDeactivate)
            def deactivate(self) -> None:
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnDeactivateRequest()
        response = await servicer.OnDeactivate(request, context)

        assert call_count[0] == 1

    @pytest.mark.asyncio
    async def test_errors_are_logged_but_not_fatal(self) -> None:
        """Test that deactivate errors don't prevent response."""

        class TestPlugin(Plugin):
            @hook(HookName.OnDeactivate)
            def deactivate(self) -> None:
                raise RuntimeError("Cleanup failed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnDeactivateRequest()
        response = await servicer.OnDeactivate(request, context)

        # Error is returned but this is informational
        assert response.HasField("error")


class TestOnConfigurationChange:
    """Tests for OnConfigurationChange hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test config change succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnConfigurationChangeRequest()
        response = await servicer.OnConfigurationChange(request, context)

        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that configuration change handler is called."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.OnConfigurationChange)
            def config_change(self) -> None:
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnConfigurationChangeRequest()
        response = await servicer.OnConfigurationChange(request, context)

        assert call_count[0] == 1
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_errors_are_logged_but_plugin_continues(self) -> None:
        """Test that config errors are logged but don't stop plugin."""

        class TestPlugin(Plugin):
            @hook(HookName.OnConfigurationChange)
            def config_change(self) -> None:
                raise ValueError("Invalid config")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.OnConfigurationChangeRequest()
        response = await servicer.OnConfigurationChange(request, context)

        # Error is returned but plugin continues (this is logged server-side)
        assert response.HasField("error")


class TestMakeAppError:
    """Tests for _make_app_error helper."""

    def test_creates_error_with_defaults(self) -> None:
        """Test error creation with default values."""
        error = _make_app_error("Test error")

        assert error.id == "plugin.error"
        assert error.message == "Test error"
        assert error.detailed_error == ""
        assert error.status_code == 500
        assert error.where == ""

    def test_creates_error_with_custom_values(self) -> None:
        """Test error creation with custom values."""
        error = _make_app_error(
            message="Custom error",
            error_id="custom.error.id",
            detailed_error="More details",
            status_code=400,
            where="TestMethod",
        )

        assert error.id == "custom.error.id"
        assert error.message == "Custom error"
        assert error.detailed_error == "More details"
        assert error.status_code == 400
        assert error.where == "TestMethod"
