# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Smoke tests to verify that generated Protocol Buffer code imports correctly.

These tests verify that:
1. All generated protobuf modules can be imported
2. Key message types and services are accessible
3. Import dependencies (between proto files) are working
"""

import pytest


class TestCodegenImports:
    """Tests for verifying generated code imports."""

    def test_import_common_pb2(self) -> None:
        """Test that common_pb2 (common types) can be imported."""
        from mattermost_plugin.grpc import common_pb2

        # Verify key types exist
        assert hasattr(common_pb2, "AppError")
        assert hasattr(common_pb2, "RequestContext")
        assert hasattr(common_pb2, "StringMap")

    def test_import_api_pb2(self) -> None:
        """Test that api_pb2 (API imports) can be imported."""
        from mattermost_plugin.grpc import api_pb2

        # api.proto imports other proto files
        assert api_pb2 is not None

    def test_import_api_pb2_grpc(self) -> None:
        """Test that api_pb2_grpc (gRPC service stubs) can be imported."""
        from mattermost_plugin.grpc import api_pb2_grpc

        # Verify service stub exists
        assert hasattr(api_pb2_grpc, "PluginAPIStub")
        assert hasattr(api_pb2_grpc, "PluginAPIServicer")

    def test_import_api_remaining_pb2(self) -> None:
        """Test that api_remaining_pb2 can be imported."""
        from mattermost_plugin.grpc import api_remaining_pb2

        # Verify key message types exist
        assert hasattr(api_remaining_pb2, "GetServerVersionRequest")
        assert hasattr(api_remaining_pb2, "GetServerVersionResponse")

    def test_import_api_user_team_pb2(self) -> None:
        """Test that api_user_team_pb2 can be imported."""
        from mattermost_plugin.grpc import api_user_team_pb2

        # Verify key message types exist
        assert hasattr(api_user_team_pb2, "CreateUserRequest")
        assert hasattr(api_user_team_pb2, "GetUserRequest")

    def test_import_api_channel_post_pb2(self) -> None:
        """Test that api_channel_post_pb2 can be imported."""
        from mattermost_plugin.grpc import api_channel_post_pb2

        assert hasattr(api_channel_post_pb2, "CreateChannelRequest")
        assert hasattr(api_channel_post_pb2, "CreatePostRequest")

    def test_import_api_kv_config_pb2(self) -> None:
        """Test that api_kv_config_pb2 can be imported."""
        from mattermost_plugin.grpc import api_kv_config_pb2

        assert hasattr(api_kv_config_pb2, "KVSetRequest")
        assert hasattr(api_kv_config_pb2, "KVGetRequest")
        assert hasattr(api_kv_config_pb2, "LogDebugRequest")

    def test_import_api_file_bot_pb2(self) -> None:
        """Test that api_file_bot_pb2 can be imported."""
        from mattermost_plugin.grpc import api_file_bot_pb2

        assert hasattr(api_file_bot_pb2, "GetFileRequest")
        assert hasattr(api_file_bot_pb2, "CreateBotRequest")

    def test_import_hooks_pb2(self) -> None:
        """Test that hooks_pb2 can be imported."""
        from mattermost_plugin.grpc import hooks_pb2

        assert hooks_pb2 is not None

    def test_import_hooks_pb2_grpc(self) -> None:
        """Test that hooks_pb2_grpc (hook service stubs) can be imported."""
        from mattermost_plugin.grpc import hooks_pb2_grpc

        # Verify service exists
        assert hasattr(hooks_pb2_grpc, "PluginHooksStub")
        assert hasattr(hooks_pb2_grpc, "PluginHooksServicer")

    def test_import_user_pb2(self) -> None:
        """Test that user_pb2 (User message) can be imported."""
        from mattermost_plugin.grpc import user_pb2

        assert hasattr(user_pb2, "User")

    def test_import_channel_pb2(self) -> None:
        """Test that channel_pb2 (Channel message) can be imported."""
        from mattermost_plugin.grpc import channel_pb2

        assert hasattr(channel_pb2, "Channel")

    def test_import_post_pb2(self) -> None:
        """Test that post_pb2 (Post message) can be imported."""
        from mattermost_plugin.grpc import post_pb2

        assert hasattr(post_pb2, "Post")

    def test_import_team_pb2(self) -> None:
        """Test that team_pb2 (Team message) can be imported."""
        from mattermost_plugin.grpc import team_pb2

        assert hasattr(team_pb2, "Team")

    def test_import_file_pb2(self) -> None:
        """Test that file_pb2 (FileInfo message) can be imported."""
        from mattermost_plugin.grpc import file_pb2

        assert hasattr(file_pb2, "FileInfo")


class TestMessageCreation:
    """Tests for verifying message instantiation works."""

    def test_create_app_error(self) -> None:
        """Test that AppError message can be created."""
        from mattermost_plugin.grpc import common_pb2

        error = common_pb2.AppError(
            id="api.user.get.not_found.app_error",
            message="User not found",
            status_code=404,
        )

        assert error.id == "api.user.get.not_found.app_error"
        assert error.message == "User not found"
        assert error.status_code == 404

    def test_create_request_context(self) -> None:
        """Test that RequestContext message can be created."""
        from mattermost_plugin.grpc import common_pb2

        ctx = common_pb2.RequestContext(
            plugin_id="com.example.plugin",
            request_id="req-123",
            user_id="user-456",
        )

        assert ctx.plugin_id == "com.example.plugin"
        assert ctx.request_id == "req-123"
        assert ctx.user_id == "user-456"

    def test_create_get_server_version_request(self) -> None:
        """Test that GetServerVersionRequest can be created."""
        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetServerVersionRequest()
        assert request is not None

    def test_create_user_message(self) -> None:
        """Test that User message can be created with fields."""
        from mattermost_plugin.grpc import user_pb2

        user = user_pb2.User(
            id="user-123",
            username="testuser",
            email="test@example.com",
        )

        assert user.id == "user-123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"


class TestPublicAPIImports:
    """Tests for verifying public API imports work."""

    def test_import_plugin_api_client(self) -> None:
        """Test that PluginAPIClient can be imported from public API."""
        from mattermost_plugin import PluginAPIClient

        assert PluginAPIClient is not None

    def test_import_async_plugin_api_client(self) -> None:
        """Test that AsyncPluginAPIClient can be imported from public API."""
        from mattermost_plugin import AsyncPluginAPIClient

        assert AsyncPluginAPIClient is not None

    def test_import_exceptions(self) -> None:
        """Test that exceptions can be imported from public API."""
        from mattermost_plugin import (
            PluginAPIError,
            NotFoundError,
            PermissionDeniedError,
            ValidationError,
            AlreadyExistsError,
            UnavailableError,
        )

        assert PluginAPIError is not None
        assert NotFoundError is not None
        assert PermissionDeniedError is not None
        assert ValidationError is not None
        assert AlreadyExistsError is not None
        assert UnavailableError is not None

    def test_import_convert_grpc_error(self) -> None:
        """Test that convert_grpc_error can be imported."""
        from mattermost_plugin import convert_grpc_error

        assert callable(convert_grpc_error)

    def test_import_version(self) -> None:
        """Test that __version__ is available."""
        from mattermost_plugin import __version__

        assert __version__ == "0.1.0"
