# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for message hook implementations in the hook servicer.

Tests verify:
- MessageWillBePosted semantics: allow/reject/modify/dismiss
- MessageWillBeUpdated semantics: allow/reject/modify
- Notification hooks: MessageHasBeenPosted/Updated/Deleted
- MessagesWillBeConsumed list processing
"""

import pytest
from unittest.mock import MagicMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import (
    PluginHooksServicerImpl,
    DISMISS_POST_ERROR,
)
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


class TestMessageWillBePosted:
    """Tests for MessageWillBePosted hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that post is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageWillBePosted(request, context)

        # Not implemented = allow unchanged
        assert not response.HasField("modified_post")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_allow_unchanged(self) -> None:
        """Test allowing post unchanged by returning (None, '')."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                return None, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageWillBePosted(request, context)

        assert not response.HasField("modified_post")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_reject_with_reason(self) -> None:
        """Test rejecting post by returning (None, 'reason')."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                return None, "Message contains spam"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post("Buy cheap stuff now!"),
        )
        response = await servicer.MessageWillBePosted(request, context)

        assert not response.HasField("modified_post")
        assert response.rejection_reason == "Message contains spam"

    @pytest.mark.asyncio
    async def test_modify_post(self) -> None:
        """Test modifying post by returning (modified_post, '')."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                # Create modified post
                modified = post_pb2.Post()
                modified.CopyFrom(post)
                modified.message = post.message.upper()
                return modified, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post("hello world"),
        )
        response = await servicer.MessageWillBePosted(request, context)

        assert response.HasField("modified_post")
        assert response.modified_post.message == "HELLO WORLD"
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_dismiss_post(self) -> None:
        """Test dismissing post silently using DISMISS_POST_ERROR."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                return None, DISMISS_POST_ERROR

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageWillBePosted(request, context)

        assert not response.HasField("modified_post")
        assert response.rejection_reason == DISMISS_POST_ERROR

    @pytest.mark.asyncio
    async def test_handler_exception_rejects_post(self) -> None:
        """Test that handler exceptions result in rejection."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                raise ValueError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageWillBePosted(request, context)

        # Exception = rejection with error message
        assert "Plugin error" in response.rejection_reason or "error" in response.rejection_reason.lower()

    @pytest.mark.asyncio
    async def test_receives_post_and_context(self) -> None:
        """Test that handler receives post and context."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter(self, ctx, post):
                received.append((ctx, post))
                return None, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        plugin_ctx = make_plugin_context()
        post = make_test_post("test message")
        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=plugin_ctx,
            post=post,
        )
        await servicer.MessageWillBePosted(request, context)

        assert len(received) == 1
        ctx_received, post_received = received[0]
        assert ctx_received.session_id == "session123"
        assert post_received.message == "test message"

    @pytest.mark.asyncio
    async def test_async_handler_works(self) -> None:
        """Test that async handlers work correctly."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            async def filter(self, ctx, post):
                modified = post_pb2.Post()
                modified.CopyFrom(post)
                modified.message = "async modified"
                return modified, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBePostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageWillBePosted(request, context)

        assert response.modified_post.message == "async modified"


class TestMessageWillBeUpdated:
    """Tests for MessageWillBeUpdated hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that update is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBeUpdatedRequest(
            plugin_context=make_plugin_context(),
            new_post=make_test_post("new message"),
            old_post=make_test_post("old message"),
        )
        response = await servicer.MessageWillBeUpdated(request, context)

        assert not response.HasField("modified_post")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_receives_old_and_new_post(self) -> None:
        """Test that handler receives both old and new posts."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBeUpdated)
            def filter(self, ctx, new_post, old_post):
                received.append((new_post.message, old_post.message))
                return None, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBeUpdatedRequest(
            plugin_context=make_plugin_context(),
            new_post=make_test_post("updated text"),
            old_post=make_test_post("original text"),
        )
        await servicer.MessageWillBeUpdated(request, context)

        assert len(received) == 1
        assert received[0] == ("updated text", "original text")

    @pytest.mark.asyncio
    async def test_reject_update(self) -> None:
        """Test rejecting an update."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBeUpdated)
            def filter(self, ctx, new_post, old_post):
                return None, "Updates not allowed"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageWillBeUpdatedRequest(
            plugin_context=make_plugin_context(),
            new_post=make_test_post("new"),
            old_post=make_test_post("old"),
        )
        response = await servicer.MessageWillBeUpdated(request, context)

        assert response.rejection_reason == "Updates not allowed"


class TestMessageHasBeenPosted:
    """Tests for MessageHasBeenPosted notification hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test notification succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageHasBeenPostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        response = await servicer.MessageHasBeenPosted(request, context)

        # Response is always empty for notification hooks
        assert isinstance(response, hooks_message_pb2.MessageHasBeenPostedResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that notification handler is called."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.MessageHasBeenPosted)
            def on_post(self, ctx, post):
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageHasBeenPostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        await servicer.MessageHasBeenPosted(request, context)

        assert call_count[0] == 1

    @pytest.mark.asyncio
    async def test_exception_doesnt_fail_response(self) -> None:
        """Test that handler exceptions don't prevent response."""

        class TestPlugin(Plugin):
            @hook(HookName.MessageHasBeenPosted)
            def on_post(self, ctx, post):
                raise RuntimeError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageHasBeenPostedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(),
        )
        # Should not raise - errors are logged but response succeeds
        response = await servicer.MessageHasBeenPosted(request, context)
        assert isinstance(response, hooks_message_pb2.MessageHasBeenPostedResponse)


class TestMessageHasBeenUpdated:
    """Tests for MessageHasBeenUpdated notification hook."""

    @pytest.mark.asyncio
    async def test_receives_old_and_new_post(self) -> None:
        """Test that handler receives both posts."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.MessageHasBeenUpdated)
            def on_update(self, ctx, new_post, old_post):
                received.append((new_post.message, old_post.message))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageHasBeenUpdatedRequest(
            plugin_context=make_plugin_context(),
            new_post=make_test_post("new"),
            old_post=make_test_post("old"),
        )
        await servicer.MessageHasBeenUpdated(request, context)

        assert len(received) == 1
        assert received[0] == ("new", "old")


class TestMessageHasBeenDeleted:
    """Tests for MessageHasBeenDeleted notification hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that deletion handler is called."""
        deleted_posts = []

        class TestPlugin(Plugin):
            @hook(HookName.MessageHasBeenDeleted)
            def on_delete(self, ctx, post):
                deleted_posts.append(post.id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.MessageHasBeenDeletedRequest(
            plugin_context=make_plugin_context(),
            post=make_test_post(post_id="deleted123"),
        )
        await servicer.MessageHasBeenDeleted(request, context)

        assert "deleted123" in deleted_posts


class TestMessagesWillBeConsumed:
    """Tests for MessagesWillBeConsumed hook."""

    @pytest.mark.asyncio
    async def test_returns_original_when_not_implemented(self) -> None:
        """Test that original posts are returned when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        posts = [
            make_test_post("post 1", "id1"),
            make_test_post("post 2", "id2"),
        ]
        request = hooks_message_pb2.MessagesWillBeConsumedRequest(posts=posts)
        response = await servicer.MessagesWillBeConsumed(request, context)

        assert len(response.posts) == 2
        messages = [p.message for p in response.posts]
        assert "post 1" in messages
        assert "post 2" in messages

    @pytest.mark.asyncio
    async def test_can_filter_posts(self) -> None:
        """Test that handler can filter posts from the list."""

        class TestPlugin(Plugin):
            @hook(HookName.MessagesWillBeConsumed)
            def filter_posts(self, posts):
                # Filter out posts with "secret" in message
                return [p for p in posts if "secret" not in p.message.lower()]

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        posts = [
            make_test_post("public message", "id1"),
            make_test_post("secret info", "id2"),
            make_test_post("another public", "id3"),
        ]
        request = hooks_message_pb2.MessagesWillBeConsumedRequest(posts=posts)
        response = await servicer.MessagesWillBeConsumed(request, context)

        assert len(response.posts) == 2
        messages = [p.message for p in response.posts]
        assert "public message" in messages
        assert "another public" in messages
        assert "secret info" not in messages

    @pytest.mark.asyncio
    async def test_can_modify_posts(self) -> None:
        """Test that handler can modify posts."""

        class TestPlugin(Plugin):
            @hook(HookName.MessagesWillBeConsumed)
            def modify_posts(self, posts):
                result = []
                for p in posts:
                    modified = post_pb2.Post()
                    modified.CopyFrom(p)
                    modified.message = "[REDACTED]" if "password" in p.message else p.message
                    result.append(modified)
                return result

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        posts = [
            make_test_post("my password is 123", "id1"),
            make_test_post("regular message", "id2"),
        ]
        request = hooks_message_pb2.MessagesWillBeConsumedRequest(posts=posts)
        response = await servicer.MessagesWillBeConsumed(request, context)

        messages = [p.message for p in response.posts]
        assert "[REDACTED]" in messages
        assert "regular message" in messages

    @pytest.mark.asyncio
    async def test_returns_original_on_error(self) -> None:
        """Test that original posts are returned on handler error."""

        class TestPlugin(Plugin):
            @hook(HookName.MessagesWillBeConsumed)
            def filter_posts(self, posts):
                raise RuntimeError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        posts = [make_test_post("test", "id1")]
        request = hooks_message_pb2.MessagesWillBeConsumedRequest(posts=posts)
        response = await servicer.MessagesWillBeConsumed(request, context)

        # Should return original posts on error
        assert len(response.posts) == 1
        assert response.posts[0].message == "test"

    @pytest.mark.asyncio
    async def test_returns_original_when_handler_returns_none(self) -> None:
        """Test that original posts are returned if handler returns None."""

        class TestPlugin(Plugin):
            @hook(HookName.MessagesWillBeConsumed)
            def filter_posts(self, posts):
                return None

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        posts = [make_test_post("test", "id1")]
        request = hooks_message_pb2.MessagesWillBeConsumedRequest(posts=posts)
        response = await servicer.MessagesWillBeConsumed(request, context)

        assert len(response.posts) == 1


class TestDismissPostErrorConstant:
    """Tests for DISMISS_POST_ERROR constant."""

    def test_constant_matches_go_value(self) -> None:
        """Test that DISMISS_POST_ERROR matches the Go constant."""
        # This value must match server/public/plugin/hooks.go
        assert DISMISS_POST_ERROR == "plugin.message_will_be_posted.dismiss_post"
