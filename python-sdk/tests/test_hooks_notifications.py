# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for notification hook implementations in the hook servicer.

Tests verify:
- ReactionHasBeenAdded/Removed: fire-and-forget
- NotificationWillBePushed: allow/reject/modify semantics
- EmailNotificationWillBeSent: allow/reject/modify semantics
- PreferencesHaveChanged: fire-and-forget
"""

import pytest
from unittest.mock import MagicMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl
from mattermost_plugin.grpc import hooks_message_pb2
from mattermost_plugin.grpc import hooks_common_pb2
from mattermost_plugin.grpc import api_remaining_pb2
from mattermost_plugin.grpc import post_pb2


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


def make_test_reaction(emoji: str = "thumbsup") -> post_pb2.Reaction:
    """Create a test Reaction protobuf message."""
    return post_pb2.Reaction(
        user_id="user123",
        post_id="post123",
        emoji_name=emoji,
        create_at=1234567890000,
    )


def make_push_notification(message: str = "New message") -> api_remaining_pb2.PushNotification:
    """Create a test PushNotification."""
    return api_remaining_pb2.PushNotification(
        platform="apple",
        server_id="server123",
        device_id="device123",
        message=message,
        channel_id="channel123",
        post_id="post123",
    )


def make_email_notification() -> hooks_message_pb2.EmailNotificationJson:
    """Create a test EmailNotificationJson."""
    return hooks_message_pb2.EmailNotificationJson(
        notification_json=b'{"to": "test@example.com", "subject": "Test Subject"}'
    )


class TestReactionHasBeenAdded:
    """Tests for ReactionHasBeenAdded hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test notification succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.ReactionHasBeenAddedRequest(
            plugin_context=make_plugin_context(),
            reaction=make_test_reaction(),
        )
        response = await servicer.ReactionHasBeenAdded(request, context)

        assert isinstance(response, hooks_message_pb2.ReactionHasBeenAddedResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when reaction is added."""
        reactions_added = []

        class TestPlugin(Plugin):
            @hook(HookName.ReactionHasBeenAdded)
            def on_reaction(self, ctx, reaction):
                reactions_added.append((reaction.post_id, reaction.emoji_name))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.ReactionHasBeenAddedRequest(
            plugin_context=make_plugin_context(),
            reaction=make_test_reaction("heart"),
        )
        await servicer.ReactionHasBeenAdded(request, context)

        assert len(reactions_added) == 1
        assert reactions_added[0] == ("post123", "heart")

    @pytest.mark.asyncio
    async def test_exception_doesnt_fail(self) -> None:
        """Test that exceptions don't prevent response."""

        class TestPlugin(Plugin):
            @hook(HookName.ReactionHasBeenAdded)
            def on_reaction(self, ctx, reaction):
                raise RuntimeError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.ReactionHasBeenAddedRequest(
            plugin_context=make_plugin_context(),
            reaction=make_test_reaction(),
        )
        response = await servicer.ReactionHasBeenAdded(request, context)
        assert isinstance(response, hooks_message_pb2.ReactionHasBeenAddedResponse)


class TestReactionHasBeenRemoved:
    """Tests for ReactionHasBeenRemoved hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when reaction is removed."""
        reactions_removed = []

        class TestPlugin(Plugin):
            @hook(HookName.ReactionHasBeenRemoved)
            def on_reaction_removed(self, ctx, reaction):
                reactions_removed.append(reaction.emoji_name)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.ReactionHasBeenRemovedRequest(
            plugin_context=make_plugin_context(),
            reaction=make_test_reaction("smile"),
        )
        await servicer.ReactionHasBeenRemoved(request, context)

        assert "smile" in reactions_removed


class TestNotificationWillBePushed:
    """Tests for NotificationWillBePushed hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that notification is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification(),
            user_id="user123",
        )
        response = await servicer.NotificationWillBePushed(request, context)

        # Not implemented = allow unchanged
        assert not response.HasField("modified_notification")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_allow_unchanged(self) -> None:
        """Test allowing notification unchanged."""

        class TestPlugin(Plugin):
            @hook(HookName.NotificationWillBePushed)
            def filter_notification(self, notification, user_id):
                return None, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification(),
            user_id="user123",
        )
        response = await servicer.NotificationWillBePushed(request, context)

        assert not response.HasField("modified_notification")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_reject_notification(self) -> None:
        """Test rejecting notification with reason."""

        class TestPlugin(Plugin):
            @hook(HookName.NotificationWillBePushed)
            def filter_notification(self, notification, user_id):
                return None, "User has disabled notifications"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification(),
            user_id="user123",
        )
        response = await servicer.NotificationWillBePushed(request, context)

        assert response.rejection_reason == "User has disabled notifications"

    @pytest.mark.asyncio
    async def test_modify_notification(self) -> None:
        """Test modifying notification content."""

        class TestPlugin(Plugin):
            @hook(HookName.NotificationWillBePushed)
            def filter_notification(self, notification, user_id):
                modified = api_remaining_pb2.PushNotification()
                modified.CopyFrom(notification)
                modified.message = "[Modified] " + notification.message
                return modified, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification("Hello"),
            user_id="user123",
        )
        response = await servicer.NotificationWillBePushed(request, context)

        assert response.HasField("modified_notification")
        assert response.modified_notification.message == "[Modified] Hello"
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_exception_rejects(self) -> None:
        """Test that exceptions reject the notification."""

        class TestPlugin(Plugin):
            @hook(HookName.NotificationWillBePushed)
            def filter_notification(self, notification, user_id):
                raise ValueError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification(),
            user_id="user123",
        )
        response = await servicer.NotificationWillBePushed(request, context)

        assert "Plugin error" in response.rejection_reason

    @pytest.mark.asyncio
    async def test_receives_user_id(self) -> None:
        """Test that handler receives the user_id."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.NotificationWillBePushed)
            def filter_notification(self, notification, user_id):
                received.append(user_id)
                return None, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.NotificationWillBePushedRequest(
            push_notification=make_push_notification(),
            user_id="target_user",
        )
        await servicer.NotificationWillBePushed(request, context)

        assert "target_user" in received


class TestEmailNotificationWillBeSent:
    """Tests for EmailNotificationWillBeSent hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that email is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.EmailNotificationWillBeSentRequest(
            email_notification=make_email_notification(),
        )
        response = await servicer.EmailNotificationWillBeSent(request, context)

        # Not implemented = allow unchanged
        assert not response.HasField("modified_content")
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_reject_email(self) -> None:
        """Test rejecting email notification."""

        class TestPlugin(Plugin):
            @hook(HookName.EmailNotificationWillBeSent)
            def filter_email(self, notification):
                return None, "Email notifications disabled"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.EmailNotificationWillBeSentRequest(
            email_notification=make_email_notification(),
        )
        response = await servicer.EmailNotificationWillBeSent(request, context)

        assert response.rejection_reason == "Email notifications disabled"

    @pytest.mark.asyncio
    async def test_modify_email(self) -> None:
        """Test modifying email content."""

        class TestPlugin(Plugin):
            @hook(HookName.EmailNotificationWillBeSent)
            def filter_email(self, notification):
                modified = hooks_message_pb2.EmailNotificationContent(
                    subject="[Modified] Subject",
                    message_html="<p>Modified body</p>",
                )
                return modified, ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.EmailNotificationWillBeSentRequest(
            email_notification=make_email_notification(),
        )
        response = await servicer.EmailNotificationWillBeSent(request, context)

        assert response.HasField("modified_content")
        assert response.modified_content.subject == "[Modified] Subject"


class TestPreferencesHaveChanged:
    """Tests for PreferencesHaveChanged hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test notification succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.PreferencesHaveChangedRequest(
            plugin_context=make_plugin_context(),
            preferences=[
                api_remaining_pb2.Preference(
                    user_id="user123",
                    category="theme",
                    name="color",
                    value="dark",
                ),
            ],
        )
        response = await servicer.PreferencesHaveChanged(request, context)

        assert isinstance(response, hooks_message_pb2.PreferencesHaveChangedResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when preferences change."""
        changed_prefs = []

        class TestPlugin(Plugin):
            @hook(HookName.PreferencesHaveChanged)
            def on_prefs_changed(self, ctx, preferences):
                for pref in preferences:
                    changed_prefs.append((pref.category, pref.name, pref.value))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.PreferencesHaveChangedRequest(
            plugin_context=make_plugin_context(),
            preferences=[
                api_remaining_pb2.Preference(
                    user_id="user123",
                    category="notifications",
                    name="sound",
                    value="true",
                ),
                api_remaining_pb2.Preference(
                    user_id="user123",
                    category="display",
                    name="timezone",
                    value="America/New_York",
                ),
            ],
        )
        await servicer.PreferencesHaveChanged(request, context)

        assert len(changed_prefs) == 2
        assert ("notifications", "sound", "true") in changed_prefs
        assert ("display", "timezone", "America/New_York") in changed_prefs

    @pytest.mark.asyncio
    async def test_exception_doesnt_fail(self) -> None:
        """Test that exceptions don't prevent response."""

        class TestPlugin(Plugin):
            @hook(HookName.PreferencesHaveChanged)
            def on_prefs_changed(self, ctx, preferences):
                raise RuntimeError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_message_pb2.PreferencesHaveChangedRequest(
            plugin_context=make_plugin_context(),
            preferences=[],
        )
        response = await servicer.PreferencesHaveChanged(request, context)
        assert isinstance(response, hooks_message_pb2.PreferencesHaveChangedResponse)
