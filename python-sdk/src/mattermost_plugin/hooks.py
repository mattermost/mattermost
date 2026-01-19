# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Hook registration system for Mattermost Python plugins.

This module provides the `@hook` decorator and `HookName` enum for registering
plugin methods as hook handlers.

Usage:
    from mattermost_plugin import Plugin, hook, HookName

    class MyPlugin(Plugin):
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            self.logger.info("Plugin activated!")

        @hook(HookName.MessageWillBePosted)
        def filter_message(self, context, post):
            if "spam" in post.message.lower():
                return None, "Message rejected: spam detected"
            return post, ""

Alternative usage with string names:
    @hook("OnActivate")
    def on_activate(self) -> None:
        pass
"""

from __future__ import annotations

import asyncio
import inspect
from enum import Enum
from functools import wraps
from typing import (
    Any,
    Callable,
    Optional,
    TypeVar,
    Union,
    overload,
)

# Python 3.9 compatibility: ParamSpec was added in 3.10
try:
    from typing import ParamSpec
except ImportError:
    from typing_extensions import ParamSpec

P = ParamSpec("P")
R = TypeVar("R")
F = TypeVar("F", bound=Callable[..., Any])

# Attribute names used to mark hook metadata on decorated functions
HOOK_MARKER_ATTR = "_mattermost_hook_name"


class HookName(str, Enum):
    """
    Canonical hook names matching server/public/plugin/hooks.go.

    These names are used in the `Implemented()` RPC to tell the server
    which hooks this plugin handles.

    Usage:
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            pass
    """

    # Lifecycle hooks
    OnActivate = "OnActivate"
    OnDeactivate = "OnDeactivate"
    OnConfigurationChange = "OnConfigurationChange"
    OnInstall = "OnInstall"
    OnSendDailyTelemetry = "OnSendDailyTelemetry"
    RunDataRetention = "RunDataRetention"
    OnCloudLimitsUpdated = "OnCloudLimitsUpdated"
    ConfigurationWillBeSaved = "ConfigurationWillBeSaved"

    # Message hooks
    MessageWillBePosted = "MessageWillBePosted"
    MessageWillBeUpdated = "MessageWillBeUpdated"
    MessageHasBeenPosted = "MessageHasBeenPosted"
    MessageHasBeenUpdated = "MessageHasBeenUpdated"
    MessagesWillBeConsumed = "MessagesWillBeConsumed"
    MessageHasBeenDeleted = "MessageHasBeenDeleted"
    FileWillBeUploaded = "FileWillBeUploaded"
    ReactionHasBeenAdded = "ReactionHasBeenAdded"
    ReactionHasBeenRemoved = "ReactionHasBeenRemoved"
    NotificationWillBePushed = "NotificationWillBePushed"
    EmailNotificationWillBeSent = "EmailNotificationWillBeSent"
    PreferencesHaveChanged = "PreferencesHaveChanged"

    # User hooks
    UserHasBeenCreated = "UserHasBeenCreated"
    UserWillLogIn = "UserWillLogIn"
    UserHasLoggedIn = "UserHasLoggedIn"
    UserHasBeenDeactivated = "UserHasBeenDeactivated"
    OnSAMLLogin = "OnSAMLLogin"

    # Channel/Team hooks
    ChannelHasBeenCreated = "ChannelHasBeenCreated"
    UserHasJoinedChannel = "UserHasJoinedChannel"
    UserHasLeftChannel = "UserHasLeftChannel"
    UserHasJoinedTeam = "UserHasJoinedTeam"
    UserHasLeftTeam = "UserHasLeftTeam"

    # Command hooks
    ExecuteCommand = "ExecuteCommand"

    # WebSocket hooks
    OnWebSocketConnect = "OnWebSocketConnect"
    OnWebSocketDisconnect = "OnWebSocketDisconnect"
    WebSocketMessageHasBeenPosted = "WebSocketMessageHasBeenPosted"

    # Cluster hooks
    OnPluginClusterEvent = "OnPluginClusterEvent"

    # Shared channels hooks
    OnSharedChannelsSyncMsg = "OnSharedChannelsSyncMsg"
    OnSharedChannelsPing = "OnSharedChannelsPing"
    OnSharedChannelsAttachmentSyncMsg = "OnSharedChannelsAttachmentSyncMsg"
    OnSharedChannelsProfileImageSyncMsg = "OnSharedChannelsProfileImageSyncMsg"

    # Support hooks
    GenerateSupportData = "GenerateSupportData"

    # HTTP hooks (Phase 8 - streaming)
    # ServeHTTP = "ServeHTTP"
    # ServeMetrics = "ServeMetrics"


# Set of all valid canonical hook names for validation
VALID_HOOK_NAMES: frozenset[str] = frozenset(h.value for h in HookName)


class HookRegistrationError(Exception):
    """Raised when hook registration fails."""

    pass


def get_hook_name(func: Callable[..., Any]) -> Optional[str]:
    """
    Get the canonical hook name from a decorated function.

    Args:
        func: A function that may have been decorated with @hook.

    Returns:
        The canonical hook name if the function is a hook handler, None otherwise.
    """
    return getattr(func, HOOK_MARKER_ATTR, None)


def is_hook_handler(func: Callable[..., Any]) -> bool:
    """
    Check if a function has been decorated as a hook handler.

    Args:
        func: A function to check.

    Returns:
        True if the function is decorated with @hook, False otherwise.
    """
    return hasattr(func, HOOK_MARKER_ATTR)


# Overloads for type checking support
@overload
def hook(name_or_func: F) -> F:
    """Decorator form: @hook (infers name from method)."""
    ...


@overload
def hook(name_or_func: Union[str, HookName]) -> Callable[[F], F]:
    """Decorator form: @hook("OnActivate") or @hook(HookName.OnActivate)."""
    ...


def hook(
    name_or_func: Union[str, HookName, F, None] = None
) -> Union[F, Callable[[F], F]]:
    """
    Decorator to register a method as a plugin hook handler.

    This decorator marks methods on Plugin subclasses as hook handlers.
    The Plugin base class uses `__init_subclass__` to discover these
    methods and build a hook registry.

    Args:
        name_or_func: Either:
            - A HookName enum value (preferred): @hook(HookName.OnActivate)
            - A string hook name: @hook("OnActivate")
            - None to infer from method name: @hook or @hook()

    Returns:
        The decorated function with hook metadata attached.

    Raises:
        HookRegistrationError: If the hook name is invalid.

    Examples:
        # Preferred: explicit hook name with enum
        @hook(HookName.OnActivate)
        def on_activate(self) -> None:
            pass

        # Also allowed: string hook name
        @hook("OnActivate")
        def handle_activate(self) -> None:
            pass

        # Infer from method name (must match PascalCase convention)
        @hook
        def OnActivate(self) -> None:
            pass
    """

    def decorator(func: F) -> F:
        # Determine the canonical hook name
        if isinstance(name_or_func, HookName):
            canonical_name = name_or_func.value
        elif isinstance(name_or_func, str):
            canonical_name = name_or_func
        elif name_or_func is None or callable(name_or_func):
            # Infer from function name - must match exactly
            canonical_name = func.__name__
        else:
            raise HookRegistrationError(
                f"Invalid hook name type: {type(name_or_func).__name__}"
            )

        # Validate the hook name
        if canonical_name not in VALID_HOOK_NAMES:
            raise HookRegistrationError(
                f"Unknown hook name: '{canonical_name}'. "
                f"Valid hooks: {sorted(VALID_HOOK_NAMES)}"
            )

        # Mark the function with hook metadata
        # Preserve async nature of the function by using appropriate wrapper
        if inspect.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
                return await func(*args, **kwargs)

            # Attach hook metadata
            setattr(async_wrapper, HOOK_MARKER_ATTR, canonical_name)
            return async_wrapper  # type: ignore[return-value]
        else:
            @wraps(func)
            def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
                return func(*args, **kwargs)

            # Attach hook metadata
            setattr(wrapper, HOOK_MARKER_ATTR, canonical_name)
            return wrapper  # type: ignore[return-value]

    # Handle both @hook and @hook() and @hook(HookName.X)
    if callable(name_or_func):
        # Called as @hook without parentheses
        return decorator(name_or_func)
    else:
        # Called as @hook(...) with arguments
        return decorator
