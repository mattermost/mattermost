# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
gRPC channel management utilities.

This module provides functions for creating and configuring gRPC channels
with best practices for the Mattermost Plugin SDK, including keepalive
settings and message size limits.
"""

from __future__ import annotations

import os
from typing import Optional, Sequence, Tuple

import grpc
import grpc.aio


# Default channel options for plugin communication
DEFAULT_CHANNEL_OPTIONS: Sequence[Tuple[str, int]] = (
    # Keepalive ping every 10 seconds to prevent connection drops
    ("grpc.keepalive_time_ms", 10000),
    # Wait 5 seconds for ping ack before closing connection
    ("grpc.keepalive_timeout_ms", 5000),
    # Allow keepalive pings even when there are no active streams
    ("grpc.keepalive_permit_without_calls", 1),
    # Increase message size limits for large payloads (100MB)
    ("grpc.max_send_message_length", 100 * 1024 * 1024),
    ("grpc.max_receive_message_length", 100 * 1024 * 1024),
)


# Environment variable for API target discovery (used by Python supervisor)
PLUGIN_API_TARGET_ENV = "MATTERMOST_PLUGIN_API_TARGET"


def get_default_target() -> str:
    """
    Get the default gRPC target address from environment.

    The Python supervisor sets the MATTERMOST_PLUGIN_API_TARGET environment
    variable to indicate where the Go gRPC server is listening.

    Returns:
        The target address (e.g., "localhost:50051" or "unix:///path/to/socket").

    Raises:
        RuntimeError: If the environment variable is not set.
    """
    target = os.environ.get(PLUGIN_API_TARGET_ENV)
    if not target:
        raise RuntimeError(
            f"Environment variable {PLUGIN_API_TARGET_ENV} not set. "
            "This SDK must be used within a Mattermost plugin context."
        )
    return target


def create_channel(
    target: str,
    *,
    credentials: Optional[grpc.ChannelCredentials] = None,
    options: Optional[Sequence[Tuple[str, int]]] = None,
) -> grpc.Channel:
    """
    Create a configured gRPC channel with best practices.

    The channel is configured with keepalive settings to prevent connection
    drops during idle periods and increased message size limits for large
    payloads.

    Args:
        target: Server address (e.g., "localhost:50051" or "unix:///path/to/socket").
        credentials: Optional credentials for secure channel. If None,
            an insecure channel is created (suitable for localhost).
        options: Optional additional channel options. These are merged with
            default options, with user options taking precedence.

    Returns:
        A configured gRPC channel.

    Example:
        >>> channel = create_channel("localhost:50051")
        >>> # Use channel with stub
        >>> stub = api_pb2_grpc.PluginAPIStub(channel)
        >>> # Don't forget to close when done
        >>> channel.close()
    """
    # Merge default options with user-provided options
    # User options take precedence (override defaults with same key)
    all_options = dict(DEFAULT_CHANNEL_OPTIONS)
    if options:
        all_options.update(dict(options))

    options_list = list(all_options.items())

    if credentials:
        return grpc.secure_channel(target, credentials, options=options_list)
    else:
        return grpc.insecure_channel(target, options=options_list)


def create_async_channel(
    target: str,
    *,
    credentials: Optional[grpc.ChannelCredentials] = None,
    options: Optional[Sequence[Tuple[str, int]]] = None,
) -> grpc.aio.Channel:
    """
    Create a configured async gRPC channel with best practices.

    Similar to create_channel, but returns an async channel suitable for
    use with grpc.aio and async/await patterns.

    Args:
        target: Server address (e.g., "localhost:50051").
        credentials: Optional credentials for secure channel.
        options: Optional additional channel options.

    Returns:
        A configured async gRPC channel.

    Example:
        >>> channel = create_async_channel("localhost:50051")
        >>> stub = api_pb2_grpc.PluginAPIStub(channel)
        >>> # Use with await
        >>> response = await stub.GetServerVersion(request)
        >>> await channel.close()
    """
    # Merge default options with user-provided options
    all_options = dict(DEFAULT_CHANNEL_OPTIONS)
    if options:
        all_options.update(dict(options))

    options_list = list(all_options.items())

    if credentials:
        return grpc.aio.secure_channel(target, credentials, options=options_list)
    else:
        return grpc.aio.insecure_channel(target, options=options_list)
