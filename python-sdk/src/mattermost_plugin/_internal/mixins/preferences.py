# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Preference API methods mixin for PluginAPIClient.

This module provides all user preference-related API methods including:
- Get preferences
- Update preferences
- Delete preferences
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import Preference
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class PreferencesMixin:
    """Mixin providing preference-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Preference Methods
    # =========================================================================

    def get_preference_for_user(
        self, user_id: str, category: str, name: str
    ) -> Preference:
        """
        Get a specific preference for a user.

        Args:
            user_id: ID of the user.
            category: Preference category.
            name: Preference name.

        Returns:
            The Preference object.

        Raises:
            NotFoundError: If preference does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPreferenceForUserRequest(
            user_id=user_id,
            category=category,
            name=name,
        )

        try:
            response = stub.GetPreferenceForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Preference.from_proto(response.preference)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_preferences_for_user(self, user_id: str) -> List[Preference]:
        """
        Get all preferences for a user.

        Args:
            user_id: ID of the user.

        Returns:
            List of Preference objects.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPreferencesForUserRequest(user_id=user_id)

        try:
            response = stub.GetPreferencesForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Preference.from_proto(p) for p in response.preferences]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_preferences_for_user(
        self, user_id: str, preferences: List[Preference]
    ) -> None:
        """
        Update preferences for a user.

        Args:
            user_id: ID of the user.
            preferences: List of preferences to update.

        Raises:
            NotFoundError: If user does not exist.
            ValidationError: If preferences are invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> prefs = [
            ...     Preference(user_id="u1", category="theme", name="dark", value="true")
            ... ]
            >>> client.update_preferences_for_user("u1", prefs)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdatePreferencesForUserRequest(
            user_id=user_id,
            preferences=[p.to_proto() for p in preferences],
        )

        try:
            response = stub.UpdatePreferencesForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_preferences_for_user(
        self, user_id: str, preferences: List[Preference]
    ) -> None:
        """
        Delete preferences for a user.

        Args:
            user_id: ID of the user.
            preferences: List of preferences to delete (category and name required).

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeletePreferencesForUserRequest(
            user_id=user_id,
            preferences=[p.to_proto() for p in preferences],
        )

        try:
            response = stub.DeletePreferencesForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
