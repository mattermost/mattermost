# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for User, Team, and Channel API client methods.

This module tests the wrapper types and client method implementations for
User, Team, and Channel operations.
"""

import pytest
from unittest.mock import MagicMock, patch

import grpc


class TestWrapperTypes:
    """Tests for wrapper dataclasses."""

    def test_user_from_proto_and_to_proto(self):
        """Test User wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import User
        from mattermost_plugin.grpc import user_pb2

        # Create a protobuf User
        proto_user = user_pb2.User(
            id="user123",
            username="testuser",
            email="test@example.com",
            create_at=1234567890000,
            update_at=1234567890000,
            delete_at=0,
            email_verified=True,
            nickname="Test",
            first_name="Test",
            last_name="User",
            position="Developer",
            roles="system_user",
            locale="en",
            is_bot=False,
        )
        proto_user.timezone["automaticTimezone"] = "America/New_York"
        proto_user.props["theme"] = "dark"

        # Convert to wrapper
        user = User.from_proto(proto_user)

        # Verify fields
        assert user.id == "user123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.create_at == 1234567890000
        assert user.email_verified is True
        assert user.nickname == "Test"
        assert user.first_name == "Test"
        assert user.last_name == "User"
        assert user.position == "Developer"
        assert user.roles == "system_user"
        assert user.locale == "en"
        assert user.is_bot is False
        assert user.timezone["automaticTimezone"] == "America/New_York"
        assert user.props["theme"] == "dark"

        # Convert back to proto
        proto_back = user.to_proto()

        # Verify round-trip
        assert proto_back.id == proto_user.id
        assert proto_back.username == proto_user.username
        assert proto_back.email == proto_user.email

    def test_team_from_proto_and_to_proto(self):
        """Test Team wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import Team
        from mattermost_plugin.grpc import team_pb2

        # Create a protobuf Team
        proto_team = team_pb2.Team(
            id="team123",
            display_name="Test Team",
            name="testteam",
            create_at=1234567890000,
            description="A test team",
            email="team@example.com",
            type=team_pb2.TEAM_TYPE_OPEN,
            allow_open_invite=True,
        )

        # Convert to wrapper
        team = Team.from_proto(proto_team)

        # Verify fields
        assert team.id == "team123"
        assert team.display_name == "Test Team"
        assert team.name == "testteam"
        assert team.description == "A test team"
        assert team.email == "team@example.com"
        assert team.type == "O"  # TEAM_TYPE_OPEN -> "O"
        assert team.allow_open_invite is True

        # Convert back to proto
        proto_back = team.to_proto()

        # Verify round-trip
        assert proto_back.id == proto_team.id
        assert proto_back.display_name == proto_team.display_name
        assert proto_back.type == proto_team.type

    def test_channel_from_proto_and_to_proto(self):
        """Test Channel wrapper round-trip conversion."""
        from mattermost_plugin._internal.wrappers import Channel
        from mattermost_plugin.grpc import channel_pb2

        # Create a protobuf Channel
        proto_channel = channel_pb2.Channel(
            id="channel123",
            team_id="team123",
            display_name="Test Channel",
            name="testchannel",
            type=channel_pb2.CHANNEL_TYPE_OPEN,
            header="Welcome!",
            purpose="A test channel",
            creator_id="user123",
        )

        # Convert to wrapper
        channel = Channel.from_proto(proto_channel)

        # Verify fields
        assert channel.id == "channel123"
        assert channel.team_id == "team123"
        assert channel.display_name == "Test Channel"
        assert channel.name == "testchannel"
        assert channel.type == "O"  # CHANNEL_TYPE_OPEN -> "O"
        assert channel.header == "Welcome!"
        assert channel.purpose == "A test channel"
        assert channel.creator_id == "user123"

        # Convert back to proto
        proto_back = channel.to_proto()

        # Verify round-trip
        assert proto_back.id == proto_channel.id
        assert proto_back.team_id == proto_channel.team_id
        assert proto_back.type == proto_channel.type

    def test_user_status_from_proto(self):
        """Test UserStatus wrapper conversion."""
        from mattermost_plugin._internal.wrappers import UserStatus
        from mattermost_plugin.grpc import api_user_team_pb2

        # Create a protobuf Status
        proto_status = api_user_team_pb2.Status(
            user_id="user123",
            status="online",
            manual=True,
            last_activity_at=1234567890000,
            dnd_end_time=0,
        )

        # Convert to wrapper
        status = UserStatus.from_proto(proto_status)

        # Verify fields
        assert status.user_id == "user123"
        assert status.status == "online"
        assert status.manual is True
        assert status.last_activity_at == 1234567890000
        assert status.dnd_end_time == 0

    def test_team_member_from_proto(self):
        """Test TeamMember wrapper conversion."""
        from mattermost_plugin._internal.wrappers import TeamMember
        from mattermost_plugin.grpc import team_pb2

        # Create a protobuf TeamMember
        proto_member = team_pb2.TeamMember(
            team_id="team123",
            user_id="user123",
            roles="team_user team_admin",
            delete_at=0,
            scheme_guest=False,
            scheme_user=True,
            scheme_admin=True,
            create_at=1234567890000,
        )

        # Convert to wrapper
        member = TeamMember.from_proto(proto_member)

        # Verify fields
        assert member.team_id == "team123"
        assert member.user_id == "user123"
        assert member.roles == "team_user team_admin"
        assert member.scheme_user is True
        assert member.scheme_admin is True

    def test_channel_member_from_proto(self):
        """Test ChannelMember wrapper conversion."""
        from mattermost_plugin._internal.wrappers import ChannelMember
        from mattermost_plugin.grpc import api_channel_post_pb2

        # Create a protobuf ChannelMember
        proto_member = api_channel_post_pb2.ChannelMember(
            channel_id="channel123",
            user_id="user123",
            roles="channel_user",
            last_viewed_at=1234567890000,
            msg_count=100,
            mention_count=5,
        )
        proto_member.notify_props["desktop"] = "all"

        # Convert to wrapper
        member = ChannelMember.from_proto(proto_member)

        # Verify fields
        assert member.channel_id == "channel123"
        assert member.user_id == "user123"
        assert member.roles == "channel_user"
        assert member.last_viewed_at == 1234567890000
        assert member.msg_count == 100
        assert member.mention_count == 5
        assert member.notify_props["desktop"] == "all"


class TestClientUserMethods:
    """Tests for User-related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        # Mock the stub directly
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_get_user_success(self, mock_client):
        """Test get_user with successful response."""
        from mattermost_plugin.grpc import api_user_team_pb2, user_pb2

        # Mock the response
        mock_response = api_user_team_pb2.GetUserResponse()
        mock_response.user.CopyFrom(user_pb2.User(
            id="user123",
            username="testuser",
            email="test@example.com",
        ))
        mock_client._stub.GetUser.return_value = mock_response

        # Call the method
        user = mock_client.get_user("user123")

        # Verify
        assert user.id == "user123"
        assert user.username == "testuser"
        assert user.email == "test@example.com"

        # Verify the request was made correctly
        mock_client._stub.GetUser.assert_called_once()
        call_args = mock_client._stub.GetUser.call_args
        assert call_args[0][0].user_id == "user123"

    def test_get_user_not_found(self, mock_client):
        """Test get_user when user is not found."""
        from mattermost_plugin.grpc import api_user_team_pb2, common_pb2
        from mattermost_plugin.exceptions import NotFoundError

        # Mock the response with error
        mock_response = api_user_team_pb2.GetUserResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="api.user.get.not_found.app_error",
            message="User not found",
            status_code=404,
        ))
        mock_client._stub.GetUser.return_value = mock_response

        # Call the method and expect exception
        with pytest.raises(NotFoundError) as exc_info:
            mock_client.get_user("nonexistent")

        assert "User not found" in str(exc_info.value)
        assert exc_info.value.status_code == 404

    def test_get_user_grpc_error(self, mock_client):
        """Test get_user with gRPC error."""
        from mattermost_plugin.exceptions import UnavailableError

        # Create a mock that behaves like a gRPC error
        class MockGrpcError(grpc.RpcError):
            def code(self):
                return grpc.StatusCode.UNAVAILABLE

            def details(self):
                return "Service unavailable"

        mock_client._stub.GetUser.side_effect = MockGrpcError()

        # Call the method and expect exception
        with pytest.raises(UnavailableError):
            mock_client.get_user("user123")

    def test_create_user(self, mock_client):
        """Test create_user."""
        from mattermost_plugin._internal.wrappers import User
        from mattermost_plugin.grpc import api_user_team_pb2, user_pb2

        # Mock the response
        mock_response = api_user_team_pb2.CreateUserResponse()
        mock_response.user.CopyFrom(user_pb2.User(
            id="newuser123",
            username="newuser",
            email="new@example.com",
        ))
        mock_client._stub.CreateUser.return_value = mock_response

        # Create a user
        user_to_create = User(id="", username="newuser", email="new@example.com")
        created_user = mock_client.create_user(user_to_create)

        # Verify
        assert created_user.id == "newuser123"
        assert created_user.username == "newuser"

    def test_has_permission_to_channel(self, mock_client):
        """Test has_permission_to_channel."""
        from mattermost_plugin.grpc import api_user_team_pb2

        # Mock the response
        mock_response = api_user_team_pb2.HasPermissionToChannelResponse()
        mock_response.has_permission = True
        mock_client._stub.HasPermissionToChannel.return_value = mock_response

        # Check permission
        result = mock_client.has_permission_to_channel(
            "user123", "channel123", "read_channel"
        )

        # Verify
        assert result is True


class TestClientTeamMethods:
    """Tests for Team-related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_get_team_success(self, mock_client):
        """Test get_team with successful response."""
        from mattermost_plugin.grpc import api_user_team_pb2, team_pb2

        # Mock the response
        mock_response = api_user_team_pb2.GetTeamResponse()
        mock_response.team.CopyFrom(team_pb2.Team(
            id="team123",
            display_name="Test Team",
            name="testteam",
            type=team_pb2.TEAM_TYPE_OPEN,
        ))
        mock_client._stub.GetTeam.return_value = mock_response

        # Call the method
        team = mock_client.get_team("team123")

        # Verify
        assert team.id == "team123"
        assert team.display_name == "Test Team"
        assert team.name == "testteam"
        assert team.type == "O"

    def test_create_team_member(self, mock_client):
        """Test create_team_member."""
        from mattermost_plugin.grpc import api_user_team_pb2, team_pb2

        # Mock the response
        mock_response = api_user_team_pb2.CreateTeamMemberResponse()
        mock_response.team_member.CopyFrom(team_pb2.TeamMember(
            team_id="team123",
            user_id="user123",
            roles="team_user",
        ))
        mock_client._stub.CreateTeamMember.return_value = mock_response

        # Call the method
        member = mock_client.create_team_member("team123", "user123")

        # Verify
        assert member.team_id == "team123"
        assert member.user_id == "user123"
        assert member.roles == "team_user"

    def test_get_teams_for_user(self, mock_client):
        """Test get_teams_for_user."""
        from mattermost_plugin.grpc import api_user_team_pb2, team_pb2

        # Mock the response
        mock_response = api_user_team_pb2.GetTeamsForUserResponse()
        mock_response.teams.append(team_pb2.Team(
            id="team1",
            display_name="Team 1",
            name="team1",
        ))
        mock_response.teams.append(team_pb2.Team(
            id="team2",
            display_name="Team 2",
            name="team2",
        ))
        mock_client._stub.GetTeamsForUser.return_value = mock_response

        # Call the method
        teams = mock_client.get_teams_for_user("user123")

        # Verify
        assert len(teams) == 2
        assert teams[0].id == "team1"
        assert teams[1].id == "team2"


class TestClientChannelMethods:
    """Tests for Channel-related client methods."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_get_channel_success(self, mock_client):
        """Test get_channel with successful response."""
        from mattermost_plugin.grpc import api_channel_post_pb2, channel_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.GetChannelResponse()
        mock_response.channel.CopyFrom(channel_pb2.Channel(
            id="channel123",
            team_id="team123",
            display_name="General",
            name="general",
            type=channel_pb2.CHANNEL_TYPE_OPEN,
        ))
        mock_client._stub.GetChannel.return_value = mock_response

        # Call the method
        channel = mock_client.get_channel("channel123")

        # Verify
        assert channel.id == "channel123"
        assert channel.team_id == "team123"
        assert channel.display_name == "General"
        assert channel.type == "O"

    def test_add_channel_member(self, mock_client):
        """Test add_channel_member."""
        from mattermost_plugin.grpc import api_channel_post_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.AddChannelMemberResponse()
        mock_response.channel_member.CopyFrom(api_channel_post_pb2.ChannelMember(
            channel_id="channel123",
            user_id="user123",
            roles="channel_user",
        ))
        mock_client._stub.AddChannelMember.return_value = mock_response

        # Call the method
        member = mock_client.add_channel_member("channel123", "user123")

        # Verify
        assert member.channel_id == "channel123"
        assert member.user_id == "user123"

    def test_get_direct_channel(self, mock_client):
        """Test get_direct_channel."""
        from mattermost_plugin.grpc import api_channel_post_pb2, channel_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.GetDirectChannelResponse()
        mock_response.channel.CopyFrom(channel_pb2.Channel(
            id="dm123",
            type=channel_pb2.CHANNEL_TYPE_DIRECT,
        ))
        mock_client._stub.GetDirectChannel.return_value = mock_response

        # Call the method
        channel = mock_client.get_direct_channel("user1", "user2")

        # Verify
        assert channel.id == "dm123"
        assert channel.type == "D"

    def test_search_channels(self, mock_client):
        """Test search_channels."""
        from mattermost_plugin.grpc import api_channel_post_pb2, channel_pb2

        # Mock the response
        mock_response = api_channel_post_pb2.SearchChannelsResponse()
        mock_response.channels.append(channel_pb2.Channel(
            id="channel1",
            display_name="General",
            name="general",
        ))
        mock_response.channels.append(channel_pb2.Channel(
            id="channel2",
            display_name="Random",
            name="random",
        ))
        mock_client._stub.SearchChannels.return_value = mock_response

        # Call the method
        channels = mock_client.search_channels("team123", "gen")

        # Verify
        assert len(channels) == 2
        assert channels[0].display_name == "General"


class TestErrorHandling:
    """Tests for error handling across all domains."""

    @pytest.fixture
    def mock_client(self):
        """Create a mocked client for testing."""
        from mattermost_plugin.client import PluginAPIClient

        client = PluginAPIClient(target="localhost:50051")
        client._stub = MagicMock()
        client._channel = MagicMock()
        return client

    def test_permission_denied_error(self, mock_client):
        """Test that 403 status code maps to PermissionDeniedError."""
        from mattermost_plugin.grpc import api_user_team_pb2, common_pb2
        from mattermost_plugin.exceptions import PermissionDeniedError

        # Mock the response with 403 error
        mock_response = api_user_team_pb2.DeleteUserResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="api.user.delete.permissions.app_error",
            message="Permission denied",
            status_code=403,
        ))
        mock_client._stub.DeleteUser.return_value = mock_response

        # Call the method and expect PermissionDeniedError
        with pytest.raises(PermissionDeniedError) as exc_info:
            mock_client.delete_user("user123")

        assert exc_info.value.status_code == 403

    def test_validation_error(self, mock_client):
        """Test that 400 status code maps to ValidationError."""
        from mattermost_plugin._internal.wrappers import User
        from mattermost_plugin.grpc import api_user_team_pb2, common_pb2
        from mattermost_plugin.exceptions import ValidationError

        # Mock the response with 400 error
        mock_response = api_user_team_pb2.CreateUserResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="model.user.is_valid.create.app_error",
            message="Invalid username",
            status_code=400,
        ))
        mock_client._stub.CreateUser.return_value = mock_response

        # Call the method and expect ValidationError
        with pytest.raises(ValidationError) as exc_info:
            mock_client.create_user(User(id="", username="", email="test@test.com"))

        assert exc_info.value.status_code == 400

    def test_already_exists_error(self, mock_client):
        """Test that 409 status code maps to AlreadyExistsError."""
        from mattermost_plugin._internal.wrappers import Team
        from mattermost_plugin.grpc import api_user_team_pb2, common_pb2
        from mattermost_plugin.exceptions import AlreadyExistsError

        # Mock the response with 409 error
        mock_response = api_user_team_pb2.CreateTeamResponse()
        mock_response.error.CopyFrom(common_pb2.AppError(
            id="store.sql_team.get_by_name.already_exists.app_error",
            message="Team with that name already exists",
            status_code=409,
        ))
        mock_client._stub.CreateTeam.return_value = mock_response

        # Call the method and expect AlreadyExistsError
        with pytest.raises(AlreadyExistsError) as exc_info:
            mock_client.create_team(Team(id="", name="existing", display_name="Existing"))

        assert exc_info.value.status_code == 409
