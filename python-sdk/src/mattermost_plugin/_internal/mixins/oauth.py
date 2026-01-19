# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
OAuth API methods mixin for PluginAPIClient.

This module provides all OAuth-related API methods including:
- OAuth app CRUD operations
"""

from __future__ import annotations

from typing import Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import OAuthApp
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class OAuthMixin:
    """Mixin providing OAuth-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # OAuth App CRUD
    # =========================================================================

    def create_o_auth_app(self, app: OAuthApp) -> OAuthApp:
        """
        Create an OAuth application.

        Args:
            app: OAuthApp object with name and other settings.

        Returns:
            The created OAuthApp with assigned ID.

        Raises:
            ValidationError: If app data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CreateOAuthAppRequest(app=app.to_proto())

        try:
            response = stub.CreateOAuthApp(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return OAuthApp.from_proto(response.app)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_o_auth_app(self, app_id: str) -> OAuthApp:
        """
        Get an OAuth application by ID.

        Args:
            app_id: ID of the OAuth app.

        Returns:
            The OAuthApp object.

        Raises:
            NotFoundError: If app does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetOAuthAppRequest(app_id=app_id)

        try:
            response = stub.GetOAuthApp(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return OAuthApp.from_proto(response.app)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_o_auth_app(self, app: OAuthApp) -> OAuthApp:
        """
        Update an OAuth application.

        Args:
            app: OAuthApp object with ID and updated fields.

        Returns:
            The updated OAuthApp.

        Raises:
            NotFoundError: If app does not exist.
            ValidationError: If app data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdateOAuthAppRequest(app=app.to_proto())

        try:
            response = stub.UpdateOAuthApp(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return OAuthApp.from_proto(response.app)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_o_auth_app(self, app_id: str) -> None:
        """
        Delete an OAuth application.

        Args:
            app_id: ID of the OAuth app to delete.

        Raises:
            NotFoundError: If app does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeleteOAuthAppRequest(app_id=app_id)

        try:
            response = stub.DeleteOAuthApp(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
