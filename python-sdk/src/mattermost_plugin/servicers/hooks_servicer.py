# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
gRPC Hook Servicer for Mattermost Python plugins.

This module implements the PluginHooksServicer gRPC service, handling hook
invocations from the Mattermost server.

ERROR HANDLING CONVENTION:
--------------------------
1. Plugin bugs (exceptions in handlers): Return gRPC INTERNAL status.
   The Go side should log and fail-open where appropriate.

2. Expected business rejections (e.g., post rejected by MessageWillBePosted):
   Encoded via response fields (rejection_reason), NOT gRPC errors.

3. OnActivate errors: Encoded via response.error field (AppError).
   This allows the Go side to distinguish activation failure from transport failure.

HOOK HANDLER INVOCATION:
------------------------
- All hook handlers are invoked via the HookRunner with timeout support.
- Both sync and async handlers are supported.
- Handler exceptions are caught and converted to appropriate gRPC responses.

TYPE STRATEGY:
--------------
For this initial implementation, hook handlers receive raw protobuf messages.
Future versions may add Python wrapper types for better ergonomics.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

import grpc

from mattermost_plugin.grpc import hooks_pb2_grpc
from mattermost_plugin.grpc import hooks_lifecycle_pb2
from mattermost_plugin.grpc import hooks_message_pb2
from mattermost_plugin.grpc import common_pb2
from mattermost_plugin._internal.hook_runner import HookRunner, DEFAULT_HOOK_TIMEOUT

if TYPE_CHECKING:
    from mattermost_plugin.plugin import Plugin

logger = logging.getLogger(__name__)

# DismissPostError is the special string that tells the server to silently
# dismiss the post (no error shown to user). Must match the Go constant.
DISMISS_POST_ERROR = "plugin.message_will_be_posted.dismiss_post"


def _make_app_error(
    message: str,
    error_id: str = "plugin.error",
    detailed_error: str = "",
    status_code: int = 500,
    where: str = "",
) -> common_pb2.AppError:
    """Create an AppError protobuf message."""
    return common_pb2.AppError(
        id=error_id,
        message=message,
        detailed_error=detailed_error,
        status_code=status_code,
        where=where,
    )


class PluginHooksServicerImpl(hooks_pb2_grpc.PluginHooksServicer):
    """
    gRPC servicer implementation for plugin hooks.

    This class receives hook invocations from the Mattermost server and
    dispatches them to the appropriate plugin handler methods.

    Attributes:
        plugin: The Plugin instance that implements hook handlers.
        runner: HookRunner instance for invoking handlers with timeout.
    """

    def __init__(
        self,
        plugin: "Plugin",
        timeout: float = DEFAULT_HOOK_TIMEOUT,
    ) -> None:
        """
        Initialize the hook servicer.

        Args:
            plugin: The Plugin instance to dispatch hooks to.
            timeout: Default timeout for hook invocations in seconds.
        """
        self.plugin = plugin
        self.runner = HookRunner(timeout=timeout)
        self._logger = logging.getLogger(
            f"{__name__}.{plugin.__class__.__name__}"
        )

    # =========================================================================
    # IMPLEMENTED RPC
    # =========================================================================

    async def Implemented(
        self,
        request: hooks_lifecycle_pb2.ImplementedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.ImplementedResponse:
        """
        Return the list of hooks implemented by this plugin.

        This method queries the plugin's hook registry to determine which
        hooks have registered handlers.

        Args:
            request: The ImplementedRequest (contains context info).
            context: The gRPC servicer context.

        Returns:
            ImplementedResponse containing list of canonical hook names.
        """
        hooks = self.plugin.implemented_hooks()
        self._logger.debug(f"Implemented hooks: {hooks}")
        return hooks_lifecycle_pb2.ImplementedResponse(hooks=hooks)

    # =========================================================================
    # LIFECYCLE HOOKS
    # =========================================================================

    async def OnActivate(
        self,
        request: hooks_lifecycle_pb2.OnActivateRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnActivateResponse:
        """
        Handle plugin activation.

        If the handler returns an error or raises an exception, the plugin
        activation will fail. The error is encoded in the response.error field.

        Args:
            request: The OnActivateRequest.
            context: The gRPC servicer context.

        Returns:
            OnActivateResponse, with error field set on failure.
        """
        hook_name = "OnActivate"

        if not self.plugin.has_hook(hook_name):
            # Hook not implemented - activation succeeds by default
            return hooks_lifecycle_pb2.OnActivateResponse()

        handler = self.plugin.get_hook_handler(hook_name)
        # Don't pass gRPC context - we encode errors in response.error field
        result, error = await self.runner.invoke(
            handler,
            hook_name=hook_name,
        )

        if error is not None:
            self._logger.error(f"OnActivate failed: {error}")
            return hooks_lifecycle_pb2.OnActivateResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_activate.error",
                    where="OnActivate",
                ),
            )

        # Handler may return an error explicitly
        if isinstance(result, Exception) or isinstance(result, str) and result:
            error_msg = str(result)
            self._logger.error(f"OnActivate returned error: {error_msg}")
            return hooks_lifecycle_pb2.OnActivateResponse(
                error=_make_app_error(
                    message=error_msg,
                    error_id="plugin.on_activate.error",
                    where="OnActivate",
                ),
            )

        return hooks_lifecycle_pb2.OnActivateResponse()

    async def OnDeactivate(
        self,
        request: hooks_lifecycle_pb2.OnDeactivateRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnDeactivateResponse:
        """
        Handle plugin deactivation.

        This is best-effort - errors are logged but don't prevent shutdown.

        Args:
            request: The OnDeactivateRequest.
            context: The gRPC servicer context.

        Returns:
            OnDeactivateResponse, with error field set on failure (informational).
        """
        hook_name = "OnDeactivate"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.OnDeactivateResponse()

        handler = self.plugin.get_hook_handler(hook_name)
        # Don't pass gRPC context - we encode errors in response.error field
        result, error = await self.runner.invoke(
            handler,
            hook_name=hook_name,
        )

        if error is not None:
            self._logger.warning(f"OnDeactivate error (continuing): {error}")
            return hooks_lifecycle_pb2.OnDeactivateResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_deactivate.error",
                    where="OnDeactivate",
                ),
            )

        return hooks_lifecycle_pb2.OnDeactivateResponse()

    async def OnConfigurationChange(
        self,
        request: hooks_lifecycle_pb2.OnConfigurationChangeRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnConfigurationChangeResponse:
        """
        Handle configuration change notification.

        Errors are logged but do not stop the plugin.

        Args:
            request: The OnConfigurationChangeRequest.
            context: The gRPC servicer context.

        Returns:
            OnConfigurationChangeResponse, with error field set on failure.
        """
        hook_name = "OnConfigurationChange"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.OnConfigurationChangeResponse()

        handler = self.plugin.get_hook_handler(hook_name)
        # Don't pass gRPC context - we encode errors in response.error field
        result, error = await self.runner.invoke(
            handler,
            hook_name=hook_name,
        )

        if error is not None:
            self._logger.warning(
                f"OnConfigurationChange error (continuing): {error}"
            )
            return hooks_lifecycle_pb2.OnConfigurationChangeResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_configuration_change.error",
                    where="OnConfigurationChange",
                ),
            )

        return hooks_lifecycle_pb2.OnConfigurationChangeResponse()

    # =========================================================================
    # MESSAGE HOOKS
    # =========================================================================

    async def MessageWillBePosted(
        self,
        request: hooks_message_pb2.MessageWillBePostedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessageWillBePostedResponse:
        """
        Handle MessageWillBePosted hook.

        This hook is called before a post is saved. The handler can:
        - Allow unchanged: return (None, "")
        - Modify: return (modified_post, "")
        - Reject: return (None, "rejection reason")
        - Dismiss silently: return (None, DISMISS_POST_ERROR)

        Args:
            request: Contains context, plugin_context, and post.
            context: The gRPC servicer context.

        Returns:
            MessageWillBePostedResponse with modified_post and/or rejection_reason.
        """
        hook_name = "MessageWillBePosted"

        if not self.plugin.has_hook(hook_name):
            # Not implemented - allow post unchanged
            return hooks_message_pb2.MessageWillBePostedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Invoke handler with protobuf objects
        # Handler signature: (context, post) -> (post, string) or (post, rejection)
        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.post,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            # Handler exception - treat as rejection with error message
            self._logger.error(f"MessageWillBePosted error: {error}")
            return hooks_message_pb2.MessageWillBePostedResponse(
                rejection_reason=f"Plugin error: {error}",
            )

        # Parse handler result
        modified_post = None
        rejection_reason = ""

        if result is None:
            # Allow unchanged
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            post_result, reason = result
            if post_result is not None:
                modified_post = post_result
            if reason:
                rejection_reason = str(reason)
        elif hasattr(result, "id"):
            # Looks like a Post object - treat as modified post
            modified_post = result
        elif isinstance(result, str):
            # String result - treat as rejection reason
            rejection_reason = result

        return hooks_message_pb2.MessageWillBePostedResponse(
            modified_post=modified_post,
            rejection_reason=rejection_reason,
        )

    async def MessageWillBeUpdated(
        self,
        request: hooks_message_pb2.MessageWillBeUpdatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessageWillBeUpdatedResponse:
        """
        Handle MessageWillBeUpdated hook.

        Similar to MessageWillBePosted but for post updates.
        Handler receives both new_post and old_post.

        Args:
            request: Contains context, plugin_context, new_post, and old_post.
            context: The gRPC servicer context.

        Returns:
            MessageWillBeUpdatedResponse with modified_post and/or rejection_reason.
        """
        hook_name = "MessageWillBeUpdated"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.MessageWillBeUpdatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (context, new_post, old_post) -> (post, string)
        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.new_post,
            request.old_post,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"MessageWillBeUpdated error: {error}")
            return hooks_message_pb2.MessageWillBeUpdatedResponse(
                rejection_reason=f"Plugin error: {error}",
            )

        # Parse handler result (same logic as MessageWillBePosted)
        modified_post = None
        rejection_reason = ""

        if result is None:
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            post_result, reason = result
            if post_result is not None:
                modified_post = post_result
            if reason:
                rejection_reason = str(reason)
        elif hasattr(result, "id"):
            modified_post = result
        elif isinstance(result, str):
            rejection_reason = result

        return hooks_message_pb2.MessageWillBeUpdatedResponse(
            modified_post=modified_post,
            rejection_reason=rejection_reason,
        )

    async def MessageHasBeenPosted(
        self,
        request: hooks_message_pb2.MessageHasBeenPostedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessageHasBeenPostedResponse:
        """
        Handle MessageHasBeenPosted notification.

        This is a fire-and-forget notification. Errors are logged but
        the response is always empty.

        Args:
            request: Contains context, plugin_context, and post.
            context: The gRPC servicer context.

        Returns:
            Empty MessageHasBeenPostedResponse.
        """
        hook_name = "MessageHasBeenPosted"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.MessageHasBeenPostedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (context, post) -> None
        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.post,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"MessageHasBeenPosted error: {error}")
            # Notification hook - still return success

        return hooks_message_pb2.MessageHasBeenPostedResponse()

    async def MessageHasBeenUpdated(
        self,
        request: hooks_message_pb2.MessageHasBeenUpdatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessageHasBeenUpdatedResponse:
        """
        Handle MessageHasBeenUpdated notification.

        Fire-and-forget notification for post updates.

        Args:
            request: Contains context, plugin_context, new_post, and old_post.
            context: The gRPC servicer context.

        Returns:
            Empty MessageHasBeenUpdatedResponse.
        """
        hook_name = "MessageHasBeenUpdated"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.MessageHasBeenUpdatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (context, new_post, old_post) -> None
        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.new_post,
            request.old_post,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"MessageHasBeenUpdated error: {error}")

        return hooks_message_pb2.MessageHasBeenUpdatedResponse()

    async def MessageHasBeenDeleted(
        self,
        request: hooks_message_pb2.MessageHasBeenDeletedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessageHasBeenDeletedResponse:
        """
        Handle MessageHasBeenDeleted notification.

        Fire-and-forget notification for post deletions.

        Args:
            request: Contains context, plugin_context, and post.
            context: The gRPC servicer context.

        Returns:
            Empty MessageHasBeenDeletedResponse.
        """
        hook_name = "MessageHasBeenDeleted"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.MessageHasBeenDeletedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (context, post) -> None
        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.post,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"MessageHasBeenDeleted error: {error}")

        return hooks_message_pb2.MessageHasBeenDeletedResponse()

    async def MessagesWillBeConsumed(
        self,
        request: hooks_message_pb2.MessagesWillBeConsumedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.MessagesWillBeConsumedResponse:
        """
        Handle MessagesWillBeConsumed hook.

        Called when posts are being delivered to a client. The handler can
        modify the list of posts (e.g., filter, redact).

        Args:
            request: Contains context and list of posts.
            context: The gRPC servicer context.

        Returns:
            MessagesWillBeConsumedResponse with (possibly modified) posts.
        """
        hook_name = "MessagesWillBeConsumed"

        if not self.plugin.has_hook(hook_name):
            # Return original posts unchanged
            return hooks_message_pb2.MessagesWillBeConsumedResponse(
                posts=list(request.posts),
            )

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (posts) -> posts
        # Note: No Context parameter for this hook
        result, error = await self.runner.invoke(
            handler,
            list(request.posts),
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"MessagesWillBeConsumed error: {error}")
            # On error, return original posts
            return hooks_message_pb2.MessagesWillBeConsumedResponse(
                posts=list(request.posts),
            )

        # Handler should return list of posts
        if result is None:
            posts = list(request.posts)
        elif isinstance(result, (list, tuple)):
            posts = list(result)
        else:
            self._logger.warning(
                f"MessagesWillBeConsumed returned unexpected type: {type(result)}"
            )
            posts = list(request.posts)

        return hooks_message_pb2.MessagesWillBeConsumedResponse(posts=posts)
