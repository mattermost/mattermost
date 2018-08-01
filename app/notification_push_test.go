// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
)

func TestDoesNotifyPropsAllowPushNotification(t *testing.T) {
	tt := []struct {
		name                 string
		userNotifySetting    string
		channelNotifySetting string
		withSystemPost       bool
		wasMentioned         bool
		isMuted              bool
		expected             bool
	}{
		{
			name:                 "When post is a System Message and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: "",
			withSystemPost:       true,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When post is a System Message and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: "",
			withSystemPost:       true,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, no channel props is set and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is ALL, no channel props is set and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is MENTION, no channel props is set and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is MENTION, no channel props is set and has mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is NONE, no channel props is set and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is NONE, no channel props is set and has mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is ALL, channel is DEFAULT and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is MENTION, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is MENTION, channel is DEFAULT and has mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is NONE, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is NONE, channel is DEFAULT and has mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_DEFAULT,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, channel is ALL and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is ALL, channel is ALL and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is MENTION, channel is ALL and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is MENTION, channel is ALL and has mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is NONE, channel is ALL and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is NONE, channel is ALL and has mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_ALL,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is ALL, channel is MENTION and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, channel is MENTION and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is MENTION, channel is MENTION and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is MENTION, channel is MENTION and has mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is NONE, channel is MENTION and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is NONE, channel is MENTION and has mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_MENTION,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             true,
		},
		{
			name:                 "When default is ALL, channel is NONE and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, channel is NONE and has mentions",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is MENTION, channel is NONE and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is MENTION, channel is NONE and has mentions",
			userNotifySetting:    model.USER_NOTIFY_MENTION,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is NONE, channel is NONE and has no mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is NONE, channel is NONE and has mentions",
			userNotifySetting:    model.USER_NOTIFY_NONE,
			channelNotifySetting: model.CHANNEL_NOTIFY_NONE,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             false,
		},
		{
			name:                 "When default is ALL, and channel is MUTED",
			userNotifySetting:    model.USER_NOTIFY_ALL,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              true,
			expected:             false,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			user := &model.User{Id: model.NewId(), Email: "unit@test.com", NotifyProps: make(map[string]string)}
			user.NotifyProps[model.PUSH_NOTIFY_PROP] = tc.userNotifySetting
			post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}
			if tc.withSystemPost {
				post.Type = model.POST_JOIN_CHANNEL
			}

			channelNotifyProps := make(map[string]string)
			if tc.channelNotifySetting != "" {
				channelNotifyProps[model.PUSH_NOTIFY_PROP] = tc.channelNotifySetting
			}
			if tc.isMuted {
				channelNotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_MENTION
			}
			assert.Equal(t, tc.expected, DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, tc.wasMentioned))
		})
	}
}

func TestDoesStatusAllowPushNotification(t *testing.T) {
	userId := model.NewId()
	channelId := model.NewId()

	offline := &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	away := &model.Status{UserId: userId, Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	online := &model.Status{UserId: userId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	dnd := &model.Status{UserId: userId, Status: model.STATUS_DND, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	tt := []struct {
		name              string
		userNotifySetting string
		status            *model.Status
		channelId         string
		expected          bool
	}{
		{
			name:              "WHEN props is ONLINE and user is offline with channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            offline,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is ONLINE and user is offline without channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            offline,
			channelId:         "",
			expected:          true,
		},
		{
			name:              "WHEN props is ONLINE and user is away with channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            away,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is ONLINE and user is away without channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            away,
			channelId:         "",
			expected:          true,
		},
		{
			name:              "WHEN props is ONLINE and user is online with channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            online,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is ONLINE and user is online without channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            online,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is ONLINE and user is dnd with channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            dnd,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is ONLINE and user is dnd without channel",
			userNotifySetting: model.STATUS_ONLINE,
			status:            dnd,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is AWAY and user is offline with channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            offline,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is AWAY and user is offline without channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            offline,
			channelId:         "",
			expected:          true,
		},
		{
			name:              "WHEN props is AWAY and user is away with channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            away,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is AWAY and user is away without channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            away,
			channelId:         "",
			expected:          true,
		},
		{
			name:              "WHEN props is AWAY and user is online with channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            online,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is AWAY and user is online without channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            online,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is AWAY and user is dnd with channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            dnd,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is AWAY and user is dnd without channel",
			userNotifySetting: model.STATUS_AWAY,
			status:            dnd,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is offline with channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            offline,
			channelId:         channelId,
			expected:          true,
		},
		{
			name:              "WHEN props is OFFLINE and user is offline without channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            offline,
			channelId:         "",
			expected:          true,
		},
		{
			name:              "WHEN props is OFFLINE and user is away with channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            away,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is away without channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            away,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is online with channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            online,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is online without channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            online,
			channelId:         "",
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is dnd with channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            dnd,
			channelId:         channelId,
			expected:          false,
		},
		{
			name:              "WHEN props is OFFLINE and user is dnd without channel",
			userNotifySetting: model.STATUS_OFFLINE,
			status:            dnd,
			channelId:         "",
			expected:          false,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			userNotifyProps := make(map[string]string)
			userNotifyProps["push_status"] = tc.userNotifySetting
			assert.Equal(t, tc.expected, DoesStatusAllowPushNotification(userNotifyProps, tc.status, tc.channelId))
		})
	}
}

func TestGetPushNotificationMessage(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	for name, tc := range map[string]struct {
		Message                  string
		explicitMention          bool
		channelWideMention       bool
		HasFiles                 bool
		replyToThreadType        string
		Locale                   string
		PushNotificationContents string
		ChannelType              string

		ExpectedMessage string
	}{
		"full message, public channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_OPEN,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, public channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_OPEN,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, public channel, channel wide mention": {
			Message:            "this is a message",
			channelWideMention: true,
			ChannelType:        model.CHANNEL_OPEN,
			ExpectedMessage:    "@user: this is a message",
		},
		"full message, public channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ROOT,
			ChannelType:       model.CHANNEL_OPEN,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, public channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ANY,
			ChannelType:       model.CHANNEL_OPEN,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, private channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, private channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, private channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ROOT,
			ChannelType:       model.CHANNEL_PRIVATE,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, private channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ANY,
			ChannelType:       model.CHANNEL_PRIVATE,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, group message channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, group message channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "@user: this is a message",
		},
		"full message, group message channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ROOT,
			ChannelType:       model.CHANNEL_GROUP,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, group message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ANY,
			ChannelType:       model.CHANNEL_GROUP,
			ExpectedMessage:   "@user: this is a message",
		},
		"full message, direct message channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_DIRECT,
			ExpectedMessage: "this is a message",
		},
		"full message, direct message channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_DIRECT,
			ExpectedMessage: "this is a message",
		},
		"full message, direct message channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ROOT,
			ChannelType:       model.CHANNEL_DIRECT,
			ExpectedMessage:   "this is a message",
		},
		"full message, direct message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: THREAD_ANY,
			ChannelType:       model.CHANNEL_DIRECT,
			ExpectedMessage:   "this is a message",
		},
		"generic message with channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message with channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message with channel, public channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user notified the channel.",
		},
		"generic message, public channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user commented on your post.",
		},
		"generic message, public channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user commented on a thread you participated in.",
		},
		"generic message with channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message with channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message with channel, private channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user notified the channel.",
		},
		"generic message, public private, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user commented on your post.",
		},
		"generic message, public private, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user commented on a thread you participated in.",
		},
		"generic message with channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message with channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message with channel, group message channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user notified the channel.",
		},
		"generic message, group message channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user commented on your post.",
		},
		"generic message, group message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user commented on a thread you participated in.",
		},
		"generic message with channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message with channel, direct message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message with channel, direct message channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message, direct message channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message, direct message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        THREAD_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message without channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message without channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message without channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message without channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message without channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user posted a message.",
		},
		"generic message without channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "@user mentioned you.",
		},
		"generic message without channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message without channel, direct message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"only files, public channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_OPEN,
			ExpectedMessage: "@user attached a file.",
		},
		"only files, private channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "@user attached a file.",
		},
		"only files, group message channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "@user attached a file.",
		},
		"only files, direct message channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_DIRECT,
			ExpectedMessage: "attached a file.",
		},
		"only files without channel, public channel": {
			HasFiles:                 true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "@user attached a file.",
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

			if actualMessage := th.App.getPushNotificationMessage(
				tc.Message,
				tc.explicitMention,
				tc.channelWideMention,
				tc.HasFiles,
				"user",
				"channel",
				tc.ChannelType,
				tc.replyToThreadType,
				utils.GetUserTranslations(locale),
			); actualMessage != tc.ExpectedMessage {
				t.Fatalf("Received incorrect push notification message `%v`, expected `%v`", actualMessage, tc.ExpectedMessage)
			}
		})
	}
}
