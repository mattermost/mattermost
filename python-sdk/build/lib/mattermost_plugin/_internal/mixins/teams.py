# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Team API methods mixin for PluginAPIClient.

This module provides all team-related API methods including:
- Team CRUD operations
- Team membership management
- Team icons and stats
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import (
    Team,
    TeamMember,
    TeamMemberWithError,
    TeamUnread,
    TeamStats,
)
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class TeamsMixin:
    """Mixin providing team-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Team CRUD
    # =========================================================================

    def create_team(self, team: Team) -> Team:
        """
        Create a new team.

        Args:
            team: Team object with details for the new team.
                  The ID field should be empty as it will be assigned.

        Returns:
            The created Team with assigned ID.

        Raises:
            ValidationError: If team data is invalid.
            AlreadyExistsError: If team name already exists.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateTeamRequest(team=team.to_proto())

        try:
            response = stub.CreateTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Team.from_proto(response.team)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_team(self, team_id: str) -> None:
        """
        Delete a team.

        Args:
            team_id: ID of the team to delete.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.DeleteTeamRequest(team_id=team_id)

        try:
            response = stub.DeleteTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_team(self, team_id: str) -> Team:
        """
        Get a team by ID.

        Args:
            team_id: ID of the team to retrieve.

        Returns:
            The Team object.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamRequest(team_id=team_id)

        try:
            response = stub.GetTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Team.from_proto(response.team)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_team_by_name(self, name: str) -> Team:
        """
        Get a team by its URL-safe name.

        Args:
            name: URL-safe name of the team.

        Returns:
            The Team object.

        Raises:
            NotFoundError: If team with name does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamByNameRequest(name=name)

        try:
            response = stub.GetTeamByName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Team.from_proto(response.team)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_teams(self) -> List[Team]:
        """
        Get all teams.

        Returns:
            List of all Team objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamsRequest()

        try:
            response = stub.GetTeams(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Team.from_proto(t) for t in response.teams]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_teams_for_user(self, user_id: str) -> List[Team]:
        """
        Get all teams a user belongs to.

        Args:
            user_id: ID of the user.

        Returns:
            List of Team objects the user is a member of.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamsForUserRequest(user_id=user_id)

        try:
            response = stub.GetTeamsForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Team.from_proto(t) for t in response.teams]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_team(self, team: Team) -> Team:
        """
        Update a team.

        Args:
            team: Team object with updated fields. ID must be set.

        Returns:
            The updated Team.

        Raises:
            NotFoundError: If team does not exist.
            ValidationError: If team data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateTeamRequest(team=team.to_proto())

        try:
            response = stub.UpdateTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Team.from_proto(response.team)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_teams(self, term: str) -> List[Team]:
        """
        Search for teams.

        Args:
            term: Search term (matches team name and display name).

        Returns:
            List of Team objects matching the search.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.SearchTeamsRequest(term=term)

        try:
            response = stub.SearchTeams(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Team.from_proto(t) for t in response.teams]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_teams_unread_for_user(self, user_id: str) -> List[TeamUnread]:
        """
        Get unread counts for all teams for a user.

        Args:
            user_id: ID of the user.

        Returns:
            List of TeamUnread objects.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamsUnreadForUserRequest(user_id=user_id)

        try:
            response = stub.GetTeamsUnreadForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [TeamUnread.from_proto(u) for u in response.team_unreads]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Team Membership
    # =========================================================================

    def create_team_member(self, team_id: str, user_id: str) -> TeamMember:
        """
        Add a user to a team.

        Args:
            team_id: ID of the team.
            user_id: ID of the user to add.

        Returns:
            The created TeamMember.

        Raises:
            NotFoundError: If team or user does not exist.
            AlreadyExistsError: If user is already a member.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateTeamMemberRequest(
            team_id=team_id,
            user_id=user_id,
        )

        try:
            response = stub.CreateTeamMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return TeamMember.from_proto(response.team_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def create_team_members(
        self,
        team_id: str,
        user_ids: List[str],
        requestor_id: str = "",
    ) -> List[TeamMember]:
        """
        Add multiple users to a team.

        Args:
            team_id: ID of the team.
            user_ids: List of user IDs to add.
            requestor_id: ID of the user making the request (for audit).

        Returns:
            List of created TeamMember objects.

        Raises:
            NotFoundError: If team or any user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateTeamMembersRequest(
            team_id=team_id,
            user_ids=user_ids,
            requestor_id=requestor_id,
        )

        try:
            response = stub.CreateTeamMembers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [TeamMember.from_proto(m) for m in response.team_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def create_team_members_gracefully(
        self,
        team_id: str,
        user_ids: List[str],
        requestor_id: str = "",
    ) -> List[TeamMemberWithError]:
        """
        Add multiple users to a team, returning results for each.

        Unlike create_team_members, this method does not fail if some users
        cannot be added. Instead, it returns results for each user including
        any errors.

        Args:
            team_id: ID of the team.
            user_ids: List of user IDs to add.
            requestor_id: ID of the user making the request (for audit).

        Returns:
            List of TeamMemberWithError objects with results for each user.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateTeamMembersGracefullyRequest(
            team_id=team_id,
            user_ids=user_ids,
            requestor_id=requestor_id,
        )

        try:
            response = stub.CreateTeamMembersGracefully(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [TeamMemberWithError.from_proto(m) for m in response.team_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_team_member(
        self, team_id: str, user_id: str, requestor_id: str = ""
    ) -> None:
        """
        Remove a user from a team.

        Args:
            team_id: ID of the team.
            user_id: ID of the user to remove.
            requestor_id: ID of the user making the request (for audit).

        Raises:
            NotFoundError: If team membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.DeleteTeamMemberRequest(
            team_id=team_id,
            user_id=user_id,
            requestor_id=requestor_id,
        )

        try:
            response = stub.DeleteTeamMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_team_member(self, team_id: str, user_id: str) -> TeamMember:
        """
        Get a team membership.

        Args:
            team_id: ID of the team.
            user_id: ID of the user.

        Returns:
            The TeamMember object.

        Raises:
            NotFoundError: If membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamMemberRequest(
            team_id=team_id,
            user_id=user_id,
        )

        try:
            response = stub.GetTeamMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return TeamMember.from_proto(response.team_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_team_members(
        self, team_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[TeamMember]:
        """
        Get team members.

        Args:
            team_id: ID of the team.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of TeamMember objects.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamMembersRequest(
            team_id=team_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetTeamMembers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [TeamMember.from_proto(m) for m in response.team_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_team_members_for_user(
        self, user_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[TeamMember]:
        """
        Get all team memberships for a user.

        Args:
            user_id: ID of the user.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of TeamMember objects.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamMembersForUserRequest(
            user_id=user_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetTeamMembersForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [TeamMember.from_proto(m) for m in response.team_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_team_member_roles(
        self, team_id: str, user_id: str, new_roles: str
    ) -> TeamMember:
        """
        Update a team member's roles.

        Args:
            team_id: ID of the team.
            user_id: ID of the user.
            new_roles: Space-separated list of new roles.

        Returns:
            The updated TeamMember.

        Raises:
            NotFoundError: If membership does not exist.
            ValidationError: If roles are invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateTeamMemberRolesRequest(
            team_id=team_id,
            user_id=user_id,
            new_roles=new_roles,
        )

        try:
            response = stub.UpdateTeamMemberRoles(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return TeamMember.from_proto(response.team_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Team Icon
    # =========================================================================

    def get_team_icon(self, team_id: str) -> bytes:
        """
        Get a team's icon.

        Args:
            team_id: ID of the team.

        Returns:
            The team icon as bytes.

        Raises:
            NotFoundError: If team does not exist or has no icon.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamIconRequest(team_id=team_id)

        try:
            response = stub.GetTeamIcon(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.icon

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def set_team_icon(self, team_id: str, data: bytes) -> None:
        """
        Set a team's icon.

        Args:
            team_id: ID of the team.
            data: Image data as bytes.

        Raises:
            NotFoundError: If team does not exist.
            ValidationError: If image data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.SetTeamIconRequest(
            team_id=team_id,
            data=data,
        )

        try:
            response = stub.SetTeamIcon(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def remove_team_icon(self, team_id: str) -> None:
        """
        Remove a team's icon.

        Args:
            team_id: ID of the team.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.RemoveTeamIconRequest(team_id=team_id)

        try:
            response = stub.RemoveTeamIcon(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Team Stats
    # =========================================================================

    def get_team_stats(self, team_id: str) -> TeamStats:
        """
        Get statistics for a team.

        Args:
            team_id: ID of the team.

        Returns:
            The TeamStats object.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetTeamStatsRequest(team_id=team_id)

        try:
            response = stub.GetTeamStats(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return TeamStats.from_proto(response.team_stats)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
