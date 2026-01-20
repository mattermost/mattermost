# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Asynchronous client for the Mattermost Plugin API.

This module provides the AsyncPluginAPIClient class, which is the async
version of PluginAPIClient for use with asyncio.

Usage:
    from mattermost_plugin import AsyncPluginAPIClient
    import asyncio

    async def main():
        async with AsyncPluginAPIClient(target="localhost:50051") as client:
            version = await client.get_server_version()
            print(f"Server version: {version}")

    asyncio.run(main())
"""

from __future__ import annotations

from types import TracebackType
from typing import Optional, Sequence, Tuple, Type, TYPE_CHECKING

import grpc
import grpc.aio

from mattermost_plugin._internal.channel import create_async_channel, get_default_target
from mattermost_plugin.exceptions import (
    PluginAPIError,
    convert_grpc_error,
    convert_app_error,
)

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class AsyncPluginAPIClient:
    """
    Asynchronous client for the Mattermost Plugin API.

    This client provides an async Pythonic interface to the Mattermost Plugin API.
    It uses grpc.aio for native async/await support.

    The client should be used as an async context manager::

        async with AsyncPluginAPIClient(target="localhost:50051") as client:
            version = await client.get_server_version()

    Alternatively, you can manually manage the lifecycle::

        client = AsyncPluginAPIClient(target="localhost:50051")
        await client.connect()
        try:
            version = await client.get_server_version()
        finally:
            await client.close()

    Attributes:
        target: The gRPC server address.
        connected: Whether the client is currently connected.
    """

    def __init__(
        self,
        target: Optional[str] = None,
        *,
        credentials: Optional[grpc.ChannelCredentials] = None,
        options: Optional[Sequence[Tuple[str, int]]] = None,
    ) -> None:
        """
        Initialize the async client.

        Args:
            target: Server address (e.g., "localhost:50051"). If not provided,
                uses the MATTERMOST_PLUGIN_API_TARGET environment variable.
            credentials: Optional credentials for secure channel.
            options: Optional additional channel configuration options.
        """
        self._target = target or get_default_target()
        self._credentials = credentials
        self._options = options
        self._channel: Optional[grpc.aio.Channel] = None
        self._stub: Optional["api_pb2_grpc.PluginAPIStub"] = None

    @property
    def target(self) -> str:
        """The gRPC server address."""
        return self._target

    @property
    def connected(self) -> bool:
        """Whether the client is currently connected."""
        return self._channel is not None

    async def connect(self) -> None:
        """
        Establish connection to the gRPC server.

        This method is called automatically when using the async context manager.
        """
        if self._channel is not None:
            raise RuntimeError("Client is already connected")

        self._channel = create_async_channel(
            self._target,
            credentials=self._credentials,
            options=self._options,
        )

        from mattermost_plugin.grpc import api_pb2_grpc

        self._stub = api_pb2_grpc.PluginAPIStub(self._channel)

    async def close(self) -> None:
        """
        Close the connection to the gRPC server.

        This method is called automatically when exiting the async context manager.
        """
        if self._channel is not None:
            await self._channel.close()
            self._channel = None
            self._stub = None

    async def __aenter__(self) -> "AsyncPluginAPIClient":
        """Enter async context manager - establish connection."""
        await self.connect()
        return self

    async def __aexit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        """Exit async context manager - close connection."""
        await self.close()

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
                "Client is not connected. Use 'async with' statement or call connect() first."
            )
        return self._stub

    # =========================================================================
    # Server Methods
    # =========================================================================

    async def get_server_version(self) -> str:
        """
        Get the Mattermost server version.

        Returns:
            The server version string (e.g., "9.5.0").

        Raises:
            PluginAPIError: If the API call fails.

        Example:
            >>> async with AsyncPluginAPIClient() as client:
            ...     version = await client.get_server_version()
            ...     print(f"Server version: {version}")
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetServerVersionRequest()

        try:
            response = await stub.GetServerVersion(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.version

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    async def get_system_install_date(self) -> int:
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
            response = await stub.GetSystemInstallDate(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.install_date

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    async def get_diagnostic_id(self) -> str:
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
            response = await stub.GetDiagnosticId(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.diagnostic_id

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Logging Methods
    # =========================================================================

    async def log_debug(self, message: str, **kwargs: str) -> None:
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
            response = await stub.LogDebug(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    async def log_info(self, message: str, **kwargs: str) -> None:
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
            response = await stub.LogInfo(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    async def log_warn(self, message: str, **kwargs: str) -> None:
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
            response = await stub.LogWarn(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e

    async def log_error(self, message: str, **kwargs: str) -> None:
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
            response = await stub.LogError(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.aio.AioRpcError as e:
            raise convert_grpc_error(e) from e
