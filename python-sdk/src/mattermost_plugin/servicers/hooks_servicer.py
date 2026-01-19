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
from mattermost_plugin.grpc import hooks_user_channel_pb2
from mattermost_plugin.grpc import hooks_command_pb2
from mattermost_plugin.grpc import common_pb2
from mattermost_plugin.grpc import api_remaining_pb2
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

    # =========================================================================
    # HOOK IMPLEMENTATION MATRIX (remaining hooks for 07-03)
    # =========================================================================
    #
    # Hook Name                          | Python Handler         | Return Semantics          | Default Behavior
    # -----------------------------------|------------------------|---------------------------|------------------
    # ExecuteCommand                     | execute_command        | (CommandResponse, error)  | UNIMPLEMENTED
    # ConfigurationWillBeSaved           | configuration_will_be_saved | (config, error)      | allow unchanged
    # UserHasBeenCreated                 | user_has_been_created  | void (fire-and-forget)    | no-op
    # UserWillLogIn                      | user_will_log_in       | rejection_reason string   | allow (empty string)
    # UserHasLoggedIn                    | user_has_logged_in     | void (fire-and-forget)    | no-op
    # UserHasBeenDeactivated             | user_has_been_deactivated | void (fire-and-forget) | no-op
    # ChannelHasBeenCreated              | channel_has_been_created | void (fire-and-forget)  | no-op
    # UserHasJoinedChannel               | user_has_joined_channel | void (fire-and-forget)   | no-op
    # UserHasLeftChannel                 | user_has_left_channel  | void (fire-and-forget)    | no-op
    # UserHasJoinedTeam                  | user_has_joined_team   | void (fire-and-forget)    | no-op
    # UserHasLeftTeam                    | user_has_left_team     | void (fire-and-forget)    | no-op
    # ReactionHasBeenAdded               | reaction_has_been_added | void (fire-and-forget)   | no-op
    # ReactionHasBeenRemoved             | reaction_has_been_removed | void (fire-and-forget) | no-op
    # NotificationWillBePushed           | notification_will_be_pushed | (notification, rejection) | allow
    # EmailNotificationWillBeSent        | email_notification_will_be_sent | (content, rejection) | allow
    # PreferencesHaveChanged             | preferences_have_changed | void (fire-and-forget)  | no-op
    # OnInstall                          | on_install             | error                     | success
    # OnSendDailyTelemetry               | on_send_daily_telemetry | void (fire-and-forget)  | no-op
    # RunDataRetention                   | run_data_retention     | (deleted_count, error)    | (0, nil)
    # OnCloudLimitsUpdated               | on_cloud_limits_updated | void (fire-and-forget)  | no-op
    # OnWebSocketConnect                 | on_web_socket_connect  | void (fire-and-forget)    | no-op
    # OnWebSocketDisconnect              | on_web_socket_disconnect | void (fire-and-forget)  | no-op
    # WebSocketMessageHasBeenPosted      | web_socket_message_has_been_posted | void         | no-op
    # OnPluginClusterEvent               | on_plugin_cluster_event | void (fire-and-forget)  | no-op
    # OnSharedChannelsSyncMsg            | on_shared_channels_sync_msg | (SyncResponse, error) | UNIMPLEMENTED
    # OnSharedChannelsPing               | on_shared_channels_ping | bool (healthy)          | true
    # OnSharedChannelsAttachmentSyncMsg  | on_shared_channels_attachment_sync_msg | error   | success
    # OnSharedChannelsProfileImageSyncMsg| on_shared_channels_profile_image_sync_msg | error | success
    # GenerateSupportData                | generate_support_data  | ([]FileData, error)       | ([], nil)
    # OnSAMLLogin                        | on_saml_login          | error                     | success
    #
    # DEFERRED TO PHASE 8 (Streaming):
    # - ServeHTTP: HTTP request/response streaming
    # - ServeMetrics: HTTP request/response streaming
    # - FileWillBeUploaded: Large file streaming (implemented as unary but may have size limits)
    # =========================================================================

    # =========================================================================
    # COMMAND HOOKS
    # =========================================================================

    async def ExecuteCommand(
        self,
        request: hooks_command_pb2.ExecuteCommandRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.ExecuteCommandResponse:
        """
        Handle ExecuteCommand hook.

        Called when a slash command registered by this plugin is invoked.
        Handler should return a CommandResponse or raise an error.

        Args:
            request: Contains context, plugin_context, and command args.
            context: The gRPC servicer context.

        Returns:
            ExecuteCommandResponse with response or error.
        """
        hook_name = "ExecuteCommand"

        if not self.plugin.has_hook(hook_name):
            # Command hook not implemented - return error
            return hooks_command_pb2.ExecuteCommandResponse(
                error=_make_app_error(
                    message="ExecuteCommand hook not implemented",
                    error_id="plugin.execute_command.not_implemented",
                    status_code=501,
                    where="ExecuteCommand",
                ),
            )

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (context, args) -> CommandResponse or error
        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.args,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"ExecuteCommand error: {error}")
            return hooks_command_pb2.ExecuteCommandResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.execute_command.error",
                    where="ExecuteCommand",
                ),
            )

        # Handler should return a CommandResponse protobuf
        if result is None:
            return hooks_command_pb2.ExecuteCommandResponse()
        elif hasattr(result, "response_type"):
            # Looks like a CommandResponse
            return hooks_command_pb2.ExecuteCommandResponse(response=result)
        else:
            self._logger.warning(
                f"ExecuteCommand returned unexpected type: {type(result)}"
            )
            return hooks_command_pb2.ExecuteCommandResponse()

    # =========================================================================
    # CONFIGURATION HOOKS
    # =========================================================================

    async def ConfigurationWillBeSaved(
        self,
        request: hooks_lifecycle_pb2.ConfigurationWillBeSavedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse:
        """
        Handle ConfigurationWillBeSaved hook.

        Called before configuration is saved. Handler can return a modified
        config or an error to reject the save.

        Args:
            request: Contains context and new_config (as ConfigJson).
            context: The gRPC servicer context.

        Returns:
            ConfigurationWillBeSavedResponse with optional modified_config or error.
        """
        hook_name = "ConfigurationWillBeSaved"

        if not self.plugin.has_hook(hook_name):
            # Not implemented - allow unchanged
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (config_json) -> (config_json, error) or just config_json
        result, error = await self.runner.invoke(
            handler,
            request.new_config,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"ConfigurationWillBeSaved error: {error}")
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.configuration_will_be_saved.error",
                    where="ConfigurationWillBeSaved",
                ),
            )

        # Parse result
        if result is None:
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse()
        elif isinstance(result, tuple) and len(result) == 2:
            config, err = result
            if err:
                return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse(
                    error=_make_app_error(
                        message=str(err),
                        error_id="plugin.configuration_will_be_saved.rejected",
                        where="ConfigurationWillBeSaved",
                    ),
                )
            if config is not None:
                return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse(
                    modified_config=config
                )
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse()
        elif hasattr(result, "config_json"):
            # Looks like a ConfigJson
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse(
                modified_config=result
            )
        else:
            return hooks_lifecycle_pb2.ConfigurationWillBeSavedResponse()

    # =========================================================================
    # USER LIFECYCLE HOOKS
    # =========================================================================

    async def UserHasBeenCreated(
        self,
        request: hooks_user_channel_pb2.UserHasBeenCreatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasBeenCreatedResponse:
        """
        Handle UserHasBeenCreated notification.

        Fire-and-forget notification when a user is created.

        Args:
            request: Contains context, plugin_context, and user.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasBeenCreatedResponse.
        """
        hook_name = "UserHasBeenCreated"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasBeenCreatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.user,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasBeenCreated error: {error}")
            # Fire-and-forget - still return success

        return hooks_user_channel_pb2.UserHasBeenCreatedResponse()

    async def UserWillLogIn(
        self,
        request: hooks_user_channel_pb2.UserWillLogInRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserWillLogInResponse:
        """
        Handle UserWillLogIn hook.

        Called before a user logs in. Return a non-empty string to reject.

        Args:
            request: Contains context, plugin_context, and user.
            context: The gRPC servicer context.

        Returns:
            UserWillLogInResponse with rejection_reason (empty to allow).
        """
        hook_name = "UserWillLogIn"

        if not self.plugin.has_hook(hook_name):
            # Not implemented - allow login
            return hooks_user_channel_pb2.UserWillLogInResponse(rejection_reason="")

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.user,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserWillLogIn error: {error}")
            # On error, reject the login
            return hooks_user_channel_pb2.UserWillLogInResponse(
                rejection_reason=f"Plugin error: {error}"
            )

        # Handler returns string rejection reason (empty = allow)
        rejection_reason = ""
        if result is not None and isinstance(result, str):
            rejection_reason = result

        return hooks_user_channel_pb2.UserWillLogInResponse(
            rejection_reason=rejection_reason
        )

    async def UserHasLoggedIn(
        self,
        request: hooks_user_channel_pb2.UserHasLoggedInRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasLoggedInResponse:
        """
        Handle UserHasLoggedIn notification.

        Fire-and-forget notification after user login.

        Args:
            request: Contains context, plugin_context, and user.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasLoggedInResponse.
        """
        hook_name = "UserHasLoggedIn"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasLoggedInResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.user,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasLoggedIn error: {error}")

        return hooks_user_channel_pb2.UserHasLoggedInResponse()

    async def UserHasBeenDeactivated(
        self,
        request: hooks_user_channel_pb2.UserHasBeenDeactivatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasBeenDeactivatedResponse:
        """
        Handle UserHasBeenDeactivated notification.

        Fire-and-forget notification when a user is deactivated.

        Args:
            request: Contains context, plugin_context, and user.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasBeenDeactivatedResponse.
        """
        hook_name = "UserHasBeenDeactivated"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasBeenDeactivatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.user,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasBeenDeactivated error: {error}")

        return hooks_user_channel_pb2.UserHasBeenDeactivatedResponse()

    # =========================================================================
    # CHANNEL AND TEAM HOOKS
    # =========================================================================

    async def ChannelHasBeenCreated(
        self,
        request: hooks_user_channel_pb2.ChannelHasBeenCreatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.ChannelHasBeenCreatedResponse:
        """
        Handle ChannelHasBeenCreated notification.

        Fire-and-forget notification when a channel is created.

        Args:
            request: Contains context, plugin_context, and channel.
            context: The gRPC servicer context.

        Returns:
            Empty ChannelHasBeenCreatedResponse.
        """
        hook_name = "ChannelHasBeenCreated"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.ChannelHasBeenCreatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.channel,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"ChannelHasBeenCreated error: {error}")

        return hooks_user_channel_pb2.ChannelHasBeenCreatedResponse()

    async def UserHasJoinedChannel(
        self,
        request: hooks_user_channel_pb2.UserHasJoinedChannelRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasJoinedChannelResponse:
        """
        Handle UserHasJoinedChannel notification.

        Fire-and-forget notification when user joins a channel.
        Actor is optional (nil if self-join).

        Args:
            request: Contains context, plugin_context, channel_member, and optional actor.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasJoinedChannelResponse.
        """
        hook_name = "UserHasJoinedChannel"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasJoinedChannelResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Actor may be None (optional field)
        actor = request.actor if request.HasField("actor") else None

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.channel_member,
            actor,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasJoinedChannel error: {error}")

        return hooks_user_channel_pb2.UserHasJoinedChannelResponse()

    async def UserHasLeftChannel(
        self,
        request: hooks_user_channel_pb2.UserHasLeftChannelRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasLeftChannelResponse:
        """
        Handle UserHasLeftChannel notification.

        Fire-and-forget notification when user leaves a channel.
        Actor is optional (nil if self-removal).

        Args:
            request: Contains context, plugin_context, channel_member, and optional actor.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasLeftChannelResponse.
        """
        hook_name = "UserHasLeftChannel"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasLeftChannelResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        actor = request.actor if request.HasField("actor") else None

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.channel_member,
            actor,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasLeftChannel error: {error}")

        return hooks_user_channel_pb2.UserHasLeftChannelResponse()

    async def UserHasJoinedTeam(
        self,
        request: hooks_user_channel_pb2.UserHasJoinedTeamRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasJoinedTeamResponse:
        """
        Handle UserHasJoinedTeam notification.

        Fire-and-forget notification when user joins a team.
        Actor is optional (nil if self-join).

        Args:
            request: Contains context, plugin_context, team_member, and optional actor.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasJoinedTeamResponse.
        """
        hook_name = "UserHasJoinedTeam"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasJoinedTeamResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        actor = request.actor if request.HasField("actor") else None

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.team_member,
            actor,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasJoinedTeam error: {error}")

        return hooks_user_channel_pb2.UserHasJoinedTeamResponse()

    async def UserHasLeftTeam(
        self,
        request: hooks_user_channel_pb2.UserHasLeftTeamRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.UserHasLeftTeamResponse:
        """
        Handle UserHasLeftTeam notification.

        Fire-and-forget notification when user leaves a team.
        Actor is optional (nil if self-removal).

        Args:
            request: Contains context, plugin_context, team_member, and optional actor.
            context: The gRPC servicer context.

        Returns:
            Empty UserHasLeftTeamResponse.
        """
        hook_name = "UserHasLeftTeam"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.UserHasLeftTeamResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        actor = request.actor if request.HasField("actor") else None

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.team_member,
            actor,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"UserHasLeftTeam error: {error}")

        return hooks_user_channel_pb2.UserHasLeftTeamResponse()

    # =========================================================================
    # REACTION HOOKS
    # =========================================================================

    async def ReactionHasBeenAdded(
        self,
        request: hooks_message_pb2.ReactionHasBeenAddedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.ReactionHasBeenAddedResponse:
        """
        Handle ReactionHasBeenAdded notification.

        Fire-and-forget notification when a reaction is added.

        Args:
            request: Contains context, plugin_context, and reaction.
            context: The gRPC servicer context.

        Returns:
            Empty ReactionHasBeenAddedResponse.
        """
        hook_name = "ReactionHasBeenAdded"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.ReactionHasBeenAddedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.reaction,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"ReactionHasBeenAdded error: {error}")

        return hooks_message_pb2.ReactionHasBeenAddedResponse()

    async def ReactionHasBeenRemoved(
        self,
        request: hooks_message_pb2.ReactionHasBeenRemovedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.ReactionHasBeenRemovedResponse:
        """
        Handle ReactionHasBeenRemoved notification.

        Fire-and-forget notification when a reaction is removed.

        Args:
            request: Contains context, plugin_context, and reaction.
            context: The gRPC servicer context.

        Returns:
            Empty ReactionHasBeenRemovedResponse.
        """
        hook_name = "ReactionHasBeenRemoved"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.ReactionHasBeenRemovedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.reaction,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"ReactionHasBeenRemoved error: {error}")

        return hooks_message_pb2.ReactionHasBeenRemovedResponse()

    # =========================================================================
    # NOTIFICATION HOOKS
    # =========================================================================

    async def NotificationWillBePushed(
        self,
        request: hooks_message_pb2.NotificationWillBePushedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.NotificationWillBePushedResponse:
        """
        Handle NotificationWillBePushed hook.

        Called before a push notification is sent. Handler can:
        - Allow unchanged: return (None, "")
        - Modify: return (modified_notification, "")
        - Reject: return (None, "rejection reason")

        Args:
            request: Contains context, push_notification, and user_id.
            context: The gRPC servicer context.

        Returns:
            NotificationWillBePushedResponse with modified_notification and/or rejection_reason.
        """
        hook_name = "NotificationWillBePushed"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.NotificationWillBePushedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (push_notification, user_id) -> (notification, rejection)
        result, error = await self.runner.invoke(
            handler,
            request.push_notification,
            request.user_id,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"NotificationWillBePushed error: {error}")
            return hooks_message_pb2.NotificationWillBePushedResponse(
                rejection_reason=f"Plugin error: {error}",
            )

        # Parse result
        modified = None
        rejection_reason = ""

        if result is None:
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            notif, reason = result
            if notif is not None:
                modified = notif
            if reason:
                rejection_reason = str(reason)
        elif hasattr(result, "platform"):
            # Looks like a PushNotification
            modified = result
        elif isinstance(result, str):
            rejection_reason = result

        return hooks_message_pb2.NotificationWillBePushedResponse(
            modified_notification=modified,
            rejection_reason=rejection_reason,
        )

    async def EmailNotificationWillBeSent(
        self,
        request: hooks_message_pb2.EmailNotificationWillBeSentRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.EmailNotificationWillBeSentResponse:
        """
        Handle EmailNotificationWillBeSent hook.

        Called before an email notification is sent. Handler can:
        - Allow unchanged: return (None, "")
        - Modify: return (modified_content, "")
        - Reject: return (None, "rejection reason")

        Args:
            request: Contains context and email_notification (as EmailNotificationJson).
            context: The gRPC servicer context.

        Returns:
            EmailNotificationWillBeSentResponse with modified_content and/or rejection_reason.
        """
        hook_name = "EmailNotificationWillBeSent"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.EmailNotificationWillBeSentResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (email_notification) -> (content, rejection)
        result, error = await self.runner.invoke(
            handler,
            request.email_notification,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"EmailNotificationWillBeSent error: {error}")
            return hooks_message_pb2.EmailNotificationWillBeSentResponse(
                rejection_reason=f"Plugin error: {error}",
            )

        # Parse result
        modified = None
        rejection_reason = ""

        if result is None:
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            content, reason = result
            if content is not None:
                modified = content
            if reason:
                rejection_reason = str(reason)
        elif hasattr(result, "subject"):
            # Looks like EmailNotificationContent
            modified = result
        elif isinstance(result, str):
            rejection_reason = result

        return hooks_message_pb2.EmailNotificationWillBeSentResponse(
            modified_content=modified,
            rejection_reason=rejection_reason,
        )

    # =========================================================================
    # PREFERENCES HOOKS
    # =========================================================================

    async def PreferencesHaveChanged(
        self,
        request: hooks_message_pb2.PreferencesHaveChangedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_message_pb2.PreferencesHaveChangedResponse:
        """
        Handle PreferencesHaveChanged notification.

        Fire-and-forget notification when user preferences change.

        Args:
            request: Contains context, plugin_context, and preferences list.
            context: The gRPC servicer context.

        Returns:
            Empty PreferencesHaveChangedResponse.
        """
        hook_name = "PreferencesHaveChanged"

        if not self.plugin.has_hook(hook_name):
            return hooks_message_pb2.PreferencesHaveChangedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            list(request.preferences),
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"PreferencesHaveChanged error: {error}")

        return hooks_message_pb2.PreferencesHaveChangedResponse()

    # =========================================================================
    # SYSTEM HOOKS
    # =========================================================================

    async def OnInstall(
        self,
        request: hooks_lifecycle_pb2.OnInstallRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnInstallResponse:
        """
        Handle OnInstall hook.

        Called after plugin installation. Return error to indicate failure.

        Args:
            request: Contains context, plugin_context, and install event.
            context: The gRPC servicer context.

        Returns:
            OnInstallResponse with optional error.
        """
        hook_name = "OnInstall"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.OnInstallResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.event,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnInstall error: {error}")
            return hooks_lifecycle_pb2.OnInstallResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_install.error",
                    where="OnInstall",
                ),
            )

        # Handler may return an error explicitly
        if isinstance(result, Exception) or (isinstance(result, str) and result):
            return hooks_lifecycle_pb2.OnInstallResponse(
                error=_make_app_error(
                    message=str(result),
                    error_id="plugin.on_install.error",
                    where="OnInstall",
                ),
            )

        return hooks_lifecycle_pb2.OnInstallResponse()

    async def OnSendDailyTelemetry(
        self,
        request: hooks_lifecycle_pb2.OnSendDailyTelemetryRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnSendDailyTelemetryResponse:
        """
        Handle OnSendDailyTelemetry notification.

        Fire-and-forget notification when daily telemetry is sent.

        Args:
            request: Contains context.
            context: The gRPC servicer context.

        Returns:
            Empty OnSendDailyTelemetryResponse.
        """
        hook_name = "OnSendDailyTelemetry"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.OnSendDailyTelemetryResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSendDailyTelemetry error: {error}")

        return hooks_lifecycle_pb2.OnSendDailyTelemetryResponse()

    async def RunDataRetention(
        self,
        request: hooks_lifecycle_pb2.RunDataRetentionRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.RunDataRetentionResponse:
        """
        Handle RunDataRetention hook.

        Called during data retention job. Handler should delete old data
        and return the count of deleted items.

        Args:
            request: Contains context, now_time, and batch_size.
            context: The gRPC servicer context.

        Returns:
            RunDataRetentionResponse with deleted_count and optional error.
        """
        hook_name = "RunDataRetention"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.RunDataRetentionResponse(deleted_count=0)

        handler = self.plugin.get_hook_handler(hook_name)

        # Handler signature: (now_time, batch_size) -> (deleted_count, error)
        result, error = await self.runner.invoke(
            handler,
            request.now_time,
            request.batch_size,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"RunDataRetention error: {error}")
            return hooks_lifecycle_pb2.RunDataRetentionResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.run_data_retention.error",
                    where="RunDataRetention",
                ),
                deleted_count=0,
            )

        # Parse result
        deleted_count = 0
        if result is None:
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            count, err = result
            if count is not None:
                deleted_count = int(count)
            if err:
                return hooks_lifecycle_pb2.RunDataRetentionResponse(
                    error=_make_app_error(
                        message=str(err),
                        error_id="plugin.run_data_retention.error",
                        where="RunDataRetention",
                    ),
                    deleted_count=deleted_count,
                )
        elif isinstance(result, int):
            deleted_count = result

        return hooks_lifecycle_pb2.RunDataRetentionResponse(deleted_count=deleted_count)

    async def OnCloudLimitsUpdated(
        self,
        request: hooks_lifecycle_pb2.OnCloudLimitsUpdatedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_lifecycle_pb2.OnCloudLimitsUpdatedResponse:
        """
        Handle OnCloudLimitsUpdated notification.

        Fire-and-forget notification when cloud limits change.

        Args:
            request: Contains context and limits.
            context: The gRPC servicer context.

        Returns:
            Empty OnCloudLimitsUpdatedResponse.
        """
        hook_name = "OnCloudLimitsUpdated"

        if not self.plugin.has_hook(hook_name):
            return hooks_lifecycle_pb2.OnCloudLimitsUpdatedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.limits,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnCloudLimitsUpdated error: {error}")

        return hooks_lifecycle_pb2.OnCloudLimitsUpdatedResponse()

    # =========================================================================
    # WEBSOCKET HOOKS
    # =========================================================================

    async def OnWebSocketConnect(
        self,
        request: hooks_command_pb2.OnWebSocketConnectRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnWebSocketConnectResponse:
        """
        Handle OnWebSocketConnect notification.

        Fire-and-forget notification when a WebSocket connects.

        Args:
            request: Contains context, web_conn_id, and user_id.
            context: The gRPC servicer context.

        Returns:
            Empty OnWebSocketConnectResponse.
        """
        hook_name = "OnWebSocketConnect"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.OnWebSocketConnectResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.web_conn_id,
            request.user_id,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnWebSocketConnect error: {error}")

        return hooks_command_pb2.OnWebSocketConnectResponse()

    async def OnWebSocketDisconnect(
        self,
        request: hooks_command_pb2.OnWebSocketDisconnectRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnWebSocketDisconnectResponse:
        """
        Handle OnWebSocketDisconnect notification.

        Fire-and-forget notification when a WebSocket disconnects.

        Args:
            request: Contains context, web_conn_id, and user_id.
            context: The gRPC servicer context.

        Returns:
            Empty OnWebSocketDisconnectResponse.
        """
        hook_name = "OnWebSocketDisconnect"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.OnWebSocketDisconnectResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.web_conn_id,
            request.user_id,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnWebSocketDisconnect error: {error}")

        return hooks_command_pb2.OnWebSocketDisconnectResponse()

    async def WebSocketMessageHasBeenPosted(
        self,
        request: hooks_command_pb2.WebSocketMessageHasBeenPostedRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.WebSocketMessageHasBeenPostedResponse:
        """
        Handle WebSocketMessageHasBeenPosted notification.

        Fire-and-forget notification when a WebSocket message is received.

        Args:
            request: Contains context, web_conn_id, user_id, and request.
            context: The gRPC servicer context.

        Returns:
            Empty WebSocketMessageHasBeenPostedResponse.
        """
        hook_name = "WebSocketMessageHasBeenPosted"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.WebSocketMessageHasBeenPostedResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.web_conn_id,
            request.user_id,
            request.request,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"WebSocketMessageHasBeenPosted error: {error}")

        return hooks_command_pb2.WebSocketMessageHasBeenPostedResponse()

    # =========================================================================
    # CLUSTER HOOKS
    # =========================================================================

    async def OnPluginClusterEvent(
        self,
        request: hooks_command_pb2.OnPluginClusterEventRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnPluginClusterEventResponse:
        """
        Handle OnPluginClusterEvent notification.

        Fire-and-forget notification for intra-cluster plugin events.

        Args:
            request: Contains context, plugin_context, and event.
            context: The gRPC servicer context.

        Returns:
            Empty OnPluginClusterEventResponse.
        """
        hook_name = "OnPluginClusterEvent"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.OnPluginClusterEventResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        _, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.event,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnPluginClusterEvent error: {error}")

        return hooks_command_pb2.OnPluginClusterEventResponse()

    # =========================================================================
    # SHARED CHANNELS HOOKS
    # =========================================================================

    async def OnSharedChannelsSyncMsg(
        self,
        request: hooks_command_pb2.OnSharedChannelsSyncMsgRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnSharedChannelsSyncMsgResponse:
        """
        Handle OnSharedChannelsSyncMsg hook.

        Called when a shared channels sync message is received.

        Args:
            request: Contains context, sync_msg, and remote_cluster.
            context: The gRPC servicer context.

        Returns:
            OnSharedChannelsSyncMsgResponse with response or error.
        """
        hook_name = "OnSharedChannelsSyncMsg"

        if not self.plugin.has_hook(hook_name):
            # Not implemented - return empty response (no sync)
            return hooks_command_pb2.OnSharedChannelsSyncMsgResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.sync_msg,
            request.remote_cluster,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSharedChannelsSyncMsg error: {error}")
            return hooks_command_pb2.OnSharedChannelsSyncMsgResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_shared_channels_sync_msg.error",
                    where="OnSharedChannelsSyncMsg",
                ),
            )

        # Parse result
        if result is None:
            return hooks_command_pb2.OnSharedChannelsSyncMsgResponse()
        elif isinstance(result, tuple) and len(result) == 2:
            response, err = result
            if err:
                return hooks_command_pb2.OnSharedChannelsSyncMsgResponse(
                    error=_make_app_error(
                        message=str(err),
                        error_id="plugin.on_shared_channels_sync_msg.error",
                        where="OnSharedChannelsSyncMsg",
                    ),
                )
            if response is not None:
                return hooks_command_pb2.OnSharedChannelsSyncMsgResponse(
                    response=response
                )
        elif hasattr(result, "users_last_update_at"):
            # Looks like a SyncResponse
            return hooks_command_pb2.OnSharedChannelsSyncMsgResponse(response=result)

        return hooks_command_pb2.OnSharedChannelsSyncMsgResponse()

    async def OnSharedChannelsPing(
        self,
        request: hooks_command_pb2.OnSharedChannelsPingRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnSharedChannelsPingResponse:
        """
        Handle OnSharedChannelsPing hook.

        Called to check health of shared channels plugin connection.
        Return True if healthy, False otherwise.

        Args:
            request: Contains context and remote_cluster.
            context: The gRPC servicer context.

        Returns:
            OnSharedChannelsPingResponse with healthy status.
        """
        hook_name = "OnSharedChannelsPing"

        if not self.plugin.has_hook(hook_name):
            # Not implemented - assume healthy
            return hooks_command_pb2.OnSharedChannelsPingResponse(healthy=True)

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.remote_cluster,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSharedChannelsPing error: {error}")
            return hooks_command_pb2.OnSharedChannelsPingResponse(healthy=False)

        # Result should be a boolean
        healthy = bool(result) if result is not None else True

        return hooks_command_pb2.OnSharedChannelsPingResponse(healthy=healthy)

    async def OnSharedChannelsAttachmentSyncMsg(
        self,
        request: hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgResponse:
        """
        Handle OnSharedChannelsAttachmentSyncMsg hook.

        Called when a file attachment sync message is received.

        Args:
            request: Contains context, file_info, post, and remote_cluster.
            context: The gRPC servicer context.

        Returns:
            OnSharedChannelsAttachmentSyncMsgResponse with optional error.
        """
        hook_name = "OnSharedChannelsAttachmentSyncMsg"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.file_info,
            request.post,
            request.remote_cluster,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSharedChannelsAttachmentSyncMsg error: {error}")
            return hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_shared_channels_attachment_sync_msg.error",
                    where="OnSharedChannelsAttachmentSyncMsg",
                ),
            )

        # Handler may return an error
        if isinstance(result, Exception) or (isinstance(result, str) and result):
            return hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgResponse(
                error=_make_app_error(
                    message=str(result),
                    error_id="plugin.on_shared_channels_attachment_sync_msg.error",
                    where="OnSharedChannelsAttachmentSyncMsg",
                ),
            )

        return hooks_command_pb2.OnSharedChannelsAttachmentSyncMsgResponse()

    async def OnSharedChannelsProfileImageSyncMsg(
        self,
        request: hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgResponse:
        """
        Handle OnSharedChannelsProfileImageSyncMsg hook.

        Called when a profile image sync message is received.

        Args:
            request: Contains context, user, and remote_cluster.
            context: The gRPC servicer context.

        Returns:
            OnSharedChannelsProfileImageSyncMsgResponse with optional error.
        """
        hook_name = "OnSharedChannelsProfileImageSyncMsg"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.user,
            request.remote_cluster,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSharedChannelsProfileImageSyncMsg error: {error}")
            return hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_shared_channels_profile_image_sync_msg.error",
                    where="OnSharedChannelsProfileImageSyncMsg",
                ),
            )

        # Handler may return an error
        if isinstance(result, Exception) or (isinstance(result, str) and result):
            return hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgResponse(
                error=_make_app_error(
                    message=str(result),
                    error_id="plugin.on_shared_channels_profile_image_sync_msg.error",
                    where="OnSharedChannelsProfileImageSyncMsg",
                ),
            )

        return hooks_command_pb2.OnSharedChannelsProfileImageSyncMsgResponse()

    # =========================================================================
    # SUPPORT HOOKS
    # =========================================================================

    async def GenerateSupportData(
        self,
        request: hooks_command_pb2.GenerateSupportDataRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_command_pb2.GenerateSupportDataResponse:
        """
        Handle GenerateSupportData hook.

        Called when generating a support packet. Handler should return
        a list of FileData objects to include in the packet.

        Args:
            request: Contains context and plugin_context.
            context: The gRPC servicer context.

        Returns:
            GenerateSupportDataResponse with files list and optional error.
        """
        hook_name = "GenerateSupportData"

        if not self.plugin.has_hook(hook_name):
            return hooks_command_pb2.GenerateSupportDataResponse(files=[])

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"GenerateSupportData error: {error}")
            return hooks_command_pb2.GenerateSupportDataResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.generate_support_data.error",
                    where="GenerateSupportData",
                ),
                files=[],
            )

        # Parse result
        files = []
        if result is None:
            pass
        elif isinstance(result, tuple) and len(result) == 2:
            file_list, err = result
            if err:
                return hooks_command_pb2.GenerateSupportDataResponse(
                    error=_make_app_error(
                        message=str(err),
                        error_id="plugin.generate_support_data.error",
                        where="GenerateSupportData",
                    ),
                    files=[],
                )
            if file_list is not None:
                files = list(file_list)
        elif isinstance(result, (list, tuple)):
            files = list(result)

        return hooks_command_pb2.GenerateSupportDataResponse(files=files)

    # =========================================================================
    # SAML HOOKS
    # =========================================================================

    async def OnSAMLLogin(
        self,
        request: hooks_user_channel_pb2.OnSAMLLoginRequest,
        context: grpc.aio.ServicerContext,
    ) -> hooks_user_channel_pb2.OnSAMLLoginResponse:
        """
        Handle OnSAMLLogin hook.

        Called after a successful SAML login. Return error to reject.

        Args:
            request: Contains context, plugin_context, user, and assertion.
            context: The gRPC servicer context.

        Returns:
            OnSAMLLoginResponse with optional error.
        """
        hook_name = "OnSAMLLogin"

        if not self.plugin.has_hook(hook_name):
            return hooks_user_channel_pb2.OnSAMLLoginResponse()

        handler = self.plugin.get_hook_handler(hook_name)

        result, error = await self.runner.invoke(
            handler,
            request.plugin_context,
            request.user,
            request.assertion,
            hook_name=hook_name,
            context=context,
        )

        if error is not None:
            self._logger.error(f"OnSAMLLogin error: {error}")
            return hooks_user_channel_pb2.OnSAMLLoginResponse(
                error=_make_app_error(
                    message=str(error),
                    error_id="plugin.on_saml_login.error",
                    where="OnSAMLLogin",
                ),
            )

        # Handler may return an error
        if isinstance(result, Exception) or (isinstance(result, str) and result):
            return hooks_user_channel_pb2.OnSAMLLoginResponse(
                error=_make_app_error(
                    message=str(result),
                    error_id="plugin.on_saml_login.error",
                    where="OnSAMLLogin",
                ),
            )

        return hooks_user_channel_pb2.OnSAMLLoginResponse()

    # =========================================================================
    # DEFERRED HOOKS (Phase 8 - Streaming)
    # =========================================================================
    #
    # The following hooks are deferred to Phase 8 because they require
    # HTTP request/response streaming or large file handling:
    #
    # - ServeHTTP: HTTP request/response streaming over gRPC
    # - ServeMetrics: HTTP request/response streaming over gRPC
    # - FileWillBeUploaded: Large file body streaming (may have size limits)
    #
    # These are NOT included in Implemented() until Phase 8 adds support.
    # =========================================================================
