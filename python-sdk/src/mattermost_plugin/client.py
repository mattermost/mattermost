# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Synchronous client for the Mattermost Plugin API.

This module provides the PluginAPIClient class, which is the primary interface
for Python plugins to interact with the Mattermost server via gRPC.

Usage:
    from mattermost_plugin import PluginAPIClient

    with PluginAPIClient(target="localhost:50051") as client:
        version = client.get_server_version()
        print(f"Server version: {version}")
"""

from __future__ import annotations

from types import TracebackType
from typing import Optional, Sequence, Tuple, Type, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.channel import create_channel, get_default_target
from mattermost_plugin.exceptions import (
    PluginAPIError,
    convert_grpc_error,
    convert_app_error,
)

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class PluginAPIClient:
    """
    Synchronous client for the Mattermost Plugin API.

    This client provides a Pythonic interface to the Mattermost Plugin API.
    It manages the gRPC channel lifecycle and converts errors to SDK exceptions.

    The client should be used as a context manager to ensure proper cleanup::

        with PluginAPIClient(target="localhost:50051") as client:
            version = client.get_server_version()

    Alternatively, you can manually manage the lifecycle::

        client = PluginAPIClient(target="localhost:50051")
        client.connect()
        try:
            version = client.get_server_version()
        finally:
            client.close()

    Attributes:
        target: The gRPC server address.
        connected: Whether the client is currently connected.

    Thread Safety:
        This client is thread-safe. Multiple threads can share a single
        client instance.
    """

    def __init__(
        self,
        target: Optional[str] = None,
        *,
        credentials: Optional[grpc.ChannelCredentials] = None,
        options: Optional[Sequence[Tuple[str, int]]] = None,
    ) -> None:
        """
        Initialize the client.

        Args:
            target: Server address (e.g., "localhost:50051"). If not provided,
                uses the MATTERMOST_PLUGIN_API_TARGET environment variable.
            credentials: Optional credentials for secure channel. If None,
                an insecure channel is used (suitable for localhost).
            options: Optional additional channel configuration options.
        """
        self._target = target or get_default_target()
        self._credentials = credentials
        self._options = options
        self._channel: Optional[grpc.Channel] = None
        self._stub: Optional["api_pb2_grpc.PluginAPIStub"] = None

    @property
    def target(self) -> str:
        """The gRPC server address."""
        return self._target

    @property
    def connected(self) -> bool:
        """Whether the client is currently connected."""
        return self._channel is not None

    def connect(self) -> None:
        """
        Establish connection to the gRPC server.

        This method is called automatically when using the context manager.
        Call this method manually if not using `with` statement.

        Raises:
            RuntimeError: If already connected.
        """
        if self._channel is not None:
            raise RuntimeError("Client is already connected")

        self._channel = create_channel(
            self._target,
            credentials=self._credentials,
            options=self._options,
        )

        # Import here to avoid circular imports and allow SDK to work
        # without generated code during development
        from mattermost_plugin.grpc import api_pb2_grpc

        self._stub = api_pb2_grpc.PluginAPIStub(self._channel)

    def close(self) -> None:
        """
        Close the connection to the gRPC server.

        This method is called automatically when exiting the context manager.
        Call this method manually if not using `with` statement.

        This method is safe to call multiple times.
        """
        if self._channel is not None:
            self._channel.close()
            self._channel = None
            self._stub = None

    def __enter__(self) -> "PluginAPIClient":
        """Enter context manager - establish connection."""
        self.connect()
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        """Exit context manager - close connection."""
        self.close()

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """
        Ensure the client is connected and return the stub.

        Returns:
            The gRPC stub for making API calls.

        Raises:
            RuntimeError: If not connected.
        """
        if self._stub is None:
            raise RuntimeError(
                "Client is not connected. Use 'with' statement or call connect() first."
            )
        return self._stub

    # =========================================================================
    # Server Methods
    # =========================================================================

    def get_server_version(self) -> str:
        """
        Get the Mattermost server version.

        This is a simple "smoke test" method to verify the gRPC connection
        is working.

        Returns:
            The server version string (e.g., "9.5.0").

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> with PluginAPIClient() as client:
            ...     version = client.get_server_version()
            ...     print(f"Server version: {version}")
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetServerVersionRequest()

        try:
            response = stub.GetServerVersion(request)

            # Check for AppError in response
            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.version

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_system_install_date(self) -> int:
        """
        Get the timestamp when Mattermost was installed.

        Returns:
            Unix timestamp in milliseconds of installation date.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetSystemInstallDateRequest()

        try:
            response = stub.GetSystemInstallDate(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.install_date

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_diagnostic_id(self) -> str:
        """
        Get the diagnostic ID for this Mattermost installation.

        Returns:
            The diagnostic ID string.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetDiagnosticIdRequest()

        try:
            response = stub.GetDiagnosticId(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.diagnostic_id

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Logging Methods
    # =========================================================================

    def log_debug(self, message: str, **kwargs: str) -> None:
        """
        Log a debug message.

        Args:
            message: The log message.
            **kwargs: Additional key-value pairs to include in the log entry.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.LogDebugRequest(
            message=message,
            key_value_pairs=kwargs,
        )

        try:
            response = stub.LogDebug(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def log_info(self, message: str, **kwargs: str) -> None:
        """
        Log an info message.

        Args:
            message: The log message.
            **kwargs: Additional key-value pairs to include in the log entry.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.LogInfoRequest(
            message=message,
            key_value_pairs=kwargs,
        )

        try:
            response = stub.LogInfo(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def log_warn(self, message: str, **kwargs: str) -> None:
        """
        Log a warning message.

        Args:
            message: The log message.
            **kwargs: Additional key-value pairs to include in the log entry.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.LogWarnRequest(
            message=message,
            key_value_pairs=kwargs,
        )

        try:
            response = stub.LogWarn(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def log_error(self, message: str, **kwargs: str) -> None:
        """
        Log an error message.

        Args:
            message: The log message.
            **kwargs: Additional key-value pairs to include in the log entry.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        request = api_kv_config_pb2.LogErrorRequest(
            message=message,
            key_value_pairs=kwargs,
        )

        try:
            response = stub.LogError(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
