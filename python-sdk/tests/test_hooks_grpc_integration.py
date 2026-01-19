# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Integration tests for hook servicer using real gRPC server.

These tests start an in-process gRPC server with the hook servicer registered
and use the generated stub to invoke methods, verifying end-to-end behavior.
"""

import asyncio
import pytest

import grpc
from grpc import aio as grpc_aio

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import (
    PluginHooksServicerImpl,
    DISMISS_POST_ERROR,
)
from mattermost_plugin.grpc import hooks_pb2_grpc
from mattermost_plugin.grpc import hooks_lifecycle_pb2
from mattermost_plugin.grpc import hooks_message_pb2
from mattermost_plugin.grpc import hooks_common_pb2
from mattermost_plugin.grpc import post_pb2


def make_test_post(message: str = "test message", post_id: str = "post123") -> post_pb2.Post:
    """Create a test Post protobuf message."""
    return post_pb2.Post(
        id=post_id,
        message=message,
        user_id="user123",
        channel_id="channel123",
    )


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


@pytest.fixture
def sample_plugin():
    """Create a sample plugin with various hooks implemented."""

    class SamplePlugin(Plugin):
        def __init__(self):
            super().__init__()
            self.activated = False
            self.deactivated = False
            self.config_changed = False
            self.received_posts = []

        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            self.activated = True

        @hook(HookName.OnDeactivate)
        def on_deactivate(self) -> None:
            self.deactivated = True

        @hook(HookName.OnConfigurationChange)
        def on_config_change(self) -> None:
            self.config_changed = True

        @hook(HookName.MessageWillBePosted)
        def filter_message(self, ctx, post):
            self.received_posts.append(post.message)
            if "spam" in post.message.lower():
                return None, "Spam detected"
            if "uppercase" in post.message.lower():
                modified = post_pb2.Post()
                modified.CopyFrom(post)
                modified.message = post.message.upper()
                return modified, ""
            return None, ""

        @hook(HookName.MessageHasBeenPosted)
        def on_message_posted(self, ctx, post) -> None:
            # Just track that we received it
            pass

    return SamplePlugin()


@pytest.fixture
async def grpc_server_and_stub(sample_plugin):
    """
    Create a gRPC server with hook servicer and return the stub.

    This fixture starts an async gRPC server on an ephemeral port
    and yields the stub for making RPC calls.
    """
    # Create server
    server = grpc_aio.server()

    # Register hook servicer
    servicer = PluginHooksServicerImpl(sample_plugin)
    hooks_pb2_grpc.add_PluginHooksServicer_to_server(servicer, server)

    # Bind to ephemeral port
    port = server.add_insecure_port("127.0.0.1:0")

    # Start server
    await server.start()

    # Create channel and stub
    channel = grpc_aio.insecure_channel(f"127.0.0.1:{port}")
    stub = hooks_pb2_grpc.PluginHooksStub(channel)

    yield stub, sample_plugin

    # Cleanup
    await channel.close()
    await server.stop(grace=0)


class TestGrpcImplemented:
    """Test Implemented RPC via gRPC."""

    @pytest.mark.asyncio
    async def test_returns_implemented_hooks(self, grpc_server_and_stub):
        """Test that Implemented returns the correct hook list."""
        stub, plugin = grpc_server_and_stub

        request = hooks_lifecycle_pb2.ImplementedRequest()
        response = await stub.Implemented(request)

        hooks = list(response.hooks)
        assert "OnActivate" in hooks
        assert "OnDeactivate" in hooks
        assert "OnConfigurationChange" in hooks
        assert "MessageWillBePosted" in hooks
        assert "MessageHasBeenPosted" in hooks


class TestGrpcLifecycleHooks:
    """Test lifecycle hooks via gRPC."""

    @pytest.mark.asyncio
    async def test_on_activate_success(self, grpc_server_and_stub):
        """Test successful activation via gRPC."""
        stub, plugin = grpc_server_and_stub

        request = hooks_lifecycle_pb2.OnActivateRequest()
        response = await stub.OnActivate(request)

        assert not response.HasField("error")
        assert plugin.activated is True

    @pytest.mark.asyncio
    async def test_on_deactivate_success(self, grpc_server_and_stub):
        """Test deactivation via gRPC."""
        stub, plugin = grpc_server_and_stub

        request = hooks_lifecycle_pb2.OnDeactivateRequest()
        response = await stub.OnDeactivate(request)

        # Response should succeed even if deactivate fails
        assert plugin.deactivated is True

    @pytest.mark.asyncio
    async def test_on_configuration_change_success(self, grpc_server_and_stub):
        """Test configuration change via gRPC."""
        stub, plugin = grpc_server_and_stub

        request = hooks_lifecycle_pb2.OnConfigurationChangeRequest()
        response = await stub.OnConfigurationChange(request)

        assert not response.HasField("error")
        assert plugin.config_changed is True


class TestGrpcMessageWillBePosted:
    """Test MessageWillBePosted hook via gRPC."""

    @pytest.mark.asyncio
    async def test_allow_post(self, grpc_server_and_stub):
        """Test allowing a post through."""
        stub, plugin = grpc_server_and_stub

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post("normal message"),
        )
        response = await stub.MessageWillBePosted(request)

        assert response.rejection_reason == ""
        assert not response.HasField("modified_post")
        assert "normal message" in plugin.received_posts

    @pytest.mark.asyncio
    async def test_reject_spam(self, grpc_server_and_stub):
        """Test rejecting spam posts."""
        stub, plugin = grpc_server_and_stub

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post("Buy spam now!"),
        )
        response = await stub.MessageWillBePosted(request)

        assert response.rejection_reason == "Spam detected"

    @pytest.mark.asyncio
    async def test_modify_post(self, grpc_server_and_stub):
        """Test modifying a post to uppercase."""
        stub, plugin = grpc_server_and_stub

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post("convert to uppercase please"),
        )
        response = await stub.MessageWillBePosted(request)

        assert response.rejection_reason == ""
        assert response.HasField("modified_post")
        assert response.modified_post.message == "CONVERT TO UPPERCASE PLEASE"


class TestGrpcMessageHasBeenPosted:
    """Test MessageHasBeenPosted notification via gRPC."""

    @pytest.mark.asyncio
    async def test_notification_succeeds(self, grpc_server_and_stub):
        """Test that notification hook responds successfully."""
        stub, plugin = grpc_server_and_stub

        request = hooks_message_pb2.MessageHasBeenPostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await stub.MessageHasBeenPosted(request)

        # Notification hooks always return empty response
        assert isinstance(response, hooks_message_pb2.MessageHasBeenPostedResponse)


class TestGrpcActivationFailure:
    """Test activation failure scenarios."""

    @pytest.mark.asyncio
    async def test_activation_failure_propagates(self):
        """Test that activation failure is returned in response."""

        class FailingPlugin(Plugin):
            @hook(HookName.OnActivate)
            def on_activate(self) -> None:
                raise RuntimeError("Database connection failed")

        plugin = FailingPlugin()

        # Create server
        server = grpc_aio.server()
        servicer = PluginHooksServicerImpl(plugin)
        hooks_pb2_grpc.add_PluginHooksServicer_to_server(servicer, server)
        port = server.add_insecure_port("127.0.0.1:0")
        await server.start()

        try:
            channel = grpc_aio.insecure_channel(f"127.0.0.1:{port}")
            stub = hooks_pb2_grpc.PluginHooksStub(channel)

            request = hooks_lifecycle_pb2.OnActivateRequest()
            response = await stub.OnActivate(request)

            assert response.HasField("error")
            # Error message should contain the exception info
            assert "error" in response.error.message.lower() or "Database" in response.error.message

            await channel.close()
        finally:
            await server.stop(grace=0)


class TestGrpcAsyncHandlers:
    """Test async hook handlers via gRPC."""

    @pytest.mark.asyncio
    async def test_async_activate_handler(self):
        """Test that async handlers work through gRPC."""

        class AsyncPlugin(Plugin):
            def __init__(self):
                super().__init__()
                self.activated = False

            @hook(HookName.OnActivate)
            async def on_activate(self) -> None:
                await asyncio.sleep(0.01)  # Simulate async work
                self.activated = True

        plugin = AsyncPlugin()

        server = grpc_aio.server()
        servicer = PluginHooksServicerImpl(plugin)
        hooks_pb2_grpc.add_PluginHooksServicer_to_server(servicer, server)
        port = server.add_insecure_port("127.0.0.1:0")
        await server.start()

        try:
            channel = grpc_aio.insecure_channel(f"127.0.0.1:{port}")
            stub = hooks_pb2_grpc.PluginHooksStub(channel)

            request = hooks_lifecycle_pb2.OnActivateRequest()
            response = await stub.OnActivate(request)

            assert not response.HasField("error")
            assert plugin.activated is True

            await channel.close()
        finally:
            await server.stop(grace=0)

    @pytest.mark.asyncio
    async def test_async_message_handler(self):
        """Test async message handler through gRPC."""

        class AsyncMessagePlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            async def filter(self, ctx, post):
                await asyncio.sleep(0.01)  # Simulate async work
                modified = post_pb2.Post()
                modified.CopyFrom(post)
                modified.message = "async: " + post.message
                return modified, ""

        plugin = AsyncMessagePlugin()

        server = grpc_aio.server()
        servicer = PluginHooksServicerImpl(plugin)
        hooks_pb2_grpc.add_PluginHooksServicer_to_server(servicer, server)
        port = server.add_insecure_port("127.0.0.1:0")
        await server.start()

        try:
            channel = grpc_aio.insecure_channel(f"127.0.0.1:{port}")
            stub = hooks_pb2_grpc.PluginHooksStub(channel)

            request = hooks_message_pb2.MessageWillBePostedRequest(
                plugin_context=make_plugin_context(),
                post=make_test_post("hello"),
            )
            response = await stub.MessageWillBePosted(request)

            assert response.modified_post.message == "async: hello"

            await channel.close()
        finally:
            await server.stop(grace=0)
