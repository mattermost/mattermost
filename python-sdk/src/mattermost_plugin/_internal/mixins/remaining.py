# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Remaining API methods mixin for PluginAPIClient.

This module provides all remaining API methods not covered by other mixins:
- Server/license methods
- Shared channel methods
- Property methods
- Audit methods
- Miscellaneous methods (dialogs, mail, notifications, etc.)
- Emoji methods
- Upload session methods
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

import grpc

from mattermost_plugin._internal.wrappers import (
    SharedChannel,
    AuditRecord,
    OpenDialogRequest,
    PushNotification,
    Emoji,
    UploadSession,
    FileInfo,
    PostList,
)
from mattermost_plugin.exceptions import convert_grpc_error, convert_app_error

if TYPE_CHECKING:
    from mattermost_plugin.grpc import api_pb2_grpc


class RemainingMixin:
    """Mixin providing remaining API methods."""

    # These will be provided by the main client class
    _stub: Optional["api_pb2_grpc.PluginAPIStub"]

    def _ensure_connected(self) -> "api_pb2_grpc.PluginAPIStub":
        """Ensure connected and return stub - implemented by main client."""
        raise NotImplementedError

    # =========================================================================
    # Server/License Methods
    # =========================================================================

    def get_license(self) -> bytes:
        """
        Get the server license.

        Returns:
            JSON-encoded license data.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetLicenseRequest()

        try:
            response = stub.GetLicense(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.license_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def is_enterprise_ready(self) -> bool:
        """
        Check if the server is enterprise-ready.

        Returns:
            True if enterprise-ready, False otherwise.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.IsEnterpriseReadyRequest()

        try:
            response = stub.IsEnterpriseReady(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.is_enterprise_ready

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_telemetry_id(self) -> str:
        """
        Get the telemetry ID.

        Returns:
            The telemetry ID string.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetTelemetryIdRequest()

        try:
            response = stub.GetTelemetryId(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.telemetry_id

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_cloud_limits(self) -> bytes:
        """
        Get cloud usage limits.

        Returns:
            JSON-encoded cloud limits data.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.GetCloudLimitsRequest()

        try:
            response = stub.GetCloudLimits(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.limits_json

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def request_trial_license(
        self,
        requester_id: str,
        users: int,
        *,
        terms_accepted: bool = False,
        receive_emails_accepted: bool = False,
    ) -> None:
        """
        Request a trial license.

        Args:
            requester_id: ID of the user requesting the trial.
            users: Number of users for the trial.
            terms_accepted: Whether terms have been accepted.
            receive_emails_accepted: Whether to receive marketing emails.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RequestTrialLicenseRequest(
            requester_id=requester_id,
            users=users,
            terms_accepted=terms_accepted,
            receive_emails_accepted=receive_emails_accepted,
        )

        try:
            response = stub.RequestTrialLicense(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Shared Channel Methods
    # =========================================================================

    def register_plugin_for_shared_channels(
        self,
        plugin_id: str,
        display_name: str,
        description: str = "",
    ) -> str:
        """
        Register a plugin for shared channels.

        Args:
            plugin_id: ID of the plugin.
            display_name: Display name for the shared channel remote.
            description: Description of the remote.

        Returns:
            The remote ID.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        opts = api_remaining_pb2.RegisterPluginOpts(
            plugin_id=plugin_id,
            display_name=display_name,
            description=description,
        )
        request = api_remaining_pb2.RegisterPluginForSharedChannelsRequest(opts=opts)

        try:
            response = stub.RegisterPluginForSharedChannels(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.remote_id

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def unregister_plugin_for_shared_channels(self, plugin_id: str) -> None:
        """
        Unregister a plugin from shared channels.

        Args:
            plugin_id: ID of the plugin.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UnregisterPluginForSharedChannelsRequest(
            plugin_id=plugin_id
        )

        try:
            response = stub.UnregisterPluginForSharedChannels(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def share_channel(self, shared_channel: SharedChannel) -> SharedChannel:
        """
        Share a channel.

        Args:
            shared_channel: SharedChannel object.

        Returns:
            The created SharedChannel.

        Raises:
            ValidationError: If shared channel data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.ShareChannelRequest(
            shared_channel=shared_channel.to_proto()
        )

        try:
            response = stub.ShareChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return SharedChannel.from_proto(response.shared_channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_shared_channel(self, shared_channel: SharedChannel) -> SharedChannel:
        """
        Update a shared channel.

        Args:
            shared_channel: SharedChannel object with updated fields.

        Returns:
            The updated SharedChannel.

        Raises:
            NotFoundError: If shared channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UpdateSharedChannelRequest(
            shared_channel=shared_channel.to_proto()
        )

        try:
            response = stub.UpdateSharedChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return SharedChannel.from_proto(response.shared_channel)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def unshare_channel(self, channel_id: str) -> bool:
        """
        Unshare a channel.

        Args:
            channel_id: ID of the channel to unshare.

        Returns:
            True if successfully unshared.

        Raises:
            NotFoundError: If channel is not shared.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UnshareChannelRequest(channel_id=channel_id)

        try:
            response = stub.UnshareChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.unshared

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def update_shared_channel_cursor(
        self,
        channel_id: str,
        remote_id: str,
        last_post_update_at: int,
        last_post_id: str,
    ) -> None:
        """
        Update the sync cursor for a shared channel.

        Args:
            channel_id: ID of the channel.
            remote_id: Remote cluster ID.
            last_post_update_at: Timestamp of last synced post.
            last_post_id: ID of last synced post.

        Raises:
            NotFoundError: If shared channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        cursor = api_remaining_pb2.GetPostsSinceForSyncCursor(
            last_post_update_at=last_post_update_at,
            last_post_id=last_post_id,
        )
        request = api_remaining_pb2.UpdateSharedChannelCursorRequest(
            channel_id=channel_id,
            remote_id=remote_id,
            cursor=cursor,
        )

        try:
            response = stub.UpdateSharedChannelCursor(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def sync_shared_channel(self, channel_id: str) -> None:
        """
        Trigger a sync for a shared channel.

        Args:
            channel_id: ID of the channel to sync.

        Raises:
            NotFoundError: If shared channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.SyncSharedChannelRequest(channel_id=channel_id)

        try:
            response = stub.SyncSharedChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def invite_remote_to_channel(
        self,
        channel_id: str,
        remote_id: str,
        user_id: str,
        *,
        share_if_not_shared: bool = False,
    ) -> None:
        """
        Invite a remote to a shared channel.

        Args:
            channel_id: ID of the channel.
            remote_id: Remote cluster ID.
            user_id: ID of the user inviting.
            share_if_not_shared: Whether to share the channel if not already shared.

        Raises:
            NotFoundError: If channel or remote does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.InviteRemoteToChannelRequest(
            channel_id=channel_id,
            remote_id=remote_id,
            user_id=user_id,
            share_if_not_shared=share_if_not_shared,
        )

        try:
            response = stub.InviteRemoteToChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def uninvite_remote_from_channel(self, channel_id: str, remote_id: str) -> None:
        """
        Uninvite a remote from a shared channel.

        Args:
            channel_id: ID of the channel.
            remote_id: Remote cluster ID.

        Raises:
            NotFoundError: If channel or remote does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.UninviteRemoteFromChannelRequest(
            channel_id=channel_id,
            remote_id=remote_id,
        )

        try:
            response = stub.UninviteRemoteFromChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Audit Methods
    # =========================================================================

    def log_audit_rec(self, record: AuditRecord) -> None:
        """
        Log an audit record.

        Args:
            record: AuditRecord to log.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.LogAuditRecRequest(record=record.to_proto())

        try:
            response = stub.LogAuditRec(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def log_audit_rec_with_level(self, record: AuditRecord, level: str) -> None:
        """
        Log an audit record with a specific level.

        Args:
            record: AuditRecord to log.
            level: Log level ("debug", "info", "warn", "error").

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.LogAuditRecWithLevelRequest(
            record=record.to_proto(),
            level=level,
        )

        try:
            response = stub.LogAuditRecWithLevel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Dialog Methods
    # =========================================================================

    def open_interactive_dialog(self, dialog_request: OpenDialogRequest) -> None:
        """
        Open an interactive dialog.

        Args:
            dialog_request: OpenDialogRequest containing the dialog to open.

        Raises:
            ValidationError: If dialog data is invalid.
            PluginAPIError: If the API call fails.

        Example:
            >>> from mattermost_plugin._internal.wrappers import Dialog, DialogElement
            >>> dialog = Dialog(
            ...     callback_id="my_callback",
            ...     title="My Dialog",
            ...     elements=[DialogElement(name="input", type="text", display_name="Input")]
            ... )
            >>> request = OpenDialogRequest(trigger_id="trigger123", url="/callback", dialog=dialog)
            >>> client.open_interactive_dialog(request)
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.OpenInteractiveDialogRequest(
            dialog=dialog_request.to_proto()
        )

        try:
            response = stub.OpenInteractiveDialog(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Communication Methods
    # =========================================================================

    def send_mail(self, to: str, subject: str, html_body: str) -> None:
        """
        Send an email.

        Args:
            to: Email recipient.
            subject: Email subject.
            html_body: HTML body of the email.

        Raises:
            ValidationError: If email data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.SendMailRequest(
            to=to,
            subject=subject,
            html_body=html_body,
        )

        try:
            response = stub.SendMail(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def send_push_notification(
        self, notification: PushNotification, user_id: str
    ) -> None:
        """
        Send a push notification.

        Args:
            notification: PushNotification to send.
            user_id: ID of the user to notify.

        Raises:
            NotFoundError: If user does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.SendPushNotificationRequest(
            notification=notification.to_proto(),
            user_id=user_id,
        )

        try:
            response = stub.SendPushNotification(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def publish_web_socket_event(
        self,
        event: str,
        payload: Dict[str, str],
        broadcast: Dict[str, Any],
    ) -> None:
        """
        Publish a WebSocket event.

        Args:
            event: Event name.
            payload: Event payload.
            broadcast: Broadcast settings (user_id, channel_id, team_id, etc.).

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_kv_config_pb2

        # Build broadcast proto
        broadcast_proto = api_kv_config_pb2.WebSocketBroadcast(
            user_id=broadcast.get("user_id", ""),
            channel_id=broadcast.get("channel_id", ""),
            team_id=broadcast.get("team_id", ""),
            omit_connection_id=broadcast.get("omit_connection_id", ""),
            connection_id=broadcast.get("connection_id", ""),
            omit_users=broadcast.get("omit_users", {}),
        )

        request = api_kv_config_pb2.PublishWebSocketEventRequest(
            event=event,
            payload=payload,
            broadcast=broadcast_proto,
        )

        try:
            response = stub.PublishWebSocketEvent(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def publish_plugin_cluster_event(
        self,
        event_id: str,
        data: bytes,
        *,
        send_type: str = "reliable",
        target_id: str = "",
    ) -> None:
        """
        Publish a plugin cluster event.

        Args:
            event_id: Event identifier.
            data: Event data.
            send_type: "reliable" or "best_effort".
            target_id: Target node ID (empty for all nodes).

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        event = api_remaining_pb2.PluginClusterEvent(id=event_id, data=data)
        opts = api_remaining_pb2.PluginClusterEventSendOptions(
            send_type=send_type,
            target_id=target_id,
        )
        request = api_remaining_pb2.PublishPluginClusterEventRequest(
            event=event,
            opts=opts,
        )

        try:
            response = stub.PublishPluginClusterEvent(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Miscellaneous Methods
    # =========================================================================

    def plugin_http(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        body: bytes = b"",
    ) -> tuple:
        """
        Make an HTTP request through the plugin API.

        Args:
            method: HTTP method (GET, POST, etc.).
            url: Request URL.
            headers: Request headers.
            body: Request body.

        Returns:
            Tuple of (status_code, response_headers, response_body).

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.PluginHTTPRequest(
            method=method,
            url=url,
            headers=headers or {},
            body=body,
        )

        try:
            response = stub.PluginHTTP(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return (response.status_code, dict(response.headers), response.body)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def register_collection_and_topic(
        self, collection_type: str, topic_type: str
    ) -> None:
        """
        Register a collection and topic for plugin posts.

        Args:
            collection_type: Type of collection.
            topic_type: Type of topic.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RegisterCollectionAndTopicRequest(
            collection_type=collection_type,
            topic_type=topic_type,
        )

        try:
            response = stub.RegisterCollectionAndTopic(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def roles_grant_permission(
        self, role_names: List[str], permission_id: str
    ) -> bool:
        """
        Check if any of the given roles grant a permission.

        Args:
            role_names: List of role names.
            permission_id: Permission ID to check.

        Returns:
            True if permission is granted, False otherwise.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_remaining_pb2

        request = api_remaining_pb2.RolesGrantPermissionRequest(
            role_names=role_names,
            permission_id=permission_id,
        )

        try:
            response = stub.RolesGrantPermission(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.has_permission

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Emoji Methods
    # =========================================================================

    def get_emoji_list(
        self, *, page: int = 0, per_page: int = 60, sort: str = ""
    ) -> List[Emoji]:
        """
        Get a list of custom emojis.

        Args:
            page: Page number (0-indexed).
            per_page: Results per page.
            sort: Sort order ("name" or empty).

        Returns:
            List of Emoji objects.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetEmojiListRequest(
            page=page,
            per_page=per_page,
            sort=sort,
        )

        try:
            response = stub.GetEmojiList(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return [Emoji.from_proto(e) for e in response.emojis]

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_emoji(self, emoji_id: str) -> Emoji:
        """
        Get an emoji by ID.

        Args:
            emoji_id: ID of the emoji.

        Returns:
            The Emoji object.

        Raises:
            NotFoundError: If emoji does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetEmojiRequest(emoji_id=emoji_id)

        try:
            response = stub.GetEmoji(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Emoji.from_proto(response.emoji)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_emoji_by_name(self, name: str) -> Emoji:
        """
        Get an emoji by name.

        Args:
            name: Name of the emoji (without colons).

        Returns:
            The Emoji object.

        Raises:
            NotFoundError: If emoji does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetEmojiByNameRequest(name=name)

        try:
            response = stub.GetEmojiByName(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return Emoji.from_proto(response.emoji)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_emoji_image(self, emoji_id: str) -> bytes:
        """
        Get the image data for an emoji.

        Args:
            emoji_id: ID of the emoji.

        Returns:
            Image data as bytes.

        Raises:
            NotFoundError: If emoji does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetEmojiImageRequest(emoji_id=emoji_id)

        try:
            response = stub.GetEmojiImage(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return response.image_data

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Upload Session Methods
    # =========================================================================

    def create_upload_session(self, session: UploadSession) -> UploadSession:
        """
        Create an upload session for resumable uploads.

        Args:
            session: UploadSession with file metadata.

        Returns:
            The created UploadSession with assigned ID.

        Raises:
            ValidationError: If session data is invalid.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.CreateUploadSessionRequest(
            upload_session=session.to_proto()
        )

        try:
            response = stub.CreateUploadSession(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UploadSession.from_proto(response.upload_session)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def upload_data(self, session: UploadSession, data: bytes) -> FileInfo:
        """
        Upload data for an upload session.

        Args:
            session: The UploadSession.
            data: Data to upload.

        Returns:
            FileInfo for the completed upload.

        Raises:
            NotFoundError: If session does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.UploadDataRequest(
            upload_session=session.to_proto(),
            data=data,
        )

        try:
            response = stub.UploadData(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return FileInfo.from_proto(response.file_info)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def get_upload_session(self, upload_id: str) -> UploadSession:
        """
        Get an upload session by ID.

        Args:
            upload_id: ID of the upload session.

        Returns:
            The UploadSession object.

        Raises:
            NotFoundError: If session does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_file_bot_pb2

        request = api_file_bot_pb2.GetUploadSessionRequest(upload_id=upload_id)

        try:
            response = stub.GetUploadSession(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return UploadSession.from_proto(response.upload_session)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    # =========================================================================
    # Post Search Methods
    # =========================================================================

    def get_posts_for_channel(
        self, channel_id: str, *, page: int = 0, per_page: int = 60
    ) -> PostList:
        """
        Get posts for a channel.

        Args:
            channel_id: ID of the channel.
            page: Page number (0-indexed).
            per_page: Results per page.

        Returns:
            PostList containing posts.

        Raises:
            NotFoundError: If channel does not exist.
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.GetPostsForChannelRequest(
            channel_id=channel_id,
            page=page,
            per_page=per_page,
        )

        try:
            response = stub.GetPostsForChannel(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_posts_in_team(self, team_id: str, terms: str) -> PostList:
        """
        Search posts in a team.

        Args:
            team_id: ID of the team.
            terms: Search terms.

        Returns:
            PostList containing matching posts.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.SearchPostsInTeamRequest(
            team_id=team_id,
            terms=terms,
        )

        try:
            response = stub.SearchPostsInTeam(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e

    def search_posts_in_team_for_user(
        self, team_id: str, user_id: str, terms: str
    ) -> PostList:
        """
        Search posts in a team for a specific user.

        Args:
            team_id: ID of the team.
            user_id: ID of the user to search as.
            terms: Search terms.

        Returns:
            PostList containing matching posts.

        Raises:
            PluginAPIError: If the API call fails.
        """
        stub = self._ensure_connected()

        from mattermost_plugin.grpc import api_channel_post_pb2

        request = api_channel_post_pb2.SearchPostsInTeamForUserRequest(
            team_id=team_id,
            user_id=user_id,
            terms=terms,
        )

        try:
            response = stub.SearchPostsInTeamForUser(request)

            if response.HasField("error") and response.error.id:
                raise convert_app_error(response.error)

            return PostList.from_proto(response.post_list)

        except grpc.RpcError as e:
            raise convert_grpc_error(e) from e
