# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
KV Store API methods mixin for PluginAPIClient.

This module provides all key-value store related API methods including:
- Basic KV operations (set, get, delete)
- Atomic operations (compare-and-set, compare-and-delete)
- Expiring keys
- Key listing
"""

from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import PluginKVSetOptions
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class KVStoreMixin:
    """Mixin providing KV store related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Basic KV Operations
    # =========================================================================

    def kv_set(self, key: str, value: bytes) -> None:
        """
        Set a value in the plugin's key-value store.

        The key-value store is scoped to the plugin - keys from different
        plugins do not collide.

        Args:
            key: The key to set. Max length is 50 characters.
            value: The value to store as bytes.

        Raises:
            ValidationError: If key is too long or value is too large.
            PluginAPIError: If the API call fails.

        Example:
            >>> client.kv_set("user_preference", b'{"theme": "dark"}')
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVSetRequest(
            key=key,
            value=value,
        )

        try:
            response = stub.KVSet(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_get(self, key: str) -> Optional[bytes]:
        """
        Get a value from the plugin's key-value store.

        Args:
            key: The key to retrieve.

        Returns:
            The value as bytes, or None if the key does not exist.

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> data = client.kv_get("user_preference")
            >>> if data:
            ...     config = json.loads(data)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVGetRequest(key=key)

        try:
            response = stub.KVGet(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            # Empty bytes means key not found
            if not response.value:
                return None
            return response.value

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_delete(self, key: str) -> None:
        """
        Delete a key from the plugin's key-value store.

        Args:
            key: The key to delete.

        Raises:
            PluginAPIError: If the API call fails.

        Note:
            This operation is idempotent - deleting a non-existent key
            does not raise an error.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVDeleteRequest(key=key)

        try:
            response = stub.KVDelete(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_delete_all(self) -> None:
        """
        Delete all keys from the plugin's key-value store.

        WARNING: This deletes all data stored by the plugin!

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVDeleteAllRequest()

        try:
            response = stub.KVDeleteAll(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_list(self, *, page: int = 0, per_page: int = 100) -> List[str]:
        """
        List keys in the plugin's key-value store.

        Args:
            page: Page number (0-indexed).
            per_page: Keys per page (default 100).

        Returns:
            List of key names.

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> keys = client.kv_list(page=0, per_page=50)
            >>> for key in keys:
            ...     print(key)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVListRequest(
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.KVList(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return list(response.keys)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Expiring Keys
    # =========================================================================

    def kv_set_with_expiry(self, key: str, value: bytes, expire_in_seconds: int) -> None:
        """
        Set a value with an expiration time.

        After the specified number of seconds, the key will be automatically
        deleted.

        Args:
            key: The key to set.
            value: The value to store as bytes.
            expire_in_seconds: Seconds until the key expires.

        Raises:
            ValidationError: If key or value is invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> # Cache a value for 5 minutes
            >>> client.kv_set_with_expiry("cache_key", data, 300)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVSetWithExpiryRequest(
            key=key,
            value=value,
            expire_in_seconds=expire_in_seconds,
        )

        try:
            response = stub.KVSetWithExpiry(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Atomic Operations
    # =========================================================================

    def kv_compare_and_set(
        self,
        key: str,
        old_value: Optional[bytes],
        new_value: bytes,
    ) -> bool:
        """
        Atomically set a value only if it matches the expected old value.

        This is useful for implementing optimistic locking patterns.

        Args:
            key: The key to set.
            old_value: Expected current value (None for key must not exist).
            new_value: New value to set.

        Returns:
            True if the value was updated, False if the old value didn't match.

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> # Only update if version matches
            >>> if client.kv_compare_and_set("config", old_data, new_data):
            ...     print("Updated!")
            ... else:
            ...     print("Conflict - value was modified")
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVCompareAndSetRequest(
            key=key,
            old_value=old_value or b"",
            new_value=new_value,
        )

        try:
            response = stub.KVCompareAndSet(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.success

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_compare_and_delete(self, key: str, old_value: bytes) -> bool:
        """
        Atomically delete a key only if it matches the expected value.

        Args:
            key: The key to delete.
            old_value: Expected current value.

        Returns:
            True if the key was deleted, False if the value didn't match.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVCompareAndDeleteRequest(
            key=key,
            old_value=old_value,
        )

        try:
            response = stub.KVCompareAndDelete(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.success

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def kv_set_with_options(
        self,
        key: str,
        value: bytes,
        options: PluginKVSetOptions,
    ) -> bool:
        """
        Set a value with additional options.

        This provides the most flexible KV set operation, combining
        atomic operations and expiration.

        Args:
            key: The key to set.
            value: The value to store as bytes.
            options: Options controlling the operation:
                - atomic: If True, only update if old_value matches
                - old_value: Expected current value for atomic operations
                - expire_in_seconds: Seconds until the key expires (0 = no expiry)

        Returns:
            True if the value was set, False if atomic check failed.

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> options = PluginKVSetOptions(
            ...     atomic=True,
            ...     old_value=old_data,
            ...     expire_in_seconds=3600,  # 1 hour
            ... )
            >>> if client.kv_set_with_options("key", new_data, options):
            ...     print("Set successfully!")
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.KVSetWithOptionsRequest(
            key=key,
            value=value,
            options=options.to_proto(),
        )

        try:
            response = stub.KVSetWithOptions(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.success

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
