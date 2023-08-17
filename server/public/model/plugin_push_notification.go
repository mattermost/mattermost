// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginPushNotification is sent to the plugin when a push notification is going to be sent (via the
// NotificationWillBePushed hook), and is used as the source data for the plugin api SendPluginPushNotification method.
type PluginPushNotification struct {
	Post               *Post
	Channel            *Channel
	UserID             string
	ExplicitMention    bool   // Used to construct the generic "@sender mentioned you" msg when `cfg.EmailSettings.PushNotificationContents` is not set to `full`
	ChannelWideMention bool   // Used to construct the generic "@sender notified the channel" msg when `cfg.EmailSettings.PushNotificationContents` is not set to `full`
	ReplyToThreadType  string // Used to construct the generic CRT msgs when `cfg.EmailSettings.PushNotificationContents` is not set to `full`; see `App.getPushNotificationMessage` for details.
}
