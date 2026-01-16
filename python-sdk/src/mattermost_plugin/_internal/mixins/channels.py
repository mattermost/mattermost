# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Channel API methods mixin for PluginAPIClient.

This module provides all channel-related API methods including:
- Channel CRUD operations
- Channel membership management
- Channel sidebar categories
"""

from __future__ import annotations

from typing import Dict, List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import (
    Channel,
    ChannelMember,
    ChannelStats,
    SidebarCategoryWithChannels,
    OrderedSidebarCategories,
)
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class ChannelsMixin:
    """Mixin providing channel-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Channel CRUD
    # =========================================================================

    def create_channel(self, channel: Channel) -> Channel:
        """
        Create a new channel.

        Args:
            channel: Channel object with details for the new channel.
                     The ID field should be empty as it will be assigned.

        Returns:
            The created Channel with assigned ID.

        Raises:
            ValidationError: If channel data is invalid.
            AlreadyExistsError: If channel name already exists in the team.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.CreateChannelRequest(channel=channel.to_proto())

        try:
            response = stub.CreateChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_channel(self, channel_id: str) -> None:
        """
        Delete a channel.

        Args:
            channel_id: ID of the channel to delete.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.DeleteChannelRequest(channel_id=channel_id)

        try:
            response = stub.DeleteChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel(self, channel_id: str) -> Channel:
        """
        Get a channel by ID.

        Args:
            channel_id: ID of the channel to retrieve.

        Returns:
            The Channel object.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelRequest(channel_id=channel_id)

        try:
            response = stub.GetChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_by_name(
        self, team_id: str, name: str, *, include_deleted: bool = False
    ) -> Channel:
        """
        Get a channel by its name.

        Args:
            team_id: ID of the team the channel belongs to.
            name: URL-safe name of the channel.
            include_deleted: Whether to include deleted channels.

        Returns:
            The Channel object.

        Raises:
            NotFoundError: If channel with name does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelByNameRequest(
            team_id=team_id,
            name=name,
            include_deleted=include_deleted,
        )

        try:
            response = stub.GetChannelByName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_by_name_for_team_name(
        self, team_name: str, channel_name: str, *, include_deleted: bool = False
    ) -> Channel:
        """
        Get a channel by its name and team name.

        Args:
            team_name: URL-safe name of the team.
            channel_name: URL-safe name of the channel.
            include_deleted: Whether to include deleted channels.

        Returns:
            The Channel object.

        Raises:
            NotFoundError: If channel or team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelByNameForTeamNameRequest(
            team_name=team_name,
            channel_name=channel_name,
            include_deleted=include_deleted,
        )

        try:
            response = stub.GetChannelByNameForTeamName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_public_channels_for_team(
        self, team_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[Channel]:
        """
        Get public channels in a team.

        Args:
            team_id: ID of the team.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of public Channel objects.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPublicChannelsForTeamRequest(
            team_id=team_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPublicChannelsForTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Channel.from_proto(c) for c in response.channels]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channels_for_team_for_user(
        self, team_id: str, user_id: str, *, include_deleted: bool = False
    ) -> List[Channel]:
        """
        Get channels in a team for a specific user.

        Args:
            team_id: ID of the team.
            user_id: ID of the user.
            include_deleted: Whether to include deleted channels.

        Returns:
            List of Channel objects the user is a member of.

        Raises:
            NotFoundError: If team or user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelsForTeamForUserRequest(
            team_id=team_id,
            user_id=user_id,
            include_deleted=include_deleted,
        )

        try:
            response = stub.GetChannelsForTeamForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Channel.from_proto(c) for c in response.channels]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_channel(self, channel: Channel) -> Channel:
        """
        Update a channel.

        Args:
            channel: Channel object with updated fields. ID must be set.

        Returns:
            The updated Channel.

        Raises:
            NotFoundError: If channel does not exist.
            ValidationError: If channel data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdateChannelRequest(channel=channel.to_proto())

        try:
            response = stub.UpdateChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_channels(self, team_id: str, term: str) -> List[Channel]:
        """
        Search for channels in a team.

        Args:
            team_id: ID of the team.
            term: Search term (matches channel name and display name).

        Returns:
            List of Channel objects matching the search.

        Raises:
            NotFoundError: If team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.SearchChannelsRequest(
            team_id=team_id,
            term=term,
        )

        try:
            response = stub.SearchChannels(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Channel.from_proto(c) for c in response.channels]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_direct_channel(self, user_id_1: str, user_id_2: str) -> Channel:
        """
        Get or create a direct message channel between two users.

        Args:
            user_id_1: ID of the first user.
            user_id_2: ID of the second user.

        Returns:
            The direct message Channel.

        Raises:
            NotFoundError: If either user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetDirectChannelRequest(
            user_id_1=user_id_1,
            user_id_2=user_id_2,
        )

        try:
            response = stub.GetDirectChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_group_channel(self, user_ids: List[str]) -> Channel:
        """
        Get or create a group message channel.

        Args:
            user_ids: List of user IDs for the group channel.

        Returns:
            The group message Channel.

        Raises:
            NotFoundError: If any user does not exist.
            ValidationError: If user count is invalid (must be 3-8).
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetGroupChannelRequest(user_ids=user_ids)

        try:
            response = stub.GetGroupChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Channel.from_proto(response.channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_stats(self, channel_id: str) -> ChannelStats:
        """
        Get statistics for a channel.

        Args:
            channel_id: ID of the channel.

        Returns:
            The ChannelStats object.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelStatsRequest(channel_id=channel_id)

        try:
            response = stub.GetChannelStats(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelStats.from_proto(response.channel_stats)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Channel Membership
    # =========================================================================

    def add_channel_member(self, channel_id: str, user_id: str) -> ChannelMember:
        """
        Add a user to a channel.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user to add.

        Returns:
            The created ChannelMember.

        Raises:
            NotFoundError: If channel or user does not exist.
            AlreadyExistsError: If user is already a member.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.AddChannelMemberRequest(
            channel_id=channel_id,
            user_id=user_id,
        )

        try:
            response = stub.AddChannelMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelMember.from_proto(response.channel_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def add_user_to_channel(
        self, channel_id: str, user_id: str, as_user_id: str = ""
    ) -> ChannelMember:
        """
        Add a user to a channel with permission checking.

        This method performs permission checks based on as_user_id.
        Use this when you need to add users on behalf of another user.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user to add.
            as_user_id: ID of the user performing the action (for permission checks).

        Returns:
            The created ChannelMember.

        Raises:
            NotFoundError: If channel or user does not exist.
            PermissionDeniedError: If as_user_id doesn't have permission.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.AddUserToChannelRequest(
            channel_id=channel_id,
            user_id=user_id,
            as_user_id=as_user_id,
        )

        try:
            response = stub.AddUserToChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelMember.from_proto(response.channel_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_channel_member(self, channel_id: str, user_id: str) -> None:
        """
        Remove a user from a channel.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user to remove.

        Raises:
            NotFoundError: If channel membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.DeleteChannelMemberRequest(
            channel_id=channel_id,
            user_id=user_id,
        )

        try:
            response = stub.DeleteChannelMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_member(self, channel_id: str, user_id: str) -> ChannelMember:
        """
        Get a channel membership.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user.

        Returns:
            The ChannelMember object.

        Raises:
            NotFoundError: If membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelMemberRequest(
            channel_id=channel_id,
            user_id=user_id,
        )

        try:
            response = stub.GetChannelMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelMember.from_proto(response.channel_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_members(
        self, channel_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[ChannelMember]:
        """
        Get channel members.

        Args:
            channel_id: ID of the channel.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of ChannelMember objects.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelMembersRequest(
            channel_id=channel_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetChannelMembers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [ChannelMember.from_proto(m) for m in response.channel_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_members_by_ids(
        self, channel_id: str, user_ids: List[str]
    ) -> List[ChannelMember]:
        """
        Get channel members by user IDs.

        Args:
            channel_id: ID of the channel.
            user_ids: List of user IDs.

        Returns:
            List of ChannelMember objects (may be shorter if some not found).

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelMembersByIdsRequest(
            channel_id=channel_id,
            user_ids=user_ids,
        )

        try:
            response = stub.GetChannelMembersByIds(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [ChannelMember.from_proto(m) for m in response.channel_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_members_for_user(
        self, team_id: str, user_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[ChannelMember]:
        """
        Get all channel memberships for a user in a team.

        Args:
            team_id: ID of the team.
            user_id: ID of the user.
            page: Page number (0-indexed).
            per_page: Results per page (default 60).

        Returns:
            List of ChannelMember objects.

        Raises:
            NotFoundError: If team or user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelMembersForUserRequest(
            team_id=team_id,
            user_id=user_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetChannelMembersForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [ChannelMember.from_proto(m) for m in response.channel_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_channel_member_roles(
        self, channel_id: str, user_id: str, new_roles: str
    ) -> ChannelMember:
        """
        Update a channel member's roles.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user.
            new_roles: Space-separated list of new roles.

        Returns:
            The updated ChannelMember.

        Raises:
            NotFoundError: If membership does not exist.
            ValidationError: If roles are invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdateChannelMemberRolesRequest(
            channel_id=channel_id,
            user_id=user_id,
            new_roles=new_roles,
        )

        try:
            response = stub.UpdateChannelMemberRoles(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelMember.from_proto(response.channel_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_channel_member_notifications(
        self, channel_id: str, user_id: str, notifications: Dict[str, str]
    ) -> ChannelMember:
        """
        Update a channel member's notification preferences.

        Args:
            channel_id: ID of the channel.
            user_id: ID of the user.
            notifications: Dictionary of notification settings.

        Returns:
            The updated ChannelMember.

        Raises:
            NotFoundError: If membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdateChannelMemberNotificationsRequest(
            channel_id=channel_id,
            user_id=user_id,
            notifications=notifications,
        )

        try:
            response = stub.UpdateChannelMemberNotifications(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return ChannelMember.from_proto(response.channel_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def patch_channel_members_notifications(
        self,
        members: List[tuple],
        notify_props: Dict[str, str],
    ) -> None:
        """
        Patch notification settings for multiple channel members.

        Args:
            members: List of (channel_id, user_id) tuples identifying members.
            notify_props: Dictionary of notification properties to set.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        member_identifiers = [
            api_channel_post_pb2.ChannelMemberIdentifier(
                channel_id=m[0], user_id=m[1]
            )
            for m in members
        ]

        request = api_channel_post_pb2.PatchChannelMembersNotificationsRequest(
            members=member_identifiers,
            notify_props=notify_props,
        )

        try:
            response = stub.PatchChannelMembersNotifications(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Channel Sidebar Categories
    # =========================================================================

    def create_channel_sidebar_category(
        self, user_id: str, team_id: str, new_category: SidebarCategoryWithChannels
    ) -> SidebarCategoryWithChannels:
        """
        Create a new sidebar category.

        Args:
            user_id: ID of the user.
            team_id: ID of the team.
            new_category: The category to create.

        Returns:
            The created SidebarCategoryWithChannels.

        Raises:
            NotFoundError: If user or team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.CreateChannelSidebarCategoryRequest(
            user_id=user_id,
            team_id=team_id,
            new_category=new_category.to_proto(),
        )

        try:
            response = stub.CreateChannelSidebarCategory(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return SidebarCategoryWithChannels.from_proto(response.category)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_channel_sidebar_categories(
        self, user_id: str, team_id: str
    ) -> OrderedSidebarCategories:
        """
        Get sidebar categories for a user in a team.

        Args:
            user_id: ID of the user.
            team_id: ID of the team.

        Returns:
            The OrderedSidebarCategories with all categories and order.

        Raises:
            NotFoundError: If user or team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetChannelSidebarCategoriesRequest(
            user_id=user_id,
            team_id=team_id,
        )

        try:
            response = stub.GetChannelSidebarCategories(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return OrderedSidebarCategories.from_proto(response.categories)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_channel_sidebar_categories(
        self, user_id: str, team_id: str, categories: List[SidebarCategoryWithChannels]
    ) -> List[SidebarCategoryWithChannels]:
        """
        Update sidebar categories for a user in a team.

        Args:
            user_id: ID of the user.
            team_id: ID of the team.
            categories: List of categories to update.

        Returns:
            The updated list of SidebarCategoryWithChannels.

        Raises:
            NotFoundError: If user or team does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.UpdateChannelSidebarCategoriesRequest(
            user_id=user_id,
            team_id=team_id,
            categories=[c.to_proto() for c in categories],
        )

        try:
            response = stub.UpdateChannelSidebarCategories(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [SidebarCategoryWithChannels.from_proto(c) for c in response.categories]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
