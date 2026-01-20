# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Group API methods mixin for PluginAPIClient.

This module provides all group-related API methods including:
- Group CRUD operations
- Group membership management
- Group syncables (team/channel sync)
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import Group, GroupMember, GroupSyncable, User
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class GroupsMixin:
    """Mixin providing group-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Group CRUD
    # =========================================================================

    def create_group(self, group: Group) -> Group:
        """
        Create a new group.

        Args:
            group: Group object with name and display_name.

        Returns:
            The created Group.

        Raises:
            ValidationError: If group data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CreateGroupRequest(group=group.to_proto())

        try:
            response = stub.CreateGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_group(self, group_id: str) -> Group:
        """
        Get a group by ID.

        Args:
            group_id: ID of the group.

        Returns:
            The Group object.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupRequest(group_id=group_id)

        try:
            response = stub.GetGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_group_by_name(self, name: str) -> Group:
        """
        Get a group by name.

        Args:
            name: Name of the group.

        Returns:
            The Group object.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupByNameRequest(name=name)

        try:
            response = stub.GetGroupByName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_group_by_remote_id(self, remote_id: str, group_source: str) -> Group:
        """
        Get a group by remote ID and source.

        Args:
            remote_id: Remote ID of the group (e.g., LDAP DN).
            group_source: Source of the group ("ldap", "custom").

        Returns:
            The Group object.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupByRemoteIDRequest(
            remote_id=remote_id,
            group_source=group_source,
        )

        try:
            response = stub.GetGroupByRemoteID(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_group(self, group: Group) -> Group:
        """
        Update a group.

        Args:
            group: Group object with ID and updated fields.

        Returns:
            The updated Group.

        Raises:
            NotFoundError: If group does not exist.
            ValidationError: If group data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdateGroupRequest(group=group.to_proto())

        try:
            response = stub.UpdateGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_group(self, group_id: str) -> Group:
        """
        Delete a group (soft delete).

        Args:
            group_id: ID of the group to delete.

        Returns:
            The deleted Group.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteGroupRequest(group_id=group_id)

        try:
            response = stub.DeleteGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def restore_group(self, group_id: str) -> Group:
        """
        Restore a deleted group.

        Args:
            group_id: ID of the group to restore.

        Returns:
            The restored Group.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RestoreGroupRequest(group_id=group_id)

        try:
            response = stub.RestoreGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Group.from_proto(response.group)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Group Queries
    # =========================================================================

    def get_groups(
        self,
        *,
        page: int = 0,
        per_page: int = 60,
    ) -> List[Group]:
        """
        Get a list of groups.

        Args:
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            List of Group objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupsRequest(
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetGroups(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Group.from_proto(g) for g in response.groups]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_groups_by_source(self, source: str) -> List[Group]:
        """
        Get groups by source.

        Args:
            source: Source of groups ("ldap", "custom").

        Returns:
            List of Group objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupsBySourceRequest(group_source=source)

        try:
            response = stub.GetGroupsBySource(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Group.from_proto(g) for g in response.groups]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_groups_for_user(self, user_id: str) -> List[Group]:
        """
        Get groups that a user is a member of.

        Args:
            user_id: ID of the user.

        Returns:
            List of Group objects.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupsForUserRequest(user_id=user_id)

        try:
            response = stub.GetGroupsForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Group.from_proto(g) for g in response.groups]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Group Membership
    # =========================================================================

    def get_group_member_users(
        self, group_id: str, *, page: int = 0, per_page: int = 60
    ) -> List[User]:
        """
        Get users who are members of a group.

        Args:
            group_id: ID of the group.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            List of User objects.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupMemberUsersRequest(
            group_id=group_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetGroupMemberUsers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [User.from_proto(u) for u in response.users]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upsert_group_member(self, group_id: str, user_id: str) -> GroupMember:
        """
        Add or update a user's membership in a group.

        Args:
            group_id: ID of the group.
            user_id: ID of the user.

        Returns:
            The GroupMember object.

        Raises:
            NotFoundError: If group or user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpsertGroupMemberRequest(
            group_id=group_id,
            user_id=user_id,
        )

        try:
            response = stub.UpsertGroupMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupMember.from_proto(response.group_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upsert_group_members(
        self, group_id: str, user_ids: List[str]
    ) -> List[GroupMember]:
        """
        Add or update multiple users' membership in a group.

        Args:
            group_id: ID of the group.
            user_ids: List of user IDs.

        Returns:
            List of GroupMember objects.

        Raises:
            NotFoundError: If group or users do not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpsertGroupMembersRequest(
            group_id=group_id,
            user_ids=user_ids,
        )

        try:
            response = stub.UpsertGroupMembers(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [GroupMember.from_proto(m) for m in response.group_members]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_group_member(self, group_id: str, user_id: str) -> GroupMember:
        """
        Remove a user from a group.

        Args:
            group_id: ID of the group.
            user_id: ID of the user.

        Returns:
            The deleted GroupMember.

        Raises:
            NotFoundError: If membership does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteGroupMemberRequest(
            group_id=group_id,
            user_id=user_id,
        )

        try:
            response = stub.DeleteGroupMember(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupMember.from_proto(response.group_member)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Group Syncables
    # =========================================================================

    def get_group_syncable(
        self, group_id: str, syncable_id: str, syncable_type: str
    ) -> GroupSyncable:
        """
        Get a group syncable (team or channel sync).

        Args:
            group_id: ID of the group.
            syncable_id: ID of the team or channel.
            syncable_type: "team" or "channel".

        Returns:
            The GroupSyncable object.

        Raises:
            NotFoundError: If syncable does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupSyncableRequest(
            group_id=group_id,
            syncable_id=syncable_id,
            syncable_type=syncable_type,
        )

        try:
            response = stub.GetGroupSyncable(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupSyncable.from_proto(response.group_syncable)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_group_syncables(
        self, group_id: str, syncable_type: str
    ) -> List[GroupSyncable]:
        """
        Get all syncables for a group.

        Args:
            group_id: ID of the group.
            syncable_type: "team" or "channel".

        Returns:
            List of GroupSyncable objects.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetGroupSyncablesRequest(
            group_id=group_id,
            syncable_type=syncable_type,
        )

        try:
            response = stub.GetGroupSyncables(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [GroupSyncable.from_proto(s) for s in response.group_syncables]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upsert_group_syncable(self, syncable: GroupSyncable) -> GroupSyncable:
        """
        Create or update a group syncable.

        Args:
            syncable: GroupSyncable object.

        Returns:
            The created/updated GroupSyncable.

        Raises:
            ValidationError: If syncable data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpsertGroupSyncableRequest(
            group_syncable=syncable.to_proto()
        )

        try:
            response = stub.UpsertGroupSyncable(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupSyncable.from_proto(response.group_syncable)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_group_syncable(self, syncable: GroupSyncable) -> GroupSyncable:
        """
        Update a group syncable.

        Args:
            syncable: GroupSyncable object with updated fields.

        Returns:
            The updated GroupSyncable.

        Raises:
            NotFoundError: If syncable does not exist.
            ValidationError: If syncable data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdateGroupSyncableRequest(
            group_syncable=syncable.to_proto()
        )

        try:
            response = stub.UpdateGroupSyncable(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupSyncable.from_proto(response.group_syncable)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_group_syncable(
        self, group_id: str, syncable_id: str, syncable_type: str
    ) -> GroupSyncable:
        """
        Delete a group syncable.

        Args:
            group_id: ID of the group.
            syncable_id: ID of the team or channel.
            syncable_type: "team" or "channel".

        Returns:
            The deleted GroupSyncable.

        Raises:
            NotFoundError: If syncable does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteGroupSyncableRequest(
            group_id=group_id,
            syncable_id=syncable_id,
            syncable_type=syncable_type,
        )

        try:
            response = stub.DeleteGroupSyncable(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return GroupSyncable.from_proto(response.group_syncable)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Default Memberships
    # =========================================================================

    def create_default_syncable_memberships(
        self,
        *,
        since: int = 0,
        scope_teams: bool = False,
        scope_channels: bool = False,
        re_add_removed_members: bool = False,
    ) -> None:
        """
        Create default memberships for group syncables.

        Args:
            since: Only process changes since this timestamp.
            scope_teams: Include team syncables.
            scope_channels: Include channel syncables.
            re_add_removed_members: Re-add members that were previously removed.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        params = api_remaining_pb2.CreateDefaultMembershipParams(
            since=since,
            scope_teams=scope_teams,
            scope_channels=scope_channels,
            re_add_removed_members=re_add_removed_members,
        )

        request = api_remaining_pb2.CreateDefaultSyncableMembershipsRequest(params=params)

        try:
            response = stub.CreateDefaultSyncableMemberships(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_group_constrained_memberships(self) -> None:
        """
        Delete group-constrained memberships.

        Removes team and channel members who are no longer in any group
        that is synced to that team or channel.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteGroupConstrainedMembershipsRequest()

        try:
            response = stub.DeleteGroupConstrainedMemberships(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
