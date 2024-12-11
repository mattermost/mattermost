// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	fmocks "github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

func TestDoesNotifyPropsAllowPushNotification(t *testing.T) {
	tt := []struct {
		name                 string
		userNotifySetting    string
		channelNotifySetting string
		withSystemPost       bool
		wasMentioned         bool
		isMuted              bool
		expected             model.NotificationReason
		isGM                 bool
	}{
		{
			name:                 "When post is a System Message and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: "",
			withSystemPost:       true,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonSystemMessage,
			isGM:                 false,
		},
		{
			name:                 "When post is a System Message and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: "",
			withSystemPost:       true,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonSystemMessage,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, no channel props is set and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, no channel props is set and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, no channel props is set and has no mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, no channel props is set and has mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, no channel props is set and has no mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, no channel props is set and has mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is DEFAULT and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is DEFAULT and has mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is DEFAULT and has no mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is DEFAULT and has mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is ALL and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is ALL and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is ALL and has no mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is ALL and has mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is ALL and has no mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is ALL and has mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyAll,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is MENTION and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is MENTION and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is MENTION and has no mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is MENTION and has mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is MENTION and has no mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is MENTION and has mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is NONE and has no mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, channel is NONE and has mentions",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is NONE and has no mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is MENTION, channel is NONE and has mentions",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is NONE and has no mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is NONE, channel is NONE and has mentions",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyNone,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 false,
		},
		{
			name:                 "When default is ALL, and channel is MUTED",
			userNotifySetting:    model.UserNotifyAll,
			channelNotifySetting: "",
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              true,
			expected:             model.NotificationReasonChannelMuted,
			isGM:                 false,
		},
		{
			name:                 "For GM default for NONE is NONE",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonLevelSetToNone,
			isGM:                 true,
		},
		{
			name:                 "For GM, mentioned is only called if explicitly mentioned",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         true,
			isMuted:              false,
			expected:             "",
			isGM:                 true,
		},
		{
			name:                 "For GM default for MENTION is ALL",
			userNotifySetting:    model.UserNotifyMention,
			channelNotifySetting: model.ChannelNotifyDefault,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             "",
			isGM:                 true,
		},
		{
			name:                 "For GM, mentioned is only called if explicitly mentioned",
			userNotifySetting:    model.UserNotifyNone,
			channelNotifySetting: model.ChannelNotifyMention,
			withSystemPost:       false,
			wasMentioned:         false,
			isMuted:              false,
			expected:             model.NotificationReasonNotMentioned,
			isGM:                 true,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			user := &model.User{Id: model.NewId(), Email: "unit@test.com", NotifyProps: make(map[string]string)}
			user.NotifyProps[model.PushNotifyProp] = tc.userNotifySetting
			post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}
			if tc.withSystemPost {
				post.Type = model.PostTypeJoinChannel
			}

			channelNotifyProps := make(map[string]string)
			if tc.channelNotifySetting != "" {
				channelNotifyProps[model.PushNotifyProp] = tc.channelNotifySetting
			}
			if tc.isMuted {
				channelNotifyProps[model.MarkUnreadNotifyProp] = model.ChannelMarkUnreadMention
			}
			assert.Equal(t, tc.expected, doesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, tc.wasMentioned, tc.isGM))
		})
	}
}

func TestDoesStatusAllowPushNotification(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	userID := model.NewId()
	channelID := model.NewId()

	offline := &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	away := &model.Status{UserId: userID, Status: model.StatusAway, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	online := &model.Status{UserId: userID, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	dnd := &model.Status{UserId: userID, Status: model.StatusDnd, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	activeOnChannel := &model.Status{UserId: userID, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: channelID}

	tt := []struct {
		name              string
		userNotifySetting string
		status            *model.Status
		channelID         string
		isCRT             bool
		expected          model.NotificationReason
	}{
		{
			name:              "WHEN props is ONLINE and user is offline with channel",
			userNotifySetting: model.StatusOnline,
			status:            offline,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is ONLINE and user is offline without channel",
			userNotifySetting: model.StatusOnline,
			status:            offline,
			channelID:         "",
			expected:          "",
		},
		{
			name:              "WHEN props is ONLINE and user is away with channel",
			userNotifySetting: model.StatusOnline,
			status:            away,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is ONLINE and user is away without channel",
			userNotifySetting: model.StatusOnline,
			status:            away,
			channelID:         "",
			expected:          "",
		},
		{
			name:              "WHEN props is ONLINE and user is online with channel",
			userNotifySetting: model.StatusOnline,
			status:            online,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is ONLINE and user is online without channel",
			userNotifySetting: model.StatusOnline,
			status:            online,
			channelID:         "",
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is ONLINE and user is online and active within the channel",
			userNotifySetting: model.StatusOnline,
			status:            activeOnChannel,
			channelID:         channelID,
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is ONLINE and user is online and active within a thread in the channel",
			userNotifySetting: model.StatusOnline,
			status:            activeOnChannel,
			channelID:         channelID,
			expected:          "",
			isCRT:             true,
		},
		{
			name:              "WHEN props is ONLINE and user is dnd with channel",
			userNotifySetting: model.StatusOnline,
			status:            dnd,
			channelID:         channelID,
			expected:          model.NotificationReasonUserStatus,
		},
		{
			name:              "WHEN props is ONLINE and user is dnd without channel",
			userNotifySetting: model.StatusOnline,
			status:            dnd,
			channelID:         "",
			expected:          model.NotificationReasonUserStatus,
		},
		{
			name:              "WHEN props is AWAY and user is offline with channel",
			userNotifySetting: model.StatusAway,
			status:            offline,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is AWAY and user is offline without channel",
			userNotifySetting: model.StatusAway,
			status:            offline,
			channelID:         "",
			expected:          "",
		},
		{
			name:              "WHEN props is AWAY and user is away with channel",
			userNotifySetting: model.StatusAway,
			status:            away,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is AWAY and user is away without channel",
			userNotifySetting: model.StatusAway,
			status:            away,
			channelID:         "",
			expected:          "",
		},
		{
			name:              "WHEN props is AWAY and user is online with channel",
			userNotifySetting: model.StatusAway,
			status:            online,
			channelID:         channelID,
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is AWAY and user is online without channel",
			userNotifySetting: model.StatusAway,
			status:            online,
			channelID:         "",
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is AWAY and user is dnd with channel",
			userNotifySetting: model.StatusAway,
			status:            dnd,
			channelID:         channelID,
			expected:          model.NotificationReasonUserStatus,
		},
		{
			name:              "WHEN props is AWAY and user is dnd without channel",
			userNotifySetting: model.StatusAway,
			status:            dnd,
			channelID:         "",
			expected:          model.NotificationReasonUserStatus,
		},
		{
			name:              "WHEN props is OFFLINE and user is offline with channel",
			userNotifySetting: model.StatusOffline,
			status:            offline,
			channelID:         channelID,
			expected:          "",
		},
		{
			name:              "WHEN props is OFFLINE and user is offline without channel",
			userNotifySetting: model.StatusOffline,
			status:            offline,
			channelID:         "",
			expected:          "",
		},
		{
			name:              "WHEN props is OFFLINE and user is away with channel",
			userNotifySetting: model.StatusOffline,
			status:            away,
			channelID:         channelID,
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is OFFLINE and user is away without channel",
			userNotifySetting: model.StatusOffline,
			status:            away,
			channelID:         "",
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is OFFLINE and user is online with channel",
			userNotifySetting: model.StatusOffline,
			status:            online,
			channelID:         channelID,
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is OFFLINE and user is online without channel",
			userNotifySetting: model.StatusOffline,
			status:            online,
			channelID:         "",
			expected:          model.NotificationReasonUserIsActive,
		},
		{
			name:              "WHEN props is OFFLINE and user is dnd with channel",
			userNotifySetting: model.StatusOffline,
			status:            dnd,
			channelID:         channelID,
			expected:          model.NotificationReasonUserStatus,
		},
		{
			name:              "WHEN props is OFFLINE and user is dnd without channel",
			userNotifySetting: model.StatusOffline,
			status:            dnd,
			channelID:         "",
			expected:          model.NotificationReasonUserStatus,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			userNotifyProps := make(map[string]string)
			userNotifyProps["push_status"] = tc.userNotifySetting
			assert.Equal(t, tc.expected, doesStatusAllowPushNotification(userNotifyProps, tc.status, tc.channelID, tc.isCRT))
		})
	}
}

func TestGetPushNotificationMessage(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
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
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	for name, tc := range map[string]struct {
		Message                  string
		explicitMention          bool
		channelWideMention       bool
		HasFiles                 bool
		replyToThreadType        string
		Locale                   string
		PushNotificationContents string
		ChannelType              model.ChannelType

		ExpectedMessage string
	}{
		"full message, public channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.ChannelTypeOpen,
			ExpectedMessage: "user: this is a message",
		},
		"full message, public channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.ChannelTypeOpen,
			ExpectedMessage: "user: this is a message",
		},
		"full message, public channel, channel wide mention": {
			Message:            "this is a message",
			channelWideMention: true,
			ChannelType:        model.ChannelTypeOpen,
			ExpectedMessage:    "user: this is a message",
		},
		"full message, public channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyRoot,
			ChannelType:       model.ChannelTypeOpen,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, public channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyAny,
			ChannelType:       model.ChannelTypeOpen,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, private channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.ChannelTypePrivate,
			ExpectedMessage: "user: this is a message",
		},
		"full message, private channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.ChannelTypePrivate,
			ExpectedMessage: "user: this is a message",
		},
		"full message, private channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyRoot,
			ChannelType:       model.ChannelTypePrivate,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, private channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyAny,
			ChannelType:       model.ChannelTypePrivate,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, group message channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.ChannelTypeGroup,
			ExpectedMessage: "user: this is a message",
		},
		"full message, group message channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.ChannelTypeGroup,
			ExpectedMessage: "user: this is a message",
		},
		"full message, group message channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyRoot,
			ChannelType:       model.ChannelTypeGroup,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, group message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyAny,
			ChannelType:       model.ChannelTypeGroup,
			ExpectedMessage:   "user: this is a message",
		},
		"full message, direct message channel, no mention": {
			Message:         "this is a message",
			ChannelType:     model.ChannelTypeDirect,
			ExpectedMessage: "this is a message",
		},
		"full message, direct message channel, mention": {
			Message:         "this is a message",
			explicitMention: true,
			ChannelType:     model.ChannelTypeDirect,
			ExpectedMessage: "this is a message",
		},
		"full message, direct message channel, commented on post": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyRoot,
			ChannelType:       model.ChannelTypeDirect,
			ExpectedMessage:   "this is a message",
		},
		"full message, direct message channel, commented on thread": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyAny,
			ChannelType:       model.ChannelTypeDirect,
			ExpectedMessage:   "this is a message",
		},
		"full message, direct message channel, commented on CRT enabled thread": {
			Message:           "this is a message",
			replyToThreadType: model.CommentsNotifyCRT,
			ChannelType:       model.ChannelTypeDirect,
			ExpectedMessage:   "user: this is a message",
		},
		"generic message with channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, public channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, public channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyRoot,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, public channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyAny,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user commented on a thread you participated in.",
		},
		"generic message with channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, private channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, public private, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyRoot,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, public private, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyAny,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user commented on a thread you participated in.",
		},
		"generic message with channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message with channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message with channel, group message channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user notified the channel.",
		},
		"generic message, group message channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyRoot,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user commented on your post.",
		},
		"generic message, group message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyAny,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user commented on a thread you participated in.",
		},
		"generic message with channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message with channel, direct message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message with channel, direct message channel, channel wide mention": {
			Message:                  "this is a message",
			channelWideMention:       true,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message, direct message channel, commented on post": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyRoot,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message, direct message channel, commented on thread": {
			Message:                  "this is a message",
			replyToThreadType:        model.CommentsNotifyAny,
			PushNotificationContents: model.GenericNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message without channel, public channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, public channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeOpen,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message without channel, private channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, private channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypePrivate,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message without channel, group message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user posted a message.",
		},
		"generic message without channel, group message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeGroup,
			ExpectedMessage:          "user mentioned you.",
		},
		"generic message without channel, direct message channel, no mention": {
			Message:                  "this is a message",
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"generic message without channel, direct message channel, mention": {
			Message:                  "this is a message",
			explicitMention:          true,
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeDirect,
			ExpectedMessage:          "sent you a message.",
		},
		"only files, public channel": {
			HasFiles:        true,
			ChannelType:     model.ChannelTypeOpen,
			ExpectedMessage: "user attached a file.",
		},
		"only files, private channel": {
			HasFiles:        true,
			ChannelType:     model.ChannelTypePrivate,
			ExpectedMessage: "user attached a file.",
		},
		"only files, group message channel": {
			HasFiles:        true,
			ChannelType:     model.ChannelTypeGroup,
			ExpectedMessage: "user attached a file.",
		},
		"only files, direct message channel": {
			HasFiles:        true,
			ChannelType:     model.ChannelTypeDirect,
			ExpectedMessage: "attached a file.",
		},
		"only files without channel, public channel": {
			HasFiles:                 true,
			PushNotificationContents: model.GenericNoChannelNotification,
			ChannelType:              model.ChannelTypeOpen,
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
				pushNotificationContents = model.FullNotification
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
				tc.ChannelType,
				tc.replyToThreadType,
				i18n.GetUserTranslations(locale),
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
	channel1 := th.CreateChannel(th.Context, team)
	th.AddUserToChannel(sender, channel1)
	th.AddUserToChannel(receiver, channel1)

	channel2 := th.CreateChannel(th.Context, team)
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
			msg, err := th.App.BuildPushNotificationMessage(th.Context, model.FullNotification, post, receiver, channel1, channel1.Name, sender.Username, tc.explicitMention, tc.channelWideMention, tc.replyToThreadType)
			require.Nil(t, err)
			assert.Equal(t, tc.expectedBadge, msg.Badge)
		})
	}
}

func TestSendPushNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	_, err := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "test",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, err)

	t.Run("should return error if data is not valid or nil", func(t *testing.T) {
		err := th.App.sendPushNotificationToAllSessions(th.Context, nil, th.BasicUser.Id, "")
		require.NotNil(t, err)
		assert.Equal(t, "api.push_notifications.message.parse.app_error", err.Id)
		// Errors derived of using an empty object are handled internally through the notifications log
		err = th.App.sendPushNotificationToAllSessions(th.Context, &model.PushNotification{}, th.BasicUser.Id, "")
		require.Nil(t, err)
	})
}

func TestShouldSendPushNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	t.Run("should return true if forced", func(t *testing.T) {
		user := &model.User{Id: model.NewId(), Email: "unit@test.com", NotifyProps: make(map[string]string)}
		user.NotifyProps[model.PushNotifyProp] = model.UserNotifyNone

		post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}
		post.AddProp(model.PostPropsForceNotification, model.NewId())

		channelNotifyProps := map[string]string{model.PushNotifyProp: model.ChannelNotifyNone, model.MarkUnreadNotifyProp: model.ChannelMarkUnreadMention}

		status := &model.Status{UserId: user.Id, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: post.ChannelId}

		result := th.App.ShouldSendPushNotification(user, channelNotifyProps, false, status, post, false)
		assert.True(t, result)
	})

	t.Run("should return false if force undefined", func(t *testing.T) {
		user := &model.User{Id: model.NewId(), Email: "unit@test.com", NotifyProps: make(map[string]string)}
		user.NotifyProps[model.PushNotifyProp] = model.UserNotifyNone

		post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}

		channelNotifyProps := map[string]string{model.PushNotifyProp: model.ChannelNotifyNone, model.MarkUnreadNotifyProp: model.ChannelMarkUnreadMention}

		status := &model.Status{UserId: user.Id, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: post.ChannelId}

		result := th.App.ShouldSendPushNotification(user, channelNotifyProps, false, status, post, false)
		assert.False(t, result)
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
			h.printResponse(w, model.NewOkPushResponse())
			return
		}

		var notification model.PushNotification
		var notificationAck model.PushNotificationAck
		var err error
		if r.URL.Path == "/api/v1/send_push" {
			if err = json.NewDecoder(r.Body).Decode(&notification); err != nil {
				h.printResponse(w, model.NewErrorPushResponse("fail"))
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
			if err = json.NewDecoder(r.Body).Decode(&notificationAck); err != nil {
				h.printResponse(w, model.NewErrorPushResponse("fail"))
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
			h._notifications = append(h._notifications, &notification)
		} else {
			h._notificationAcks = append(h._notificationAcks, &notificationAck)
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
		h.printResponse(w, resp)
	}
}

func (h *testPushNotificationHandler) printResponse(w http.ResponseWriter, resp model.PushResponse) {
	jsonData, _ := json.Marshal(&resp)
	fmt.Fprintln(w, string(jsonData))
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

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string"), mock.AnythingOfType("bool")).Return(int64(1), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockSessionStore := mocks.SessionStore{}
	mockSessionStore.On("GetSessionsWithActiveDeviceIds", mock.AnythingOfType("string")).Return([]*model.Session{sess1, sess2}, nil)
	mockSessionStore.On("UpdateProps", mock.Anything).Return(nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Session").Return(&mockSessionStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	// When CRT is disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDisabled
	})

	err := th.App.clearPushNotificationSync(th.Context, sess1.Id, "user1", "channel1", "")
	require.Nil(t, err)
	// Server side verification.
	// We verify that 1 request has been sent, and also check the message contents.
	require.Equal(t, 1, handler.numReqs())
	assert.Equal(t, "channel1", handler.notifications()[0].ChannelId)
	assert.Equal(t, model.PushTypeClear, handler.notifications()[0].Type)

	// When CRT is enabled, Send badge count adding both "User unreads" + "User thread mentions"
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
	})

	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get", mock.AnythingOfType("string"), model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapsedThreadsEnabled).Return(&model.Preference{Value: "on"}, nil)
	mockStore.On("Preference").Return(&mockPreferenceStore)

	mockThreadStore := mocks.ThreadStore{}
	mockThreadStore.On("GetTotalUnreadMentions", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).Return(int64(3), nil)
	mockStore.On("Thread").Return(&mockThreadStore)

	err = th.App.clearPushNotificationSync(th.Context, sess1.Id, "user1", "channel1", "")
	require.Nil(t, err)
	assert.Equal(t, handler.notifications()[1].Badge, 4)
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

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string"), mock.AnythingOfType("bool")).Return(int64(1), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockSessionStore := mocks.SessionStore{}
	mockSessionStore.On("GetSessionsWithActiveDeviceIds", mock.AnythingOfType("string")).Return([]*model.Session{sess1, sess2}, nil)
	mockSessionStore.On("UpdateProps", mock.Anything).Return(nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Session").Return(&mockSessionStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDisabled
	})

	err := th.App.updateMobileAppBadgeSync(th.Context, "user1")
	require.Nil(t, err)
	// Server side verification.
	// We verify that 2 requests have been sent, and also check the message contents.
	require.Equal(t, 2, handler.numReqs())
	assert.Equal(t, 1, handler.notifications()[0].ContentAvailable)
	assert.Equal(t, model.PushTypeUpdateBadge, handler.notifications()[0].Type)
	assert.Equal(t, 1, handler.notifications()[1].ContentAvailable)
	assert.Equal(t, model.PushTypeUpdateBadge, handler.notifications()[1].Type)
}

func TestSendTestPushNotification(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	handler := &testPushNotificationHandler{t: t}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	// Per mock definition, first time will send remove, second time will send OK
	result := th.App.SendTestPushNotification("platform:id")
	assert.Equal(t, "false", result)
	result = th.App.SendTestPushNotification("platform:id")
	assert.Equal(t, "true", result)

	// Server side verification.
	// We verify that 2 requests have been sent, and also check the message contents.
	require.Equal(t, 2, handler.numReqs())
	assert.Equal(t, model.PushTypeTest, handler.notifications()[0].Type)
	assert.Equal(t, model.PushTypeTest, handler.notifications()[1].Type)
}

func TestSendAckToPushProxy(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	handler := &testPushNotificationHandler{t: t}
	pushServer := httptest.NewServer(
		http.HandlerFunc(handler.handleReq),
	)
	defer pushServer.Close()

	mockStore := th.App.Srv().Store().(*mocks.Store)
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
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	ack := &model.PushNotificationAck{
		Id:               "testid",
		NotificationType: model.PushTypeMessage,
	}
	err := th.App.SendAckToPushProxy(ack)
	require.NoError(t, err)
	// Server side verification.
	// We verify that 1 request has been sent, and also check the message contents.
	require.Equal(t, 1, handler.numReqs())
	assert.Equal(t, ack.Id, handler.notificationAcks()[0].Id)
	assert.Equal(t, ack.NotificationType, handler.notificationAcks()[0].NotificationType)
}

// TestAllPushNotifications is a master test which sends all various types
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
		sess, err := th.App.CreateSession(th.Context, &model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		// We don't need to track the 2nd session.
		_, err = th.App.CreateSession(th.Context, &model.Session{
			UserId:    u.Id,
			DeviceId:  "deviceID" + u.Id,
			ExpiresAt: model.GetMillis() + 100000,
		})
		require.Nil(t, err)
		_, err = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, u.Id)
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
		*cfg.EmailSettings.PushNotificationContents = model.GenericNotification
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
				th.App.sendPushNotification(notification, &user, true, false, model.CommentsNotifyAny)
			}(*data.user)
		case 1:
			go func(id string) {
				defer wg.Done()
				th.App.UpdateMobileAppBadge(id)
			}(data.user.Id)
		case 2:
			go func(sessID, userID string) {
				defer wg.Done()
				th.App.clearPushNotification(sessID, userID, th.BasicChannel.Id, "")
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
		case model.PushTypeClear:
			numClears++
			assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
		case model.PushTypeMessage:
			numMessages++
			assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
			assert.Contains(t, n.Message, "mentioned you")
		case model.PushTypeUpdateBadge:
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
	th := Setup(t)
	defer th.TearDown()

	memoryStore := config.NewTestMemoryStore()
	mockStore := testlib.GetMockStoreForSetupFunctions()
	// Playbooks DB job requires a plugin mock
	pluginStore := mocks.PluginStore{}
	pluginStore.On("List", mock.Anything, mock.Anything, mock.Anything).Return([]string{}, nil)
	mockStore.On("Plugin").Return(&pluginStore)
	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get",
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string"),
		mock.AnythingOfType("string")).
		Return(&model.Preference{Value: "test"}, nil)
	mockStore.On("Preference").Return(&mockPreferenceStore)
	s := &Server{
		Router: mux.NewRouter(),
	}
	var err error
	s.platform, err = platform.New(
		platform.ServiceConfig{},
		platform.ConfigStore(memoryStore),
		platform.SetFileStore(&fmocks.FileBackend{}),
		platform.SetExportFileStore(&fmocks.FileBackend{}),
		platform.StoreOverride(mockStore))
	require.NoError(t, err)
	ch, err := NewChannels(s)
	require.NoError(t, err)
	s.ch = ch

	app := New(ServerConnector(s.Channels()))
	require.NotPanics(t, func() {
		s.createPushNotificationsHub(th.Context)

		s.StopPushNotificationsHubWorkers()

		// Now we start sending messages after the PN hub is shut down.
		// We test all 3 notification types.
		app.clearPushNotification("currentSessionId", "userId", "channelId", "")

		app.UpdateMobileAppBadge("userId")

		notification := &PostNotification{
			Post:    &model.Post{},
			Channel: &model.Channel{},
			ProfileMap: map[string]*model.User{
				"userId": {},
			},
			Sender: &model.User{},
		}
		app.sendPushNotification(notification, &model.User{}, true, false, model.CommentsNotifyAny)
	})
}

func TestPushNotificationAttachment(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	originalMessage := "hello world"
	post := &model.Post{
		Message: originalMessage,
		Props: map[string]any{
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

	t.Run("The notification should contain the fallback message from the attachment", func(t *testing.T) {
		pn := th.App.buildFullPushNotificationMessage(th.Context, "full", post, user, ch, ch.Name, "test", false, false, "")
		assert.Equal(t, "test: hello world\nfallback text", pn.Message)
	})

	t.Run("The original post message should not be modified", func(t *testing.T) {
		assert.Equal(t, originalMessage, post.Message)
	})
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

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetUnreadCount", mock.AnythingOfType("string"), mock.AnythingOfType("bool")).Return(int64(1), nil)
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
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

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
		mockSessionStore.On("UpdateProps", mock.Anything).Return(nil)

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
		Type:     model.ChannelTypeOpen,
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
					th.App.sendPushNotification(notification, &user, true, false, model.CommentsNotifyAny)
				}(*data.user)
			case 1:
				go func(id string) {
					defer wg.Done()
					th.App.UpdateMobileAppBadge(id)
				}(data.user.Id)
			case 2:
				go func(sessID, userID string) {
					defer wg.Done()
					th.App.clearPushNotification(sessID, userID, ch.Id, "")
				}(data.session.Id, data.user.Id)
			}
		}
		wg.Wait()
	}
	b.Logf("throughput: %f reqs/s", float64(len(testData)*cnt)/time.Since(then).Seconds())
	b.StopTimer()
	time.Sleep(2 * time.Second)
}
