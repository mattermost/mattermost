# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Configuration and Plugin API methods mixin for PluginAPIClient.

This module provides all configuration and plugin-related API methods including:
- Server configuration
- Plugin configuration
- Plugin management
- Plugin info
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class ConfigMixin:
    """Mixin providing configuration and plugin-related API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Server Configuration
    # =========================================================================

    def get_config(self) -> bytes:
        """
        Get the server configuration (sanitized).

        Returns:
            JSON-encoded configuration bytes.

        Raises:
            PluginAPIError: If the API call fails.

        Note:
            The returned configuration has sensitive fields sanitized.
            Use get_unsanitized_config() to get the full configuration.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetConfigRequest()

        try:
            response = stub.GetConfig(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.config_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_unsanitized_config(self) -> bytes:
        """
        Get the server configuration (unsanitized).

        Returns:
            JSON-encoded configuration bytes with all fields.

        Raises:
            PermissionDeniedError: If the plugin doesn't have permission.
            PluginAPIError: If the API call fails.

        Warning:
            This includes sensitive data like database credentials.
            Use with caution and never log or expose this data.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetUnsanitizedConfigRequest()

        try:
            response = stub.GetUnsanitizedConfig(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.config_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def save_config(self, config_json: bytes) -> None:
        """
        Save the server configuration.

        Args:
            config_json: JSON-encoded configuration bytes.

        Raises:
            ValidationError: If configuration is invalid.
            PermissionDeniedError: If the plugin doesn't have permission.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.SaveConfigRequest(config_json=config_json)

        try:
            response = stub.SaveConfig(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Plugin Configuration
    # =========================================================================

    def load_plugin_configuration(self, dest: bytes) -> None:
        """
        Load the plugin's configuration into the given structure.

        Args:
            dest: JSON-encoded structure to populate.

        Raises:
            PluginAPIError: If the API call fails.

        Note:
            This is typically used by the plugin framework to load
            configuration into a typed structure.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.LoadPluginConfigurationRequest(dest=dest)

        try:
            response = stub.LoadPluginConfiguration(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_plugin_config(self) -> Dict[str, str]:
        """
        Get the plugin's configuration.

        Returns:
            Dictionary of configuration key-value pairs.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetPluginConfigRequest()

        try:
            response = stub.GetPluginConfig(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return dict(response.config)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def save_plugin_config(self, config: Dict[str, str]) -> None:
        """
        Save the plugin's configuration.

        Args:
            config: Dictionary of configuration key-value pairs.

        Raises:
            ValidationError: If configuration is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.SavePluginConfigRequest(config=config)

        try:
            response = stub.SavePluginConfig(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Plugin Management
    # =========================================================================

    def get_bundle_path(self) -> str:
        """
        Get the path to the plugin's bundle directory.

        Returns:
            Filesystem path to the plugin bundle.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetBundlePathRequest()

        try:
            response = stub.GetBundlePath(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.path

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_plugin_id(self) -> str:
        """
        Get the plugin's ID.

        Returns:
            The plugin ID.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetPluginIDRequest()

        try:
            response = stub.GetPluginID(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.plugin_id

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_plugins(self) -> bytes:
        """
        Get information about all plugins.

        Returns:
            JSON-encoded plugin information.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetPluginsRequest()

        try:
            response = stub.GetPlugins(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.plugins_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_plugin_status(self, plugin_id: str) -> bytes:
        """
        Get the status of a plugin.

        Args:
            plugin_id: ID of the plugin.

        Returns:
            JSON-encoded plugin status.

        Raises:
            NotFoundError: If plugin does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.GetPluginStatusRequest(plugin_id=plugin_id)

        try:
            response = stub.GetPluginStatus(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.status_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def enable_plugin(self, plugin_id: str) -> None:
        """
        Enable a plugin.

        Args:
            plugin_id: ID of the plugin to enable.

        Raises:
            NotFoundError: If plugin does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.EnablePluginRequest(plugin_id=plugin_id)

        try:
            response = stub.EnablePlugin(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def disable_plugin(self, plugin_id: str) -> None:
        """
        Disable a plugin.

        Args:
            plugin_id: ID of the plugin to disable.

        Raises:
            NotFoundError: If plugin does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.DisablePluginRequest(plugin_id=plugin_id)

        try:
            response = stub.DisablePlugin(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def remove_plugin(self, plugin_id: str) -> None:
        """
        Remove a plugin.

        Args:
            plugin_id: ID of the plugin to remove.

        Raises:
            NotFoundError: If plugin does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.RemovePluginRequest(plugin_id=plugin_id)

        try:
            response = stub.RemovePlugin(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def install_plugin(self, data: bytes, *, force: bool = False) -> bytes:
        """
        Install a plugin from data.

        Args:
            data: Plugin bundle data.
            force: Whether to force install over existing plugin.

        Returns:
            JSON-encoded manifest of the installed plugin.

        Raises:
            ValidationError: If plugin data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.InstallPluginRequest(
            file_data=data,
            force=force,
        )

        try:
            response = stub.InstallPlugin(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.manifest_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
