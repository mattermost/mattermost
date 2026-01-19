# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for command and configuration hook implementations in the hook servicer.

Tests verify:
- ExecuteCommand: returns CommandResponse on success, AppError on failure
- ConfigurationWillBeSaved: allow/reject/modify semantics
"""

import pytest
from unittest.mock import MagicMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl
from mattermost_plugin.grpc import hooks_command_pb2
from mattermost_plugin.grpc import hooks_lifecycle_pb2
from mattermost_plugin.grpc import hooks_common_pb2
from mattermost_plugin.grpc import api_remaining_pb2


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


def make_command_args(command: str = "/test hello") -> api_remaining_pb2.CommandArgs:
    """Create test CommandArgs."""
    return api_remaining_pb2.CommandArgs(
        command=command,
        user_id="user123",
        channel_id="channel123",
        team_id="team123",
        root_id="",
        trigger_id="trigger123",
    )


class TestExecuteCommand:
    """Tests for ExecuteCommand hook."""

    @pytest.mark.asyncio
    async def test_error_when_not_implemented(self) -> None:
        """Test that error is returned when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.ExecuteCommandRequest(
            plugin_context=make_plugin_context(),
            args=make_command_args(),
        )
        response = await servicer.ExecuteCommand(request, context)

        # Not implemented = error
        assert response.HasField("error")
        assert response.error.id == "plugin.execute_command.not_implemented"
        assert response.error.status_code == 501

    @pytest.mark.asyncio
    async def test_success_with_response(self) -> None:
        """Test returning a CommandResponse."""

        class TestPlugin(Plugin):
            @hook(HookName.ExecuteCommand)
            def handle_command(self, ctx, args):
                return api_remaining_pb2.CommandResponse(
                    response_type="ephemeral",
                    text=f"Received: {args.command}",
                )

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.ExecuteCommandRequest(
            plugin_context=make_plugin_context(),
            args=make_command_args("/test hello"),
        )
        response = await servicer.ExecuteCommand(request, context)

        assert not response.HasField("error")
        assert response.HasField("response")
        assert response.response.response_type == "ephemeral"
        assert "Received: /test hello" in response.response.text

    @pytest.mark.asyncio
    async def test_handler_exception_returns_error(self) -> None:
        """Test that handler exceptions return an AppError."""

        class TestPlugin(Plugin):
            @hook(HookName.ExecuteCommand)
            def handle_command(self, ctx, args):
                raise ValueError("Command handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.ExecuteCommandRequest(
            plugin_context=make_plugin_context(),
            args=make_command_args(),
        )
        response = await servicer.ExecuteCommand(request, context)

        assert response.HasField("error")
        assert "Command handler crashed" in response.error.message

    @pytest.mark.asyncio
    async def test_receives_args(self) -> None:
        """Test that handler receives command arguments."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.ExecuteCommand)
            def handle_command(self, ctx, args):
                received.append(args)
                return api_remaining_pb2.CommandResponse(text="ok")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        args = make_command_args("/mycommand arg1 arg2")
        request = hooks_command_pb2.ExecuteCommandRequest(
            plugin_context=make_plugin_context(),
            args=args,
        )
        await servicer.ExecuteCommand(request, context)

        assert len(received) == 1
        assert received[0].command == "/mycommand arg1 arg2"
        assert received[0].user_id == "user123"

    @pytest.mark.asyncio
    async def test_async_handler_works(self) -> None:
        """Test that async handlers work correctly."""

        class TestPlugin(Plugin):
            @hook(HookName.ExecuteCommand)
            async def handle_command(self, ctx, args):
                return api_remaining_pb2.CommandResponse(
                    response_type="in_channel",
                    text="Async response",
                )

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_command_pb2.ExecuteCommandRequest(
            plugin_context=make_plugin_context(),
            args=make_command_args(),
        )
        response = await servicer.ExecuteCommand(request, context)

        assert response.response.text == "Async response"


class TestConfigurationWillBeSaved:
    """Tests for ConfigurationWillBeSaved hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that config is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=b'{"key": "value"}'),
        )
        response = await servicer.ConfigurationWillBeSaved(request, context)

        # Not implemented = allow unchanged
        assert not response.HasField("error")
        assert not response.HasField("modified_config")

    @pytest.mark.asyncio
    async def test_allow_unchanged(self) -> None:
        """Test allowing config unchanged by returning None."""

        class TestPlugin(Plugin):
            @hook(HookName.ConfigurationWillBeSaved)
            def validate_config(self, config):
                return None  # Allow unchanged

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=b'{"key": "value"}'),
        )
        response = await servicer.ConfigurationWillBeSaved(request, context)

        assert not response.HasField("error")
        assert not response.HasField("modified_config")

    @pytest.mark.asyncio
    async def test_reject_with_error(self) -> None:
        """Test rejecting config by returning (None, 'error')."""

        class TestPlugin(Plugin):
            @hook(HookName.ConfigurationWillBeSaved)
            def validate_config(self, config):
                return None, "Invalid configuration: missing required field"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=b'{}'),
        )
        response = await servicer.ConfigurationWillBeSaved(request, context)

        assert response.HasField("error")
        assert "Invalid configuration" in response.error.message

    @pytest.mark.asyncio
    async def test_modify_config(self) -> None:
        """Test modifying config by returning a modified config."""
        import json

        class TestPlugin(Plugin):
            @hook(HookName.ConfigurationWillBeSaved)
            def validate_config(self, config):
                # Parse, modify, and return
                data = json.loads(config.config_json)
                data["modified"] = True
                modified = hooks_lifecycle_pb2.ConfigJson(
                    config_json=json.dumps(data).encode()
                )
                return modified, None

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=b'{"key": "value"}'),
        )
        response = await servicer.ConfigurationWillBeSaved(request, context)

        assert not response.HasField("error")
        assert response.HasField("modified_config")
        data = json.loads(response.modified_config.config_json)
        assert data["modified"] is True

    @pytest.mark.asyncio
    async def test_handler_exception_rejects(self) -> None:
        """Test that handler exceptions result in rejection."""

        class TestPlugin(Plugin):
            @hook(HookName.ConfigurationWillBeSaved)
            def validate_config(self, config):
                raise ValueError("Config validation failed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=b'{}'),
        )
        response = await servicer.ConfigurationWillBeSaved(request, context)

        assert response.HasField("error")
        assert "Config validation failed" in response.error.message

    @pytest.mark.asyncio
    async def test_receives_config(self) -> None:
        """Test that handler receives the configuration."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.ConfigurationWillBeSaved)
            def validate_config(self, config):
                received.append(config.config_json)
                return None

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        config_data = b'{"setting": "test_value"}'
        request = hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest(
            new_config=hooks_lifecycle_pb2.ConfigJson(config_json=config_data),
        )
        await servicer.ConfigurationWillBeSaved(request, context)

        assert len(received) == 1
        assert received[0] == config_data
