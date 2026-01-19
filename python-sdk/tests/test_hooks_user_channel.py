# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for user and channel hook implementations in the hook servicer.

Tests verify:
- User lifecycle hooks: UserHasBeenCreated, UserWillLogIn, UserHasLoggedIn, UserHasBeenDeactivated
- Channel/Team hooks: ChannelHasBeenCreated, UserHasJoined/LeftChannel, UserHasJoined/LeftTeam
- OnSAMLLogin hook
"""

import pytest
from unittest.mock import MagicMock

from mattermost_plugin import Plugin, hook, HookName
from mattermost_plugin.servicers.hooks_servicer import PluginHooksServicerImpl
from mattermost_plugin.grpc import hooks_user_channel_pb2
from mattermost_plugin.grpc import hooks_common_pb2
from mattermost_plugin.grpc import user_pb2
from mattermost_plugin.grpc import channel_pb2
from mattermost_plugin.grpc import team_pb2
from mattermost_plugin.grpc import api_channel_post_pb2
from mattermost_plugin.grpc import api_user_team_pb2


def make_plugin_context() -> hooks_common_pb2.PluginContext:
    """Create a test PluginContext."""
    return hooks_common_pb2.PluginContext(
        session_id="session123",
        request_id="request123",
    )


def make_test_user(user_id: str = "user123") -> user_pb2.User:
    """Create a test User protobuf message."""
    return user_pb2.User(
        id=user_id,
        username="testuser",
        email="test@example.com",
    )


def make_test_channel(channel_id: str = "channel123") -> channel_pb2.Channel:
    """Create a test Channel protobuf message."""
    return channel_pb2.Channel(
        id=channel_id,
        name="test-channel",
        display_name="Test Channel",
        team_id="team123",
        type=channel_pb2.CHANNEL_TYPE_OPEN,
    )


def make_channel_member(user_id: str = "user123", channel_id: str = "channel123") -> api_channel_post_pb2.ChannelMember:
    """Create a test ChannelMember protobuf message."""
    return api_channel_post_pb2.ChannelMember(
        user_id=user_id,
        channel_id=channel_id,
    )


def make_team_member(user_id: str = "user123", team_id: str = "team123") -> team_pb2.TeamMember:
    """Create a test TeamMember protobuf message."""
    return team_pb2.TeamMember(
        user_id=user_id,
        team_id=team_id,
    )


class TestUserHasBeenCreated:
    """Tests for UserHasBeenCreated hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test notification succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasBeenCreatedRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        response = await servicer.UserHasBeenCreated(request, context)

        # Fire-and-forget - always succeeds
        assert isinstance(response, hooks_user_channel_pb2.UserHasBeenCreatedResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that notification handler is called."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.UserHasBeenCreated)
            def on_user_created(self, ctx, user):
                call_count[0] += 1

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasBeenCreatedRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        await servicer.UserHasBeenCreated(request, context)

        assert call_count[0] == 1

    @pytest.mark.asyncio
    async def test_exception_doesnt_fail_response(self) -> None:
        """Test that handler exceptions don't prevent response."""

        class TestPlugin(Plugin):
            @hook(HookName.UserHasBeenCreated)
            def on_user_created(self, ctx, user):
                raise RuntimeError("Handler crashed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasBeenCreatedRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        # Should not raise - errors are logged but response succeeds
        response = await servicer.UserHasBeenCreated(request, context)
        assert isinstance(response, hooks_user_channel_pb2.UserHasBeenCreatedResponse)


class TestUserWillLogIn:
    """Tests for UserWillLogIn hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that login is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserWillLogInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        response = await servicer.UserWillLogIn(request, context)

        # Not implemented = allow
        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_allow_login(self) -> None:
        """Test allowing login by returning empty string."""

        class TestPlugin(Plugin):
            @hook(HookName.UserWillLogIn)
            def check_login(self, ctx, user):
                return ""  # Allow

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserWillLogInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        response = await servicer.UserWillLogIn(request, context)

        assert response.rejection_reason == ""

    @pytest.mark.asyncio
    async def test_reject_login(self) -> None:
        """Test rejecting login by returning a reason string."""

        class TestPlugin(Plugin):
            @hook(HookName.UserWillLogIn)
            def check_login(self, ctx, user):
                return "Account is suspended"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserWillLogInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        response = await servicer.UserWillLogIn(request, context)

        assert response.rejection_reason == "Account is suspended"

    @pytest.mark.asyncio
    async def test_exception_rejects_login(self) -> None:
        """Test that handler exceptions reject the login."""

        class TestPlugin(Plugin):
            @hook(HookName.UserWillLogIn)
            def check_login(self, ctx, user):
                raise ValueError("Login check failed")

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserWillLogInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        response = await servicer.UserWillLogIn(request, context)

        # Exception = rejection
        assert "Plugin error" in response.rejection_reason

    @pytest.mark.asyncio
    async def test_receives_user(self) -> None:
        """Test that handler receives the user object."""
        received = []

        class TestPlugin(Plugin):
            @hook(HookName.UserWillLogIn)
            def check_login(self, ctx, user):
                received.append(user.username)
                return ""

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserWillLogInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
        )
        await servicer.UserWillLogIn(request, context)

        assert len(received) == 1
        assert received[0] == "testuser"


class TestUserHasLoggedIn:
    """Tests for UserHasLoggedIn hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called after login."""
        logged_in_users = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasLoggedIn)
            def on_login(self, ctx, user):
                logged_in_users.append(user.id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasLoggedInRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user("logged_in_user"),
        )
        await servicer.UserHasLoggedIn(request, context)

        assert "logged_in_user" in logged_in_users


class TestUserHasBeenDeactivated:
    """Tests for UserHasBeenDeactivated hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when user is deactivated."""
        deactivated_users = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasBeenDeactivated)
            def on_deactivate(self, ctx, user):
                deactivated_users.append(user.id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasBeenDeactivatedRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user("deactivated_user"),
        )
        await servicer.UserHasBeenDeactivated(request, context)

        assert "deactivated_user" in deactivated_users


class TestChannelHasBeenCreated:
    """Tests for ChannelHasBeenCreated hook."""

    @pytest.mark.asyncio
    async def test_success_when_not_implemented(self) -> None:
        """Test notification succeeds when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.ChannelHasBeenCreatedRequest(
            plugin_context=make_plugin_context(),
            channel=make_test_channel(),
        )
        response = await servicer.ChannelHasBeenCreated(request, context)

        assert isinstance(response, hooks_user_channel_pb2.ChannelHasBeenCreatedResponse)

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when channel is created."""
        created_channels = []

        class TestPlugin(Plugin):
            @hook(HookName.ChannelHasBeenCreated)
            def on_channel_created(self, ctx, channel):
                created_channels.append(channel.name)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.ChannelHasBeenCreatedRequest(
            plugin_context=make_plugin_context(),
            channel=make_test_channel(),
        )
        await servicer.ChannelHasBeenCreated(request, context)

        assert "test-channel" in created_channels


class TestUserHasJoinedChannel:
    """Tests for UserHasJoinedChannel hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when user joins channel."""
        join_events = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasJoinedChannel)
            def on_join(self, ctx, member, actor):
                join_events.append((member.user_id, member.channel_id, actor))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasJoinedChannelRequest(
            plugin_context=make_plugin_context(),
            channel_member=make_channel_member("joining_user", "target_channel"),
        )
        await servicer.UserHasJoinedChannel(request, context)

        assert len(join_events) == 1
        user_id, channel_id, actor = join_events[0]
        assert user_id == "joining_user"
        assert channel_id == "target_channel"
        assert actor is None  # No actor = self-join

    @pytest.mark.asyncio
    async def test_receives_actor_when_present(self) -> None:
        """Test that handler receives actor when another user invites."""
        join_events = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasJoinedChannel)
            def on_join(self, ctx, member, actor):
                join_events.append((member.user_id, actor.id if actor else None))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasJoinedChannelRequest(
            plugin_context=make_plugin_context(),
            channel_member=make_channel_member("joining_user", "target_channel"),
            actor=make_test_user("inviter_user"),
        )
        await servicer.UserHasJoinedChannel(request, context)

        assert len(join_events) == 1
        user_id, actor_id = join_events[0]
        assert user_id == "joining_user"
        assert actor_id == "inviter_user"


class TestUserHasLeftChannel:
    """Tests for UserHasLeftChannel hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when user leaves channel."""
        leave_events = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasLeftChannel)
            def on_leave(self, ctx, member, actor):
                leave_events.append(member.user_id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasLeftChannelRequest(
            plugin_context=make_plugin_context(),
            channel_member=make_channel_member("leaving_user", "source_channel"),
        )
        await servicer.UserHasLeftChannel(request, context)

        assert "leaving_user" in leave_events


class TestUserHasJoinedTeam:
    """Tests for UserHasJoinedTeam hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when user joins team."""
        join_events = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasJoinedTeam)
            def on_join_team(self, ctx, member, actor):
                join_events.append((member.user_id, member.team_id))

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasJoinedTeamRequest(
            plugin_context=make_plugin_context(),
            team_member=make_team_member("joining_user", "target_team"),
        )
        await servicer.UserHasJoinedTeam(request, context)

        assert len(join_events) == 1
        assert join_events[0] == ("joining_user", "target_team")


class TestUserHasLeftTeam:
    """Tests for UserHasLeftTeam hook."""

    @pytest.mark.asyncio
    async def test_handler_called(self) -> None:
        """Test that handler is called when user leaves team."""
        leave_events = []

        class TestPlugin(Plugin):
            @hook(HookName.UserHasLeftTeam)
            def on_leave_team(self, ctx, member, actor):
                leave_events.append(member.user_id)

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.UserHasLeftTeamRequest(
            plugin_context=make_plugin_context(),
            team_member=make_team_member("leaving_user", "source_team"),
        )
        await servicer.UserHasLeftTeam(request, context)

        assert "leaving_user" in leave_events


class TestOnSAMLLogin:
    """Tests for OnSAMLLogin hook."""

    @pytest.mark.asyncio
    async def test_allow_when_not_implemented(self) -> None:
        """Test that SAML login is allowed when hook is not implemented."""

        class EmptyPlugin(Plugin):
            pass

        plugin = EmptyPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.OnSAMLLoginRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
            assertion=hooks_user_channel_pb2.SamlAssertionInfoJson(assertion_json=b'{}'),
        )
        response = await servicer.OnSAMLLogin(request, context)

        # Not implemented = allow
        assert not response.HasField("error")

    @pytest.mark.asyncio
    async def test_reject_login(self) -> None:
        """Test rejecting SAML login by returning an error."""

        class TestPlugin(Plugin):
            @hook(HookName.OnSAMLLogin)
            def check_saml(self, ctx, user, assertion):
                return "SAML login not allowed for this user"

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.OnSAMLLoginRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
            assertion=hooks_user_channel_pb2.SamlAssertionInfoJson(assertion_json=b'{}'),
        )
        response = await servicer.OnSAMLLogin(request, context)

        assert response.HasField("error")
        assert "SAML login not allowed" in response.error.message

    @pytest.mark.asyncio
    async def test_allow_login(self) -> None:
        """Test allowing SAML login by returning None."""

        class TestPlugin(Plugin):
            @hook(HookName.OnSAMLLogin)
            def check_saml(self, ctx, user, assertion):
                return None  # Allow

        plugin = TestPlugin()
        servicer = PluginHooksServicerImpl(plugin)
        context = MagicMock()

        request = hooks_user_channel_pb2.OnSAMLLoginRequest(
            plugin_context=make_plugin_context(),
            user=make_test_user(),
            assertion=hooks_user_channel_pb2.SamlAssertionInfoJson(assertion_json=b'{}'),
        )
        response = await servicer.OnSAMLLogin(request, context)

        assert not response.HasField("error")
