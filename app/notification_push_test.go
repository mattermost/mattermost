// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)

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
			ExpectedMessage: "user: this is a message",
		},
		"full message, public channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_OPEN,
			ExpectedMessage: "user: this is a message",
		},
		"full message, public channel, channel wide mention": {
			Message:            "this is a message",
			channelWideMention: true,
			ChannelType:        model.CHANNEL_OPEN,
			ExpectedMessage:    "user: this is a message",
		},
		"full message, public channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ROOT,
			ChannelType:       model.CHANNEL_OPEN,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, public channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ANY,
			ChannelType:       model.CHANNEL_OPEN,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, private channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "user: this is a message",
		},
		"full message, private channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "user: this is a message",
		},
		"full message, private channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ROOT,
			ChannelType:       model.CHANNEL_PRIVATE,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, private channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ANY,
			ChannelType:       model.CHANNEL_PRIVATE,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, group message channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "user: this is a message",
		},
		"full message, group message channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "user: this is a message",
		},
		"full message, group message channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ROOT,
			ChannelType:       model.CHANNEL_GROUP,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, group message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ANY,
			ChannelType:       model.CHANNEL_GROUP,
			ExpectedMessage:   "user: this is a message",
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
			replyToThreadType: model.COMMENTS_NOTIFY_ROOT,
			ChannelType:       model.CHANNEL_DIRECT,
			ExpectedMessage:   "this is a message",
		},
		"full message, direct message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.COMMENTS_NOTIFY_ANY,
			ChannelType:       model.CHANNEL_DIRECT,
			ExpectedMessage:   "this is a message",
		},
		"generic message with channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, public channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, public channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, public channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user commented on a thread you participated in.",
		},
		"generic message with channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, private channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, public private, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, public private, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user commented on a thread you participated in.",
		},
		"generic message with channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, group message channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, group message channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, group message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user commented on a thread you participated in.",
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
			replyToThreadType:        model.COMMENTS_NOTIFY_ROOT,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message, direct message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.COMMENTS_NOTIFY_ANY,
			PushNotificationContents: model.GENERIC_NOTIFICATION,
			ChannelType:              model.CHANNEL_DIRECT,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message without channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_OPEN,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message without channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_PRIVATE,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message without channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GENERIC_NO_CHANNEL_NOTIFICATION,
			ChannelType:              model.CHANNEL_GROUP,
			ExpectedMessage:          "user mentioned you.",
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
			ExpectedMessage: "user attached a file.",
		},
		"only files, private channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_PRIVATE,
			ExpectedMessage: "user attached a file.",
		},
		"only files, group message channel": {
			HasFiles:        true,
			ChannelType:     model.CHANNEL_GROUP,
			ExpectedMessage: "user attached a file.",
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
			ExpectedMessage:          "user attached a file.",
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

			actualMessage := th.App.getPushNotificationMessage(
				pushNotificationContents,
				tc.Message,
				tc.explicitMention,
				tc.channelWideMention,
				tc.HasFiles,
				"user",
				"channel",
				tc.ChannelType,
				tc.replyToThreadType,
				utils.GetUserTranslations(locale),
			)

			assert.Equal(t, tc.ExpectedMessage, actualMessage)
		})
	}
}

func TestBuildPushNotificationMessageMentions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()
	sender := th.CreateUser()
	receiver := th.CreateUser()
	th.LinkUserToTeam(sender, team)
	th.LinkUserToTeam(receiver, team)
	channel1 := th.CreateChannel(team)
	th.AddUserToChannel(sender, channel1)
	th.AddUserToChannel(receiver, channel1)

	channel2 := th.CreateChannel(team)
	th.AddUserToChannel(sender, channel2)
	th.AddUserToChannel(receiver, channel2)

	// Create three mention posts and two non-mention posts
	th.CreateMessagePost(channel1, "@channel Hello")
	th.CreateMessagePost(channel1, "@all Hello")
	th.CreateMessagePost(channel1, fmt.Sprintf("@%s Hello in channel 1", receiver.Username))
	th.CreateMessagePost(channel2, fmt.Sprintf("@%s Hello in channel 2", receiver.Username))
	th.CreatePost(channel1)
	post := th.CreatePost(channel1)

	for name, tc := range map[string]struct {
		explicitMention    bool
		channelWideMention bool
		replyToThreadType  string
		pushNotifyProps    string
		expectedBadge      int
	}{
		"only mentions included for notify_props=mention": {
			explicitMention:    false,
			channelWideMention: true,
			replyToThreadType:  "",
			pushNotifyProps:    "mention",
			expectedBadge:      4,
		},
		"only mentions included for notify_props=all": {
			explicitMention:    false,
			channelWideMention: true,
			replyToThreadType:  "",
			pushNotifyProps:    "all",
			expectedBadge:      4,
		},
	} {
		t.Run(name, func(t *testing.T) {
			receiver.NotifyProps["push"] = tc.pushNotifyProps
			msg, err := th.App.BuildPushNotificationMessage(model.FULL_NOTIFICATION, post, receiver, channel1, channel1.Name, sender.Username, tc.explicitMention, tc.channelWideMention, tc.replyToThreadType)
			require.Nil(t, err)
			assert.Equal(t, tc.expectedBadge, msg.Badge)
		})
	}
}

func TestSendPushNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	_, err := th.App.CreateSession(&model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "test",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, err)

	t.Run("should return error if data is not valid or nil", func(t *testing.T) {
		err := th.App.sendPushNotificationToAllSessions(nil, th.BasicUser.Id, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.push_notifications.message.parse.app_error", err.Id)
		// Errors derived of using an empty object are handled internally through the notifications log
		err = th.App.sendPushNotificationToAllSessions(&model.PushNotification{}, th.BasicUser.Id, "")
		require.Nil(t, err)
	})
}

// testPushNotificationHandler is an HTTP handler to record push notifications
// being sent from the client.
// It records the number of requests sent to it, and stores all the requests
// to be verified later.
type testPushNotificationHandler struct {
	t                 testing.TB
	serialUserMap     sync.Map
	mut               sync.RWMutex
	behavior          string
	_numReqs          int
	_notifications    []*model.PushNotification
	_notificationAcks []*model.PushNotificationAck
}

// handleReq parses a push notification from the body, and stores it.
// It also sends an appropriate response depending on the behavior set.
// If the behavior is simple, it always sends an OK response. Otherwise,
// it alternates between an OK and a REMOVE response.
func (h *testPushNotificationHandler) handleReq(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/v1/send_push", "/api/v1/ack":
		h.t.Helper()

		// Don't do any checking if it's a benchmark
		if _, ok := h.t.(*testing.B); ok {
			resp := model.NewOkPushResponse()
			fmt.Fprintln(w, (&resp).ToJson())
			return
		}

		var notification *model.PushNotification
		var notificationAck *model.PushNotificationAck
		var err error
		if r.URL.Path == "/api/v1/send_push" {
			notification, err = model.PushNotificationFromJson(r.Body)
			if err != nil {
				resp := model.NewErrorPushResponse("fail")
				fmt.Fprintln(w, (&resp).ToJson())
				return
			}
			// We verify that messages are being sent in order per-device.
			if notification.DeviceId != "" {
				if _, ok := h.serialUserMap.Load(notification.DeviceId); ok {
					h.t.Fatalf("device id: %s being sent concurrently", notification.DeviceId)
				}
				h.serialUserMap.LoadOrStore(notification.DeviceId, true)
				defer h.serialUserMap.Delete(notification.DeviceId)
			}
		} else {
			notificationAck, err = model.PushNotificationAckFromJson(r.Body)
			if err != nil {
				resp := model.NewErrorPushResponse("fail")
				fmt.Fprintln(w, (&resp).ToJson())
				return
			}
		}
		// Updating internal state.
		h.mut.Lock()
		defer h.mut.Unlock()
		h._numReqs++
		// Little bit of duplicate condition check so that we can check the in-order property
		// first.
		if r.URL.Path == "/api/v1/send_push" {
			h._notifications = append(h._notifications, notification)
		} else {
			h._notificationAcks = append(h._notificationAcks, notificationAck)
		}

		var resp model.PushResponse
		if h.behavior == "simple" {
			resp = model.NewOkPushResponse()
		} else {
			// alternating between ok and remove response to test both code paths.
			if h._numReqs%2 == 0 {
				resp = model.NewOkPushResponse()
			} else {
				resp = model.NewRemovePushResponse()
			}
		}
		fmt.Fprintln(w, (&resp).ToJson())
	}
}

func (h *testPushNotificationHandler) numReqs() int {
	h.mut.RLock()
	defer h.mut.RUnlock()
	return h._numReqs
}

func (h *testPushNotificationHandler) notifications() []*model.PushNotification {
	h.mut.RLock()
	defer h.mut.RUnlock()
	return h._notifications
}

func (h *testPushNotificationHandler) notificationAcks() []*model.PushNotificationAck {
	h.mut.RLock()
	defer h.mut.RUnlock()
	return h._notificationAcks
}

func TestClearPushNotificationSync(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	handler := &testPushNotificationHandler{t: t}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	sess1 := &model.Session{
		Id:        "id1",
		UserId:    "user1",
		DeviceId:  "test1",
		ExpiresAt: model.GetMillis() + 100000,
	}
	sess2 := &model.Session{
		Id:        "id2",
		UserId:    "user1",
		DeviceId:  "test2",
		ExpiresAt: model.GetMillis() + 100000,
	}

	mockStore := th.App.Srv().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string")).Return(int64(1), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockSessionStore := mocks.SessionStore{}
	mockSessionStore.On("GetSessionsWithActiveDeviceIds", mock.AnythingOfType("string")).Return([]*model.Session{sess1, sess2}, nil)
	mockSessionStore.On("UpdateDeviceId", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("int64")).Return("testdeviceID", nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Session").Return(&mockSessionStore)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	err := th.App.clearPushNotificationSync(sess1.Id, "user1", "channel1")
	require.Nil(t, err)
	// Server side verification.
	// We verify that 1 request has been sent, and also check the message contents.
	require.Equal(t, 1, handler.numReqs())
	assert.Equal(t, "channel1", handler.notifications()[0].ChannelId)
	assert.Equal(t, model.PUSH_TYPE_CLEAR, handler.notifications()[0].Type)
}

func TestUpdateMobileAppBadgeSync(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	handler := &testPushNotificationHandler{t: t}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	sess1 := &model.Session{
		Id:        "id1",
		UserId:    "user1",
		DeviceId:  "test1",
		ExpiresAt: model.GetMillis() + 100000,
	}
	sess2 := &model.Session{
		Id:        "id2",
		UserId:    "user1",
		DeviceId:  "test2",
		ExpiresAt: model.GetMillis() + 100000,
	}

	mockStore := th.App.Srv().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string")).Return(int64(1), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockSessionStore := mocks.SessionStore{}
	mockSessionStore.On("GetSessionsWithActiveDeviceIds", mock.AnythingOfType("string")).Return([]*model.Session{sess1, sess2}, nil)
	mockSessionStore.On("UpdateDeviceId", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("int64")).Return("testdeviceID", nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Session").Return(&mockSessionStore)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	err := th.App.updateMobileAppBadgeSync("user1")
	require.Nil(t, err)
	// Server side verification.
	// We verify that 2 requests have been sent, and also check the message contents.
	require.Equal(t, 2, handler.numReqs())
	assert.Equal(t, 1, handler.notifications()[0].ContentAvailable)
	assert.Equal(t, model.PUSH_TYPE_UPDATE_BADGE, handler.notifications()[0].Type)
	assert.Equal(t, 1, handler.notifications()[1].ContentAvailable)
	assert.Equal(t, model.PUSH_TYPE_UPDATE_BADGE, handler.notifications()[1].Type)
}

func TestSendAckToPushProxy(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	handler := &testPushNotificationHandler{t: t}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	mockStore := th.App.Srv().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	ack := &model.PushNotificationAck{
		Id:               "testid",
		NotificationType: model.PUSH_TYPE_MESSAGE,
	}
	err := th.App.SendAckToPushProxy(ack)
	require.Nil(t, err)
	// Server side verification.
	// We verify that 1 request has been sent, and also check the message contents.
	require.Equal(t, 1, handler.numReqs())
	assert.Equal(t, ack.Id, handler.notificationAcks()[0].Id)
	assert.Equal(t, ack.NotificationType, handler.notificationAcks()[0].NotificationType)
}

// TestAllPushNotifications is a master test which sends all verious types
// of notifications and verifies they have been properly sent.
func TestAllPushNotifications(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping all push notifications test in short mode")
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create 10 users, each having 2 sessions.
	type userSession struct {
		user    *model.User
		session *model.Session
	}
	var testData []userSession
	for i := 0; i < 10; i++ {
		u := th.CreateUser()
		sess, err := th.App.CreateSession(&model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		// We don't need to track the 2nd session.
		_, err = th.App.CreateSession(&model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		_, err = th.App.AddTeamMember(th.BasicTeam.Id, u.Id)
		require.Nil(t, err)
		th.AddUserToChannel(u, th.BasicChannel)
		testData = append(testData, userSession{
			user:    u,
			session: sess,
		})
	}

	handler := &testPushNotificationHandler{
		t:        t,
		behavior: "simple",
	}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationContents = model.GENERIC_NOTIFICATION
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	var wg sync.WaitGroup
	for i, data := range testData {
		wg.Add(1)
		// Ranging between 3 types of notifications.
		switch i % 3 {
		case 0:
			go func(user model.User) {
				defer wg.Done()
				notification := &PostNotification{
					Post:    th.CreatePost(th.BasicChannel),
					Channel: th.BasicChannel,
					ProfileMap: map[string]*model.User{
						user.Id: &user,
					},
					Sender: &user,
				}
				// testing all 3 notification types.
				th.App.sendPushNotification(notification, &user, true, false, model.COMMENTS_NOTIFY_ANY)
			}(*data.user)
		case 1:
			go func(id string) {
				defer wg.Done()
				th.App.UpdateMobileAppBadge(id)
			}(data.user.Id)
		case 2:
			go func(sessID, userID string) {
				defer wg.Done()
				th.App.clearPushNotification(sessID, userID, th.BasicChannel.Id)
			}(data.session.Id, data.user.Id)
		}
	}
	wg.Wait()

	// Hack to let the worker goroutines complete.
	time.Sleep(1 * time.Second)
	// Server side verification.
	assert.Equal(t, 17, handler.numReqs())
	var numClears, numMessages, numUpdateBadges int
	for _, n := range handler.notifications() {
		switch n.Type {
		case model.PUSH_TYPE_CLEAR:
			numClears++
			assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
		case model.PUSH_TYPE_MESSAGE:
			numMessages++
			assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
			assert.Contains(t, n.Message, "mentioned you")
		case model.PUSH_TYPE_UPDATE_BADGE:
			numUpdateBadges++
			assert.Equal(t, "none", n.Sound)
			assert.Equal(t, 1, n.ContentAvailable)
		}
	}
	assert.Equal(t, 8, numMessages)
	assert.Equal(t, 3, numClears)
	assert.Equal(t, 6, numUpdateBadges)
}

func TestPushNotificationRace(t *testing.T) {
	memoryStore := config.NewTestMemoryStore()
	mockStore := testlib.GetMockStoreForSetupFunctions()
	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string")).
		Return(&model.Preference{Value: "test"}, nil)
	mockStore.On("Preference").Return(&mockPreferenceStore)
	s := &Server{
		configStore: memoryStore,
		Store:       mockStore,
	}
	app := New(ServerConnector(s))
	require.NotPanics(t, func() {
		s.createPushNotificationsHub()

		s.StopPushNotificationsHubWorkers()

		// Now we start sending messages after the PN hub is shut down.
		// We test all 3 notification types.
		app.clearPushNotification("currentSessionId", "userId", "channelId")

		app.UpdateMobileAppBadge("userId")

		notification := &PostNotification{
			Post:    &model.Post{},
			Channel: &model.Channel{},
			ProfileMap: map[string]*model.User{
				"userId": {},
			},
			Sender: &model.User{},
		}
		app.sendPushNotification(notification, &model.User{}, true, false, model.COMMENTS_NOTIFY_ANY)
	})
}

func TestPushNotificationAttachment(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	post := &model.Post{
		Message: "hello world",
		Props: map[string]interface{}{
			"attachments": []*model.SlackAttachment{
				{
					AuthorName: "testuser",
					Text:       "test attachment",
					Fallback:   "fallback text",
				},
			},
		},
	}
	user := &model.User{}
	ch := &model.Channel{}

	pn := th.App.buildFullPushNotificationMessage("full", post, user, ch, ch.Name, "test", false, false, "")
	assert.Equal(t, "test: hello world\nfallback text", pn.Message)
}

// Run it with | grep -v '{"level"' to prevent spamming the console.
func BenchmarkPushNotificationThroughput(b *testing.B) {
	th := SetupWithStoreMock(b)
	defer th.TearDown()

	handler := &testPushNotificationHandler{
		t:        b,
		behavior: "simple",
	}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	mockStore := th.App.Srv().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string")).Return(int64(1), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockSessionStore := mocks.SessionStore{}
	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&model.Preference{Value: "test"}, nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Session").Return(&mockSessionStore)
	mockStore.On("Preference").Return(&mockPreferenceStore)

	// create 50 users, each having 2 sessions.
	type userSession struct {
		user    *model.User
		session *model.Session
	}
	var testData []userSession
	for i := 0; i < 50; i++ {
		id := model.NewId()
		u := &model.User{
			Id:            id,
			Email:         "success+" + id + "@simulator.amazonses.com",
			Username:      "un_" + id,
			Nickname:      "nn_" + id,
			Password:      "Password1",
			EmailVerified: true,
		}
		sess1 := &model.Session{
			Id:        "id1",
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		}
		sess2 := &model.Session{
			Id:        "id2",
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		}
		mockSessionStore.On("GetSessionsWithActiveDeviceIds", u.Id).Return([]*model.Session{sess1, sess2}, nil)
		mockSessionStore.On("UpdateDeviceId", sess1.Id, "deviceID"+u.Id, mock.AnythingOfType("int64")).Return("deviceID"+u.Id, nil)

		testData = append(testData, userSession{
			user:    u,
			session: sess1,
		})
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.LogSettings.EnableConsole = false
		*cfg.NotificationLogSettings.EnableConsole = false
	})

	ch := &model.Channel{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Type:     model.CHANNEL_OPEN,
		Name:     "testch",
	}

	b.ResetTimer()
	// We have an inner loop which ranges the testdata slice
	// and we just repeat that.
	then := time.Now()
	cnt := 0
	for i := 0; i < b.N; i++ {
		cnt++
		var wg sync.WaitGroup
		for j, data := range testData {
			wg.Add(1)
			// Ranging between 3 types of notifications.
			switch j % 3 {
			case 0:
				go func(user model.User) {
					defer wg.Done()
					post := &model.Post{
						UserId:    user.Id,
						ChannelId: ch.Id,
						Message:   "test message",
						CreateAt:  model.GetMillis(),
					}
					notification := &PostNotification{
						Post:    post,
						Channel: ch,
						ProfileMap: map[string]*model.User{
							user.Id: &user,
						},
						Sender: &user,
					}
					th.App.sendPushNotification(notification, &user, true, false, model.COMMENTS_NOTIFY_ANY)
				}(*data.user)
			case 1:
				go func(id string) {
					defer wg.Done()
					th.App.UpdateMobileAppBadge(id)
				}(data.user.Id)
			case 2:
				go func(sessID, userID string) {
					defer wg.Done()
					th.App.clearPushNotification(sessID, userID, ch.Id)
				}(data.session.Id, data.user.Id)
			}
		}
		wg.Wait()
	}
	b.Logf("throughput: %f reqs/s", float64(len(testData)*cnt)/time.Since(then).Seconds())
	b.StopTimer()
	time.Sleep(2 * time.Second)
}
