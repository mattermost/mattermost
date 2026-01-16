# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Mattermost Plugin SDK for Python.

This SDK provides a Pythonic interface to the Mattermost Plugin API via gRPC.
Python plugins can use this SDK to interact with the Mattermost server.

Basic usage::

    from mattermost_plugin import PluginAPIClient, PluginAPIError

    # Use with context manager for automatic cleanup
    with PluginAPIClient(target="localhost:50051") as client:
        try:
            version = client.get_server_version()
            print(f"Server version: {version}")
        except PluginAPIError as e:
            print(f"Error: {e}")

Async usage::

    from mattermost_plugin import AsyncPluginAPIClient

    async with AsyncPluginAPIClient(target="localhost:50051") as client:
        version = await client.get_server_version()
        print(f"Server version: {version}")
"""

from mattermost_plugin.client import PluginAPIClient
from mattermost_plugin.async_client import AsyncPluginAPIClient
from mattermost_plugin.exceptions import (
    PluginAPIError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
    AlreadyExistsError,
    UnavailableError,
    convert_grpc_error,
)

__version__ = "0.1.0"

__all__ = [
    # Clients
    "PluginAPIClient",
    "AsyncPluginAPIClient",
    # Exceptions
    "PluginAPIError",
    "NotFoundError",
    "PermissionDeniedError",
    "ValidationError",
    "AlreadyExistsError",
    "UnavailableError",
    # Utilities
    "convert_grpc_error",
    # Version
    "__version__",
]
