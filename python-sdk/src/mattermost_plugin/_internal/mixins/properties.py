# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Property API methods mixin for PluginAPIClient.

This module provides all property-related API methods including:
- Property group registration
- Property field CRUD
- Property value CRUD
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class PropertiesMixin:
    """Mixin providing property-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Property Group Methods
    # =========================================================================

    def register_property_group(self, group_id: str, group_name: str) -> bytes:
        """
        Register a property group.

        Args:
            group_id: ID for the property group.
            group_name: Display name for the property group.

        Returns:
            JSON-encoded property group data.

        Raises:
            ValidationError: If group data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RegisterPropertyGroupRequest(
            group_id=group_id,
            group_name=group_name,
        )

        try:
            response = stub.RegisterPropertyGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.group_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_group(self, group_id: str) -> bytes:
        """
        Get a property group by ID.

        Args:
            group_id: ID of the property group.

        Returns:
            JSON-encoded property group data.

        Raises:
            NotFoundError: If group does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyGroupRequest(group_id=group_id)

        try:
            response = stub.GetPropertyGroup(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.group_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Property Field Methods
    # =========================================================================

    def create_property_field(self, field_json: bytes) -> bytes:
        """
        Create a property field.

        Args:
            field_json: JSON-encoded property field data.

        Returns:
            JSON-encoded created property field data.

        Raises:
            ValidationError: If field data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CreatePropertyFieldRequest(field_json=field_json)

        try:
            response = stub.CreatePropertyField(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.field_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_field(self, field_id: str) -> bytes:
        """
        Get a property field by ID.

        Args:
            field_id: ID of the property field.

        Returns:
            JSON-encoded property field data.

        Raises:
            NotFoundError: If field does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyFieldRequest(field_id=field_id)

        try:
            response = stub.GetPropertyField(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.field_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_field_by_name(self, group_id: str, name: str) -> bytes:
        """
        Get a property field by name.

        Args:
            group_id: ID of the property group.
            name: Name of the property field.

        Returns:
            JSON-encoded property field data.

        Raises:
            NotFoundError: If field does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyFieldByNameRequest(
            group_id=group_id,
            name=name,
        )

        try:
            response = stub.GetPropertyFieldByName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.field_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_fields(
        self, group_id: str, *, page: int = 0, per_page: int = 60
    ) -> bytes:
        """
        Get property fields for a group.

        Args:
            group_id: ID of the property group.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            JSON-encoded list of property fields.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyFieldsRequest(
            group_id=group_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPropertyFields(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.fields_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_property_field(self, field_json: bytes) -> bytes:
        """
        Update a property field.

        Args:
            field_json: JSON-encoded property field data.

        Returns:
            JSON-encoded updated property field data.

        Raises:
            NotFoundError: If field does not exist.
            ValidationError: If field data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdatePropertyFieldRequest(field_json=field_json)

        try:
            response = stub.UpdatePropertyField(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.field_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_property_fields(self, fields_json: bytes) -> bytes:
        """
        Update multiple property fields.

        Args:
            fields_json: JSON-encoded list of property fields.

        Returns:
            JSON-encoded list of updated property fields.

        Raises:
            ValidationError: If field data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdatePropertyFieldsRequest(fields_json=fields_json)

        try:
            response = stub.UpdatePropertyFields(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.fields_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_property_field(self, field_id: str) -> None:
        """
        Delete a property field.

        Args:
            field_id: ID of the property field to delete.

        Raises:
            NotFoundError: If field does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeletePropertyFieldRequest(field_id=field_id)

        try:
            response = stub.DeletePropertyField(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_property_fields(
        self, group_id: str, search_term: str, *, page: int = 0, per_page: int = 60
    ) -> bytes:
        """
        Search property fields.

        Args:
            group_id: ID of the property group.
            search_term: Search term.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            JSON-encoded list of matching property fields.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.SearchPropertyFieldsRequest(
            group_id=group_id,
            search_term=search_term,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.SearchPropertyFields(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.fields_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def count_property_fields(self, group_id: str) -> int:
        """
        Count property fields in a group.

        Args:
            group_id: ID of the property group.

        Returns:
            Number of property fields.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CountPropertyFieldsRequest(group_id=group_id)

        try:
            response = stub.CountPropertyFields(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.count

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def count_property_fields_for_target(self, target_id: str, target_type: str) -> int:
        """
        Count property fields for a target.

        Args:
            target_id: ID of the target.
            target_type: Type of the target.

        Returns:
            Number of property fields.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CountPropertyFieldsForTargetRequest(
            target_id=target_id,
            target_type=target_type,
        )

        try:
            response = stub.CountPropertyFieldsForTarget(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.count

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Property Value Methods
    # =========================================================================

    def create_property_value(self, value_json: bytes) -> bytes:
        """
        Create a property value.

        Args:
            value_json: JSON-encoded property value data.

        Returns:
            JSON-encoded created property value data.

        Raises:
            ValidationError: If value data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.CreatePropertyValueRequest(value_json=value_json)

        try:
            response = stub.CreatePropertyValue(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.value_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_value(self, value_id: str) -> bytes:
        """
        Get a property value by ID.

        Args:
            value_id: ID of the property value.

        Returns:
            JSON-encoded property value data.

        Raises:
            NotFoundError: If value does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyValueRequest(value_id=value_id)

        try:
            response = stub.GetPropertyValue(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.value_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_property_values(
        self, group_id: str, target_id: str, *, page: int = 0, per_page: int = 60
    ) -> bytes:
        """
        Get property values for a target.

        Args:
            group_id: ID of the property group.
            target_id: ID of the target.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            JSON-encoded list of property values.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetPropertyValuesRequest(
            group_id=group_id,
            target_id=target_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPropertyValues(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.values_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_property_value(self, value_json: bytes) -> bytes:
        """
        Update a property value.

        Args:
            value_json: JSON-encoded property value data.

        Returns:
            JSON-encoded updated property value data.

        Raises:
            NotFoundError: If value does not exist.
            ValidationError: If value data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdatePropertyValueRequest(value_json=value_json)

        try:
            response = stub.UpdatePropertyValue(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.value_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_property_values(self, values_json: bytes) -> bytes:
        """
        Update multiple property values.

        Args:
            values_json: JSON-encoded list of property values.

        Returns:
            JSON-encoded list of updated property values.

        Raises:
            ValidationError: If value data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdatePropertyValuesRequest(values_json=values_json)

        try:
            response = stub.UpdatePropertyValues(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.values_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upsert_property_value(self, value_json: bytes) -> bytes:
        """
        Upsert a property value.

        Args:
            value_json: JSON-encoded property value data.

        Returns:
            JSON-encoded upserted property value data.

        Raises:
            ValidationError: If value data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpsertPropertyValueRequest(value_json=value_json)

        try:
            response = stub.UpsertPropertyValue(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.value_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upsert_property_values(self, values_json: bytes) -> bytes:
        """
        Upsert multiple property values.

        Args:
            values_json: JSON-encoded list of property values.

        Returns:
            JSON-encoded list of upserted property values.

        Raises:
            ValidationError: If value data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpsertPropertyValuesRequest(values_json=values_json)

        try:
            response = stub.UpsertPropertyValues(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.values_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_property_value(self, value_id: str) -> None:
        """
        Delete a property value.

        Args:
            value_id: ID of the property value to delete.

        Raises:
            NotFoundError: If value does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeletePropertyValueRequest(value_id=value_id)

        try:
            response = stub.DeletePropertyValue(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_property_values_for_field(self, field_id: str) -> None:
        """
        Delete all property values for a field.

        Args:
            field_id: ID of the property field.

        Raises:
            NotFoundError: If field does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeletePropertyValuesForFieldRequest(
            field_id=field_id
        )

        try:
            response = stub.DeletePropertyValuesForField(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def delete_property_values_for_target(
        self, target_id: str, target_type: str
    ) -> None:
        """
        Delete all property values for a target.

        Args:
            target_id: ID of the target.
            target_type: Type of the target.

        Raises:
            NotFoundError: If target does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.DeletePropertyValuesForTargetRequest(
            target_id=target_id,
            target_type=target_type,
        )

        try:
            response = stub.DeletePropertyValuesForTarget(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_property_values(
        self,
        group_id: str,
        search_term: str,
        *,
        target_id: str = "",
        page: int = 0,
        per_page: int = 60,
    ) -> bytes:
        """
        Search property values.

        Args:
            group_id: ID of the property group.
            search_term: Search term.
            target_id: Optional target ID to filter by.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            JSON-encoded list of matching property values.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.SearchPropertyValuesRequest(
            group_id=group_id,
            search_term=search_term,
            target_id=target_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.SearchPropertyValues(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.values_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
