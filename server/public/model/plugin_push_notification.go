// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginPushNotification is sent to the plugin when a push notification is going to be sent (via the
// NotificationWillBePushed hook), and is used as the source data for the plugin api SendPluginPushNotification method.
//
// Note: Please keep in mind that Mattermost push notifications always refer to a specific post. Therefore, when used
// as source data for `SendPluginPushNotification`, Post and Channel must be valid in order to create a correct
// model.PushNotification.
// Note: Post and Channel are pointers so that plugins using the NotificationWillBePushed hook will not need to query the
// database on every push notification.
type PluginPushNotification struct {
	Post               *Post    // The post that will be used as the source of the push notification.
	Channel            *Channel // The channel that the post appeared in.
	UserID             string   // The receiver of the push notification.
	ExplicitMention    bool     // Used to construct the generic "@sender mentioned you" msg when `cfg.EmailSettings.PushNotificationContents` is not set to `full`
	ChannelWideMention bool     // Used to construct the generic "@sender notified the channel" msg when `cfg.EmailSettings.PushNotificationContents` is not set to `full`
	ReplyToThreadType  string   // Used to construct the generic CRT msgs when `cfg.EmailSettings.PushNotificationContents` is not set to `full`; see `App.getPushNotificationMessage` for details.
}
