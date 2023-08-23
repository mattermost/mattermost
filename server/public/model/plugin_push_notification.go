// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginPushNotification is sent to the plugin when a push notification is going to be sent (via the
// NotificationWillBePushed hook).
type PluginPushNotification struct {
	Post    *Post
	Channel *Channel
	UserID  string
}
