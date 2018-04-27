// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestDoesNotifyPropsAllowPushNotification(t *testing.T) {
	userNotifyProps := make(map[string]string)
	channelNotifyProps := make(map[string]string)

	user := &model.User{Id: model.NewId(), Email: "unit@test.com"}

	post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}

	// When the post is a System Message
	systemPost := &model.Post{UserId: user.Id, Type: model.POST_JOIN_CHANNEL}
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, systemPost, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, systemPost, true) {
		t.Fatal("Should have returned false")
	}

	// When default is ALL and no channel props is set
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// When default is MENTION and no channel props is set
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// When default is NONE and no channel props is set
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is ALL and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is ALL and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is ALL and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is ALL and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is MENTION and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is NONE and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is ALL and channel is MUTED
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}
}

func TestDoesStatusAllowPushNotification(t *testing.T) {
	userNotifyProps := make(map[string]string)
	userId := model.NewId()
	channelId := model.NewId()

	offline := &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	away := &model.Status{UserId: userId, Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	online := &model.Status{UserId: userId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	dnd := &model.Status{UserId: userId, Status: model.STATUS_DND, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	userNotifyProps["push_status"] = model.STATUS_ONLINE
	// WHEN props is ONLINE and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is ONLINE and user is away
	if !DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is ONLINE and user is online
	if !DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been true")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is ONLINE and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

	userNotifyProps["push_status"] = model.STATUS_AWAY
	// WHEN props is AWAY and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is AWAY and user is away
	if !DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is AWAY and user is online
	if DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is AWAY and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

	userNotifyProps["push_status"] = model.STATUS_OFFLINE
	// WHEN props is OFFLINE and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is OFFLINE and user is away
	if DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is OFFLINE and user is online
	if DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is OFFLINE and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

}

func TestGetDirectMessageNotificationEmailSubject(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] New Direct Message from sender on"
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	subject := getDirectMessageNotificationEmailSubject(post, translateFunc, "http://localhost:8065", "sender")
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetPushNotificationMessage(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	for name, tc := range map[string]struct {
		Message                  string
		WasMentioned             bool
		HasFiles                 bool
		Locale                   string
		PushNotificationContents string
		ChannelType              string

		ExpectedMessage  string
		ExpectedCategory string
	}{
		"full message, public channel, no mention": {
			Message:          "this is a message",
			ChannelType:      model.CHANNEL_OPEN,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, public channel, mention": {
			Message:          "this is a message",
			WasMentioned:     true,
			ChannelType:      model.CHANNEL_OPEN,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, private channel, no mention": {
			Message:          "this is a message",
			ChannelType:      model.CHANNEL_PRIVATE,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, private channel, mention": {
			Message:          "this is a message",
			WasMentioned:     true,
			ChannelType:      model.CHANNEL_PRIVATE,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, group message channel, no mention": {
			Message:          "this is a message",
			ChannelType:      model.CHANNEL_GROUP,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, group message channel, mention": {
			Message:          "this is a message",
			WasMentioned:     true,
			ChannelType:      model.CHANNEL_GROUP,
			ExpectedMessage:  "user in channel: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, direct message channel, no mention": {
			Message:          "this is a message",
			ChannelType:      model.CHANNEL_DIRECT,
			ExpectedMessage:  "user: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"full message, direct message channel, mention": {
			Message:          "this is a message",
			WasMentioned:     true,
			ChannelType:      model.CHANNEL_DIRECT,
			ExpectedMessage:  "user: this is a message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"generic message with channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user posted in channel",
		},
		"generic message with channel, public channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user mentioned you in channel",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message with channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user posted in channel",
		},
		"generic message with channel, private channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user mentioned you in channel",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message with channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user posted in channel",
		},
		"generic message with channel, group message channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user mentioned you in channel",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message with channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "user sent you a direct message",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message with channel, direct message channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "user sent you a direct message",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message without channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user posted a message",
		},
		"generic message without channel, public channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user mentioned you",
		},
		"generic message without channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user posted a message",
		},
		"generic message without channel, private channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user mentioned you",
		},
		"generic message without channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user posted a message",
		},
		"generic message without channel, group message channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user mentioned you",
		},
		"generic message without channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "user sent you a direct message",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"generic message without channel, direct message channel, mention": {
			Message:                  "this is a message",
			WasMentioned:             true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "user sent you a direct message",
			ExpectedCategory:         model.CATEGORY_CAN_REPLY,
		},
		"only files, public channel": {
			HasFiles:         true,
			ChannelType:      model.CHANNEL_OPEN,
			ExpectedMessage:  "user uploaded one or more files in channel",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"only files, private channel": {
			HasFiles:         true,
			ChannelType:      model.CHANNEL_PRIVATE,
			ExpectedMessage:  "user uploaded one or more files in channel",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"only files, group message channel": {
			HasFiles:         true,
			ChannelType:      model.CHANNEL_GROUP,
			ExpectedMessage:  "user uploaded one or more files in channel",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"only files, direct message channel": {
			HasFiles:         true,
			ChannelType:      model.CHANNEL_DIRECT,
			ExpectedMessage:  "user uploaded one or more files in a direct message",
			ExpectedCategory: model.CATEGORY_CAN_REPLY,
		},
		"only files without channel, public channel": {
			HasFiles:                 true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user uploaded one or more files",
		},
	} {
		t.Run(name, func(t *testing.T) {
			locale := tc.Locale
			if locale == "" {
				locale = "en"
			}

			pushNotificationContents := tc.PushNotificationContents
			if pushNotificationContents == "" {
				pushNotificationContents = model.FULL_NOTIFICATION
			}

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.EmailSettings.PushNotificationContents = pushNotificationContents
			})

			if actualMessage, actualCategory := th.App.getPushNotificationMessage(
				tc.Message,
				tc.WasMentioned,
				tc.HasFiles,
				"user",
				"channel",
				tc.ChannelType,
				utils.GetUserTranslations(locale),
			); actualMessage != tc.ExpectedMessage {
				t.Fatalf("Received incorrect push notification message `%v`, expected `%v`", actualMessage, tc.ExpectedMessage)
			} else if actualCategory != tc.ExpectedCategory {
				t.Fatalf("Received incorrect push notification category `%v`, expected `%v`", actualCategory, tc.ExpectedCategory)
			}
		})
	}
}
