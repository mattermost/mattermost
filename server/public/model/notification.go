// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type NotificationStatus string
type NotificationType string
type NotificationReason string

const (
	NotificationStatusSuccess     NotificationStatus = "success"
	NotificationStatusError       NotificationStatus = "error"
	NotificationStatusNotSent     NotificationStatus = "not_sent"
	NotificationStatusUnsupported NotificationStatus = "unsupported"

	NotificationTypeAll       NotificationType = "all"
	NotificationTypeEmail     NotificationType = "email"
	NotificationTypeWebsocket NotificationType = "websocket"
	NotificationTypePush      NotificationType = "push"

	NotificationNoPlatform = "no_platform"

	NotificationReasonFetchError                         NotificationReason = "fetch_error"
	NotificationReasonParseError                         NotificationReason = "json_parse_error"
	NotificationReasonMarshalError                       NotificationReason = "json_marshal_error"
	NotificationReasonPushProxyError                     NotificationReason = "push_proxy_error"
	NotificationReasonPushProxySendError                 NotificationReason = "push_proxy_send_error"
	NotificationReasonPushProxyRemoveDevice              NotificationReason = "push_proxy_remove_device"
	NotificationReasonRejectedByPlugin                   NotificationReason = "rejected_by_plugin"
	NotificationReasonSessionExpired                     NotificationReason = "session_expired"
	NotificationReasonChannelMuted                       NotificationReason = "channel_muted"
	NotificationReasonSystemMessage                      NotificationReason = "system_message"
	NotificationReasonLevelSetToNone                     NotificationReason = "notify_level_none"
	NotificationReasonNotMentioned                       NotificationReason = "not_mentioned"
	NotificationReasonUserStatus                         NotificationReason = "user_status"
	NotificationReasonUserIsActive                       NotificationReason = "user_is_active"
	NotificationReasonMissingProfile                     NotificationReason = "missing_profile"
	NotificationReasonEmailNotVerified                   NotificationReason = "email_not_verified"
	NotificationReasonEmailSendError                     NotificationReason = "email_send_error"
	NotificationReasonTooManyUsersInChannel              NotificationReason = "too_many_users_in_channel"
	NotificationReasonResolvePersistentNotificationError NotificationReason = "resolve_persistent_notification_error"
	NotificationReasonMissingThreadMembership            NotificationReason = "missing_thread_membership"
)
