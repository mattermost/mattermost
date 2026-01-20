# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
User API methods mixin for PluginAPIClient.

This module provides all user-related API methods including:
- User CRUD operations
- User status management
- User authentication
- Sessions and access tokens
- Permissions checking
"""

from __future__ import annotations

from typing import Dict, List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import (
    User,
    UserStatus,
    CustomStatus,
    UserAuth,
    Session,
    UserAccessToken,
    ViewUsersRestrictions,
)
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class UsersMixin:
    """Mixin providing user-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # User CRUD
    # =========================================================================

    def create_user(self, user: User) -> User:
        """
        Create a new user.

        Args:
            user: User object with details for the new user.
                  The ID field should be empty as it will be assigned.

        Returns:
            The created User with assigned ID.

        Raises:
            ValidationError: If user data is invalid.
            AlreadyExistsError: If username or email already exists.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateUserRequest(user=user.to_proto())

        try:
            response = stub.CreateUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_user(self, user_id: str) -> None:
        """
        Delete a user.

        Args:
            user_id: ID of the user to delete.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.DeleteUserRequest(user_id=user_id)

        try:
            response = stub.DeleteUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_user(self, user_id: str) -> User:
        """
        Get a user by ID.

        Args:
            user_id: ID of the user to retrieve.

        Returns:
            The User object.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUserRequest(user_id=user_id)

        try:
            response = stub.GetUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_user_by_email(self, email: str) -> User:
        """
        Get a user by email address.

        Args:
            email: Email address of the user.

        Returns:
            The User object.

        Raises:
            NotFoundError: If user with email does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUserByEmailRequest(email=email)

        try:
            response = stub.GetUserByEmail(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_user_by_username(self, username: str) -> User:
        """
        Get a user by username.

        Args:
            username: Username of the user.

        Returns:
            The User object.

        Raises:
            NotFoundError: If user with username does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUserByUsernameRequest(name=username)

        try:
            response = stub.GetUserByUsername(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_users_by_ids(self, user_ids: List[str]) -> List[User]:
        """
        Get multiple users by their IDs.

        Args:
            user_ids: List of user IDs to retrieve.

        Returns:
            List of User objects (may be shorter than input if some IDs not found).

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUsersByIdsRequest(user_ids=user_ids)

        try:
            response = stub.GetUsersByIds(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_users_by_usernames(self, usernames: List[str]) -> List[User]:
        """
        Get multiple users by their usernames.

        Args:
            usernames: List of usernames to retrieve.

        Returns:
            List of User objects (may be shorter than input if some not found).

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUsersByUsernamesRequest(usernames=usernames)

        try:
            response = stub.GetUsersByUsernames(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_users(
        self,
        *,
        in_team_id: str = "",
        not_in_team_id: str = "",
        in_channel_id: str = "",
        not_in_channel_id: str = "",
        in_group_id: str = "",
        not_in_group_id: str = "",
        group_constrained: bool = False,
        without_team: bool = False,
        inactive: bool = False,
        active: bool = False,
        role: str = "",
        roles: Optional[List[str]] = None,
        channel_roles: Optional[List[str]] = None,
        team_roles: Optional[List[str]] = None,
        sort: str = "",
        page: int = 0,
        per_page: int = 60,
        updated_after: int = 0,
        view_restrictions: Optional[ViewUsersRestrictions] = None,
    ) -> List[User]:
        """
        Get users with filtering options.

        Args:
            in_team_id: Filter to users in this team.
            not_in_team_id: Filter to users not in this team.
            in_channel_id: Filter to users in this channel.
            not_in_channel_id: Filter to users not in this channel.
            in_group_id: Filter to users in this group.
            not_in_group_id: Filter to users not in this group.
            group_constrained: Filter to group-constrained users.
            without_team: Filter to users without any team.
            inactive: Filter to inactive users.
            active: Filter to active users.
            role: Filter by single role.
            roles: Filter by multiple roles.
            channel_roles: Filter by channel roles.
            team_roles: Filter by team roles.
            sort: Sort order.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).
            updated_after: Filter to users updated after this timestamp.
            view_restrictions: Restrict visible users.

        Returns:
            List of User objects matching the filters.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUsersRequest(
            in_team_id=in_team_id,
            not_in_team_id=not_in_team_id,
            in_channel_id=in_channel_id,
            not_in_channel_id=not_in_channel_id,
            in_group_id=in_group_id,
            not_in_group_id=not_in_group_id,
            group_constrained=group_constrained,
            without_team=without_team,
            inactive=inactive,
            active=active,
            role=role,
            roles=roles or [],
            channel_roles=channel_roles or [],
            team_roles=team_roles or [],
            sort=sort,
            page=page,
            per_page=per_page,
            updated_after=updated_after,
        )

        if view_restrictions:
            request.view_restrictions.CopyFrom(view_restrictions.to_proto())

        try:
            response = stub.GetUsers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_users_in_team(
        self, team_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[User]:
        """
        Get users in a team.

        Args:
            team_id: ID of the team.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of User objects in the team.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUsersInTeamRequest(
            team_id=team_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetUsersInTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_users_in_channel(
        self,
        channel_id: str,
        *,
        sort_by: str = "",
        page: int = 0,
        per_page: int = 60,
    ) -> List[User]:
        """
        Get users in a channel.

        Args:
            channel_id: ID of the channel.
            sort_by: Sort order (e.g., "username").
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of User objects in the channel.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUsersInChannelRequest(
            channel_id=channel_id,
            sort_by=sort_by,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetUsersInChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_user(self, user: User) -> User:
        """
        Update a user.

        Args:
            user: User object with updated fields. ID must be set.

        Returns:
            The updated User.

        Raises:
            NotFoundError: If user does not exist.
            ValidationError: If user data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserRequest(user=user.to_proto())

        try:
            response = stub.UpdateUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_users(
        self,
        term: str,
        *,
        team_id: str = "",
        not_in_team_id: str = "",
        in_channel_id: str = "",
        not_in_channel_id: str = "",
        in_group_id: str = "",
        not_in_group_id: str = "",
        group_constrained: bool = False,
        allow_inactive: bool = False,
        without_team: bool = False,
        limit: int = 100,
        role: str = "",
        roles: Optional[List[str]] = None,
        channel_roles: Optional[List[str]] = None,
        team_roles: Optional[List[str]] = None,
    ) -> List[User]:
        """
        Search for users.

        Args:
            term: Search term (matches username, email, first/last name).
            team_id: Filter to users in this team.
            not_in_team_id: Filter to users not in this team.
            in_channel_id: Filter to users in this channel.
            not_in_channel_id: Filter to users not in this channel.
            in_group_id: Filter to users in this group.
            not_in_group_id: Filter to users not in this group.
            group_constrained: Filter to group-constrained users.
            allow_inactive: Include inactive users in results.
            without_team: Filter to users without any team.
            limit: Maximum number of results.
            role: Filter by single role.
            roles: Filter by multiple roles.
            channel_roles: Filter by channel roles.
            team_roles: Filter by team roles.

        Returns:
            List of User objects matching the search.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.SearchUsersRequest(
            term=term,
            team_id=team_id,
            not_in_team_id=not_in_team_id,
            in_channel_id=in_channel_id,
            not_in_channel_id=not_in_channel_id,
            in_group_id=in_group_id,
            not_in_group_id=not_in_group_id,
            group_constrained=group_constrained,
            allow_inactive=allow_inactive,
            without_team=without_team,
            limit=limit,
            role=role,
            roles=roles or [],
            channel_roles=channel_roles or [],
            team_roles=team_roles or [],
        )

        try:
            response = stub.SearchUsers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # User Status
    # =========================================================================

    def get_user_status(self, user_id: str) -> UserStatus:
        """
        Get a user's status.

        Args:
            user_id: ID of the user.

        Returns:
            The UserStatus object.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUserStatusRequest(user_id=user_id)

        try:
            response = stub.GetUserStatus(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UserStatus.from_proto(response.status)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_user_statuses_by_ids(self, user_ids: List[str]) -> List[UserStatus]:
        """
        Get statuses for multiple users.

        Args:
            user_ids: List of user IDs.

        Returns:
            List of UserStatus objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetUserStatusesByIdsRequest(user_ids=user_ids)

        try:
            response = stub.GetUserStatusesByIds(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [UserStatus.from_proto(s) for s in response.statuses]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_user_status(self, user_id: str, status: str) -> UserStatus:
        """
        Update a user's status.

        Args:
            user_id: ID of the user.
            status: New status (online, away, dnd, offline).

        Returns:
            The updated UserStatus.

        Raises:
            NotFoundError: If user does not exist.
            ValidationError: If status is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserStatusRequest(
            user_id=user_id,
            status=status,
        )

        try:
            response = stub.UpdateUserStatus(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UserStatus.from_proto(response.status)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def set_user_status_timed_dnd(self, user_id: str, end_time: int) -> UserStatus:
        """
        Set a user's status to Do Not Disturb with a timer.

        Args:
            user_id: ID of the user.
            end_time: Unix timestamp when DND should end.

        Returns:
            The updated UserStatus.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.SetUserStatusTimedDNDRequest(
            user_id=user_id,
            end_time=end_time,
        )

        try:
            response = stub.SetUserStatusTimedDND(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UserStatus.from_proto(response.status)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_user_active(self, user_id: str, active: bool) -> None:
        """
        Update whether a user is active.

        Args:
            user_id: ID of the user.
            active: Whether the user should be active.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserActiveRequest(
            user_id=user_id,
            active=active,
        )

        try:
            response = stub.UpdateUserActive(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_user_custom_status(
        self, user_id: str, custom_status: CustomStatus
    ) -> None:
        """
        Update a user's custom status.

        Args:
            user_id: ID of the user.
            custom_status: The new custom status.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserCustomStatusRequest(
            user_id=user_id,
            custom_status=custom_status.to_proto(),
        )

        try:
            response = stub.UpdateUserCustomStatus(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def remove_user_custom_status(self, user_id: str) -> None:
        """
        Remove a user's custom status.

        Args:
            user_id: ID of the user.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.RemoveUserCustomStatusRequest(user_id=user_id)

        try:
            response = stub.RemoveUserCustomStatus(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Profile Image
    # =========================================================================

    def get_profile_image(self, user_id: str) -> bytes:
        """
        Get a user's profile image.

        Args:
            user_id: ID of the user.

        Returns:
            The profile image as bytes.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetProfileImageRequest(user_id=user_id)

        try:
            response = stub.GetProfileImage(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.image

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def set_profile_image(self, user_id: str, data: bytes) -> None:
        """
        Set a user's profile image.

        Args:
            user_id: ID of the user.
            data: Image data as bytes.

        Raises:
            NotFoundError: If user does not exist.
            ValidationError: If image data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.SetProfileImageRequest(
            user_id=user_id,
            data=data,
        )

        try:
            response = stub.SetProfileImage(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Permissions
    # =========================================================================

    def has_permission_to(self, user_id: str, permission_id: str) -> bool:
        """
        Check if a user has a system-wide permission.

        Args:
            user_id: ID of the user.
            permission_id: ID of the permission to check.

        Returns:
            True if user has the permission, False otherwise.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.HasPermissionToRequest(
            user_id=user_id,
            permission_id=permission_id,
        )

        try:
            response = stub.HasPermissionTo(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.has_permission

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def has_permission_to_team(
        self, user_id: str, team_id: str, permission_id: str
    ) -> bool:
        """
        Check if a user has a permission in a team.

        Args:
            user_id: ID of the user.
            team_id: ID of the team.
            permission_id: ID of the permission to check.

        Returns:
            True if user has the permission in the team, False otherwise.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.HasPermissionToTeamRequest(
            user_id=user_id,
            team_id=team_id,
            permission_id=permission_id,
        )

        try:
            response = stub.HasPermissionToTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.has_permission

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def has_permission_to_channel(
        self, user_id: str, channel_id: str, permission_id: str
    ) -> bool:
        """
        Check if a user has a permission in a channel.

        Args:
            user_id: ID of the user.
            channel_id: ID of the channel.
            permission_id: ID of the permission to check.

        Returns:
            True if user has the permission in the channel, False otherwise.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.HasPermissionToChannelRequest(
            user_id=user_id,
            channel_id=channel_id,
            permission_id=permission_id,
        )

        try:
            response = stub.HasPermissionToChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.has_permission

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # User Typing
    # =========================================================================

    def publish_user_typing(
        self, user_id: str, channel_id: str, parent_id: str = ""
    ) -> None:
        """
        Publish a user typing event.

        Args:
            user_id: ID of the user typing.
            channel_id: ID of the channel.
            parent_id: ID of the parent post if in a thread.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.PublishUserTypingRequest(
            user_id=user_id,
            channel_id=channel_id,
            parent_id=parent_id,
        )

        try:
            response = stub.PublishUserTyping(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # User Auth
    # =========================================================================

    def update_user_auth(self, user_id: str, user_auth: UserAuth) -> UserAuth:
        """
        Update a user's authentication data.

        Args:
            user_id: ID of the user.
            user_auth: The new authentication data.

        Returns:
            The updated UserAuth.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserAuthRequest(
            user_id=user_id,
            user_auth=user_auth.to_proto(),
        )

        try:
            response = stub.UpdateUserAuth(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UserAuth.from_proto(response.user_auth)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_user_roles(self, user_id: str, new_roles: str) -> User:
        """
        Update a user's roles.

        Args:
            user_id: ID of the user.
            new_roles: Space-separated list of new roles.

        Returns:
            The updated User.

        Raises:
            NotFoundError: If user does not exist.
            ValidationError: If roles are invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.UpdateUserRolesRequest(
            user_id=user_id,
            new_roles=new_roles,
        )

        try:
            response = stub.UpdateUserRoles(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return User.from_proto(response.user)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_ldap_user_attributes(
        self, user_id: str, attributes: List[str]
    ) -> Dict[str, str]:
        """
        Get LDAP attributes for a user.

        Args:
            user_id: ID of the user.
            attributes: List of attribute names to retrieve.

        Returns:
            Dictionary mapping attribute names to values.

        Raises:
            NotFoundError: If user does not exist or is not LDAP.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetLDAPUserAttributesRequest(
            user_id=user_id,
            attributes=attributes,
        )

        try:
            response = stub.GetLDAPUserAttributes(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return dict(response.attributes)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Sessions
    # =========================================================================

    def get_session(self, session_id: str) -> Session:
        """
        Get a session by ID.

        Args:
            session_id: ID of the session.

        Returns:
            The Session object.

        Raises:
            NotFoundError: If session does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.GetSessionRequest(session_id=session_id)

        try:
            response = stub.GetSession(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Session.from_proto(response.session)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def create_session(self, session: Session) -> Session:
        """
        Create a new session.

        Args:
            session: Session object with details for the new session.

        Returns:
            The created Session.

        Raises:
            ValidationError: If session data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateSessionRequest(session=session.to_proto())

        try:
            response = stub.CreateSession(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Session.from_proto(response.session)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def extend_session_expiry(self, session_id: str, new_expiry: int) -> None:
        """
        Extend a session's expiry time.

        Args:
            session_id: ID of the session.
            new_expiry: New expiry time as Unix timestamp.

        Raises:
            NotFoundError: If session does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.ExtendSessionExpiryRequest(
            session_id=session_id,
            new_expiry=new_expiry,
        )

        try:
            response = stub.ExtendSessionExpiry(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def revoke_session(self, session_id: str) -> None:
        """
        Revoke a session.

        Args:
            session_id: ID of the session to revoke.

        Raises:
            NotFoundError: If session does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.RevokeSessionRequest(session_id=session_id)

        try:
            response = stub.RevokeSession(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # User Access Tokens
    # =========================================================================

    def create_user_access_token(self, token: UserAccessToken) -> UserAccessToken:
        """
        Create a user access token.

        Args:
            token: UserAccessToken with user_id and description set.

        Returns:
            The created UserAccessToken with token field populated.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.CreateUserAccessTokenRequest(
            token=token.to_proto()
        )

        try:
            response = stub.CreateUserAccessToken(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UserAccessToken.from_proto(response.token)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def revoke_user_access_token(self, token_id: str) -> None:
        """
        Revoke a user access token.

        Args:
            token_id: ID of the token to revoke.

        Raises:
            NotFoundError: If token does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_user_team_pb2

        request = api_user_team_pb2.RevokeUserAccessTokenRequest(token_id=token_id)

        try:
            response = stub.RevokeUserAccessToken(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
