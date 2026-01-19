# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
End-to-end integration tests for Python SDK gRPC communication.

These tests verify:
1. API round-trip: SDK client connects to gRPC server, calls API, receives response
2. Hook invocation chain: Hooks are registered and receive invocations
3. Error propagation: Server errors are properly converted to Python exceptions
4. Streaming HTTP: ServeHTTP request/response streaming (if practical)
"""

from concurrent import futures
from typing import Iterator, Any
import threading
import time

import pytest
import grpc

from mattermost_plugin import (
    Plugin,
    PluginAPIClient,
    PluginAPIError,
    NotFoundError,
    PermissionDeniedError,
    hook,
    HookName,
)
from mattermost_plugin.grpc import (
    api_pb2_grpc,
    api_remaining_pb2,
    api_user_team_pb2,
    api_channel_post_pb2,
    common_pb2,
    user_pb2,
    post_pb2,
    channel_pb2,
    hooks_pb2_grpc,
    hooks_lifecycle_pb2,
    hooks_message_pb2,
    hooks_common_pb2,
)
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl


# =============================================================================
# Fake gRPC Server for API Testing
# =============================================================================


class FakePluginAPIServicer(api_pb2_grpc.PluginAPIServicer):
    """Fake gRPC server that simulates the Mattermost API server."""

    def __init__(self) -> None:
        self.server_version = "9.5.0-integration-test"
        self.install_date = 1704067200000  # Jan 1, 2024
        self.diagnostic_id = "integration-test-diagnostic-id"

        # Track calls for verification
        self.calls: list[str] = []

        # Configurable responses
        self._users: dict[str, user_pb2.User] = {}
        self._posts: dict[str, post_pb2.Post] = {}
        self._channels: dict[str, channel_pb2.Channel] = {}

        # Error configuration
        self._should_fail_with_code: grpc.StatusCode | None = None
        self._fail_message = ""
        self._should_return_app_error: common_pb2.AppError | None = None

    def set_user(self, user_id: str, username: str, email: str) -> None:
        """Add a user to the fake database."""
        self._users[user_id] = user_pb2.User(
            id=user_id,
            username=username,
            email=email,
            create_at=1704067200000,
        )

    def set_post(self, post_id: str, message: str, user_id: str, channel_id: str) -> None:
        """Add a post to the fake database."""
        self._posts[post_id] = post_pb2.Post(
            id=post_id,
            message=message,
            user_id=user_id,
            channel_id=channel_id,
            create_at=1704067200000,
        )

    def set_channel(self, channel_id: str, name: str, team_id: str) -> None:
        """Add a channel to the fake database."""
        self._channels[channel_id] = channel_pb2.Channel(
            id=channel_id,
            name=name,
            team_id=team_id,
            create_at=1704067200000,
        )

    def configure_failure(
        self,
        code: grpc.StatusCode,
        message: str = "",
    ) -> None:
        """Configure the server to fail with a gRPC error."""
        self._should_fail_with_code = code
        self._fail_message = message

    def configure_app_error(self, error_id: str, message: str, status_code: int) -> None:
        """Configure the server to return an AppError in response."""
        self._should_return_app_error = common_pb2.AppError(
            id=error_id,
            message=message,
            status_code=status_code,
        )

    def reset_failure(self) -> None:
        """Reset failure configuration."""
        self._should_fail_with_code = None
        self._fail_message = ""
        self._should_return_app_error = None

    def _check_failure(self, context: grpc.ServicerContext) -> bool:
        """Check if configured to fail, and abort if so. Returns True if failed."""
        if self._should_fail_with_code is not None:
            context.abort(self._should_fail_with_code, self._fail_message)
            return True
        return False

    # Remaining API methods
    def GetServerVersion(
        self,
        request: api_remaining_pb2.GetServerVersionRequest,
        context: grpc.ServicerContext,
    ) -> api_remaining_pb2.GetServerVersionResponse:
        self.calls.append("GetServerVersion")
        if self._check_failure(context):
            return api_remaining_pb2.GetServerVersionResponse()
        if self._should_return_app_error:
            return api_remaining_pb2.GetServerVersionResponse(error=self._should_return_app_error)
        return api_remaining_pb2.GetServerVersionResponse(version=self.server_version)

    def GetSystemInstallDate(
        self,
        request: api_remaining_pb2.GetSystemInstallDateRequest,
        context: grpc.ServicerContext,
    ) -> api_remaining_pb2.GetSystemInstallDateResponse:
        self.calls.append("GetSystemInstallDate")
        if self._check_failure(context):
            return api_remaining_pb2.GetSystemInstallDateResponse()
        return api_remaining_pb2.GetSystemInstallDateResponse(install_date=self.install_date)

    def GetDiagnosticId(
        self,
        request: api_remaining_pb2.GetDiagnosticIdRequest,
        context: grpc.ServicerContext,
    ) -> api_remaining_pb2.GetDiagnosticIdResponse:
        self.calls.append("GetDiagnosticId")
        if self._check_failure(context):
            return api_remaining_pb2.GetDiagnosticIdResponse()
        return api_remaining_pb2.GetDiagnosticIdResponse(diagnostic_id=self.diagnostic_id)

    # User API methods
    def GetUser(
        self,
        request: api_user_team_pb2.GetUserRequest,
        context: grpc.ServicerContext,
    ) -> api_user_team_pb2.GetUserResponse:
        self.calls.append(f"GetUser({request.user_id})")
        if self._check_failure(context):
            return api_user_team_pb2.GetUserResponse()
        if request.user_id not in self._users:
            context.abort(grpc.StatusCode.NOT_FOUND, f"User {request.user_id} not found")
            return api_user_team_pb2.GetUserResponse()
        return api_user_team_pb2.GetUserResponse(user=self._users[request.user_id])

    def GetUserByEmail(
        self,
        request: api_user_team_pb2.GetUserByEmailRequest,
        context: grpc.ServicerContext,
    ) -> api_user_team_pb2.GetUserByEmailResponse:
        self.calls.append(f"GetUserByEmail({request.email})")
        if self._check_failure(context):
            return api_user_team_pb2.GetUserByEmailResponse()
        for user in self._users.values():
            if user.email == request.email:
                return api_user_team_pb2.GetUserByEmailResponse(user=user)
        context.abort(grpc.StatusCode.NOT_FOUND, f"User with email {request.email} not found")
        return api_user_team_pb2.GetUserByEmailResponse()

    # Post API methods
    def GetPost(
        self,
        request: api_channel_post_pb2.GetPostRequest,
        context: grpc.ServicerContext,
    ) -> api_channel_post_pb2.GetPostResponse:
        self.calls.append(f"GetPost({request.post_id})")
        if self._check_failure(context):
            return api_channel_post_pb2.GetPostResponse()
        if request.post_id not in self._posts:
            context.abort(grpc.StatusCode.NOT_FOUND, f"Post {request.post_id} not found")
            return api_channel_post_pb2.GetPostResponse()
        return api_channel_post_pb2.GetPostResponse(post=self._posts[request.post_id])

    def CreatePost(
        self,
        request: api_channel_post_pb2.CreatePostRequest,
        context: grpc.ServicerContext,
    ) -> api_channel_post_pb2.CreatePostResponse:
        self.calls.append(f"CreatePost({request.post.channel_id})")
        if self._check_failure(context):
            return api_channel_post_pb2.CreatePostResponse()

        # Create post with ID
        post = post_pb2.Post()
        post.CopyFrom(request.post)
        post.id = f"post-{len(self._posts)}"
        post.create_at = 1704067200000
        self._posts[post.id] = post
        return api_channel_post_pb2.CreatePostResponse(post=post)


@pytest.fixture
def fake_api_server() -> Iterator[tuple[str, FakePluginAPIServicer]]:
    """Start a fake gRPC API server and yield its address."""
    servicer = FakePluginAPIServicer()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    api_pb2_grpc.add_PluginAPIServicer_to_server(servicer, server)

    # Use port 0 to get a free port
    port = server.add_insecure_port("[::]:0")
    server.start()

    target = f"localhost:{port}"

    try:
        yield target, servicer
    finally:
        server.stop(grace=0.5)


# =============================================================================
# Integration Test: API Round-trip
# =============================================================================


@pytest.mark.integration
class TestAPIRoundTrip:
    """Test that SDK client correctly communicates with gRPC server."""

    def test_get_server_version_round_trip(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test complete round-trip for GetServerVersion."""
        target, servicer = fake_api_server
        servicer.server_version = "10.0.0-e2e-test"

        with PluginAPIClient(target=target) as client:
            version = client.get_server_version()

        assert version == "10.0.0-e2e-test"
        assert "GetServerVersion" in servicer.calls

    def test_get_system_install_date_round_trip(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test complete round-trip for GetSystemInstallDate."""
        target, servicer = fake_api_server
        servicer.install_date = 1609459200000  # Jan 1, 2021

        with PluginAPIClient(target=target) as client:
            install_date = client.get_system_install_date()

        assert install_date == 1609459200000
        assert "GetSystemInstallDate" in servicer.calls

    def test_get_user_round_trip(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test complete round-trip for GetUser."""
        target, servicer = fake_api_server
        servicer.set_user("user123", "testuser", "test@example.com")

        with PluginAPIClient(target=target) as client:
            user = client.get_user("user123")

        assert user is not None
        assert user.id == "user123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert "GetUser(user123)" in servicer.calls

    def test_multiple_api_calls_in_sequence(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test multiple API calls in a single session."""
        target, servicer = fake_api_server
        servicer.set_user("user1", "alice", "alice@example.com")
        servicer.set_user("user2", "bob", "bob@example.com")

        with PluginAPIClient(target=target) as client:
            # Call multiple methods
            version = client.get_server_version()
            user1 = client.get_user("user1")
            user2 = client.get_user("user2")
            diagnostic_id = client.get_diagnostic_id()

        assert version == servicer.server_version
        assert user1.username == "alice"
        assert user2.username == "bob"
        assert diagnostic_id == servicer.diagnostic_id
        assert len(servicer.calls) == 4


# =============================================================================
# Integration Test: Error Propagation
# =============================================================================


@pytest.mark.integration
class TestErrorPropagation:
    """Test that server errors are properly converted to Python exceptions."""

    def test_not_found_error(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that NOT_FOUND status maps to NotFoundError."""
        target, servicer = fake_api_server

        with PluginAPIClient(target=target) as client:
            with pytest.raises(NotFoundError) as exc_info:
                client.get_user("nonexistent-user")

        assert "not found" in str(exc_info.value).lower()
        assert exc_info.value.code == grpc.StatusCode.NOT_FOUND

    def test_permission_denied_error(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that PERMISSION_DENIED status maps to PermissionDeniedError."""
        target, servicer = fake_api_server
        servicer.configure_failure(grpc.StatusCode.PERMISSION_DENIED, "Access denied")

        with PluginAPIClient(target=target) as client:
            with pytest.raises(PermissionDeniedError) as exc_info:
                client.get_server_version()

        assert "Access denied" in str(exc_info.value)
        assert exc_info.value.code == grpc.StatusCode.PERMISSION_DENIED

    def test_app_error_in_response(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that AppError in response is converted to SDK exception."""
        target, servicer = fake_api_server
        servicer.configure_app_error(
            error_id="api.test.custom_error",
            message="Custom error from server",
            status_code=400,
        )

        with PluginAPIClient(target=target) as client:
            with pytest.raises(PluginAPIError) as exc_info:
                client.get_server_version()

        assert exc_info.value.error_id == "api.test.custom_error"
        assert exc_info.value.message == "Custom error from server"
        assert exc_info.value.status_code == 400

    def test_error_recovery(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that client can recover after an error."""
        target, servicer = fake_api_server

        with PluginAPIClient(target=target) as client:
            # First call fails
            servicer.configure_failure(grpc.StatusCode.UNAVAILABLE, "Service unavailable")
            with pytest.raises(PluginAPIError):
                client.get_server_version()

            # Reset and second call succeeds
            servicer.reset_failure()
            version = client.get_server_version()
            assert version == servicer.server_version


# =============================================================================
# Integration Test: Hook Invocation Chain
# =============================================================================


@pytest.fixture
def integration_plugin():
    """Create a plugin for integration testing."""

    class IntegrationTestPlugin(Plugin):
        def __init__(self):
            super().__init__()
            self.activated = False
            self.deactivated = False
            self.config_changed = False
            self.received_posts: list[str] = []
            self.rejected_posts: list[str] = []

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
                self.rejected_posts.append(post.message)
                return None, "Spam detected by integration test"
            if "modify" in post.message.lower():
                modified = post_pb2.Post()
                modified.CopyFrom(post)
                modified.message = "[MODIFIED] " + post.message
                return modified, ""
            return None, ""

    return IntegrationTestPlugin()


@pytest.fixture
async def hooks_server(integration_plugin):
    """Start an async gRPC server with the plugin's hook servicer."""
    from grpc import aio as grpc_aio

    # Use async server to match the async servicer implementation
    server = grpc_aio.server()
    servicer = PluginHooksServicerImpl(integration_plugin)
    hooks_pb2_grpc.add_PluginHooksServicer_to_server(servicer, server)

    port = server.add_insecure_port("[::]:0")
    await server.start()

    target = f"localhost:{port}"
    channel = grpc_aio.insecure_channel(target)
    stub = hooks_pb2_grpc.PluginHooksStub(channel)

    try:
        yield stub, integration_plugin
    finally:
        await channel.close()
        await server.stop(grace=0.5)


@pytest.mark.integration
class TestHookInvocationChain:
    """Test that hooks are properly invoked via gRPC."""

    @pytest.mark.asyncio
    async def test_implemented_returns_hooks(self, hooks_server) -> None:
        """Test that Implemented RPC returns registered hooks."""
        stub, plugin = hooks_server

        response = await stub.Implemented(hooks_lifecycle_pb2.ImplementedRequest())
        hooks = list(response.hooks)

        assert "OnActivate" in hooks
        assert "OnDeactivate" in hooks
        assert "OnConfigurationChange" in hooks
        assert "MessageWillBePosted" in hooks

    @pytest.mark.asyncio
    async def test_lifecycle_hooks_invocation(self, hooks_server) -> None:
        """Test lifecycle hook invocation chain."""
        stub, plugin = hooks_server

        # OnConfigurationChange
        await stub.OnConfigurationChange(hooks_lifecycle_pb2.OnConfigurationChangeRequest())
        assert plugin.config_changed is True

        # OnActivate
        await stub.OnActivate(hooks_lifecycle_pb2.OnActivateRequest())
        assert plugin.activated is True

        # OnDeactivate
        await stub.OnDeactivate(hooks_lifecycle_pb2.OnDeactivateRequest())
        assert plugin.deactivated is True

    @pytest.mark.asyncio
    async def test_message_hook_allows_post(self, hooks_server) -> None:
        """Test that normal messages pass through."""
        stub, plugin = hooks_server

        response = await stub.MessageWillBePosted(
            hooks_message_pb2.MessageWillBePostedRequest(
                plugin_context=hooks_common_pb2.PluginContext(
                    session_id="sess1",
                    request_id="req1",
                ),
                post=post_pb2.Post(
                    id="post1",
                    message="Hello from integration test",
                    user_id="user1",
                    channel_id="chan1",
                ),
            )
        )

        assert response.rejection_reason == ""
        assert not response.HasField("modified_post")
        assert "Hello from integration test" in plugin.received_posts

    @pytest.mark.asyncio
    async def test_message_hook_rejects_spam(self, hooks_server) -> None:
        """Test that spam messages are rejected."""
        stub, plugin = hooks_server

        response = await stub.MessageWillBePosted(
            hooks_message_pb2.MessageWillBePostedRequest(
                plugin_context=hooks_common_pb2.PluginContext(
                    session_id="sess2",
                    request_id="req2",
                ),
                post=post_pb2.Post(
                    id="post2",
                    message="Buy SPAM now!",
                    user_id="user2",
                    channel_id="chan2",
                ),
            )
        )

        assert response.rejection_reason == "Spam detected by integration test"
        assert "Buy SPAM now!" in plugin.rejected_posts

    @pytest.mark.asyncio
    async def test_message_hook_modifies_post(self, hooks_server) -> None:
        """Test that messages can be modified."""
        stub, plugin = hooks_server

        response = await stub.MessageWillBePosted(
            hooks_message_pb2.MessageWillBePostedRequest(
                plugin_context=hooks_common_pb2.PluginContext(
                    session_id="sess3",
                    request_id="req3",
                ),
                post=post_pb2.Post(
                    id="post3",
                    message="Please modify this message",
                    user_id="user3",
                    channel_id="chan3",
                ),
            )
        )

        assert response.rejection_reason == ""
        assert response.HasField("modified_post")
        assert response.modified_post.message == "[MODIFIED] Please modify this message"


# =============================================================================
# Integration Test: Complex Scenarios
# =============================================================================


@pytest.mark.integration
class TestComplexScenarios:
    """Test complex integration scenarios."""

    def test_concurrent_api_calls(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test concurrent API calls from multiple threads."""
        target, servicer = fake_api_server
        servicer.set_user("user1", "alice", "alice@example.com")

        errors: list[Exception] = []
        results: list[str] = []
        lock = threading.Lock()

        def make_call(call_id: int) -> None:
            try:
                with PluginAPIClient(target=target) as client:
                    version = client.get_server_version()
                    with lock:
                        results.append(f"{call_id}:{version}")
            except Exception as e:
                with lock:
                    errors.append(e)

        # Start 10 concurrent calls
        threads = [threading.Thread(target=make_call, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Got errors: {errors}"
        assert len(results) == 10

    def test_sequential_connect_disconnect(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that client can connect and disconnect multiple times."""
        target, servicer = fake_api_server

        for i in range(5):
            with PluginAPIClient(target=target) as client:
                version = client.get_server_version()
                assert version == servicer.server_version

        # All calls should have been tracked
        assert servicer.calls.count("GetServerVersion") == 5

    @pytest.mark.asyncio
    async def test_large_message_handling(self, hooks_server) -> None:
        """Test handling of large messages."""
        stub, plugin = hooks_server

        # Create a large message (100KB)
        large_message = "x" * 100000

        response = await stub.MessageWillBePosted(
            hooks_message_pb2.MessageWillBePostedRequest(
                plugin_context=hooks_common_pb2.PluginContext(
                    session_id="sess-large",
                    request_id="req-large",
                ),
                post=post_pb2.Post(
                    id="post-large",
                    message=large_message,
                    user_id="user-large",
                    channel_id="chan-large",
                ),
            )
        )

        assert response.rejection_reason == ""
        assert large_message in plugin.received_posts


# =============================================================================
# Smoke Test (Always Run)
# =============================================================================


class TestSmokeTest:
    """Basic smoke tests that verify test infrastructure works."""

    def test_can_create_client(self, fake_api_server: tuple[str, FakePluginAPIServicer]) -> None:
        """Test that we can create and use a client."""
        target, _ = fake_api_server

        client = PluginAPIClient(target=target)
        assert client.target == target
        assert not client.connected

        with client:
            assert client.connected

        assert not client.connected

    def test_fake_server_responds(
        self, fake_api_server: tuple[str, FakePluginAPIServicer]
    ) -> None:
        """Test that fake server responds to requests."""
        target, servicer = fake_api_server

        with PluginAPIClient(target=target) as client:
            version = client.get_server_version()

        assert version == servicer.server_version
