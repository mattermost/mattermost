// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func TestBuildPushNotificationMessageDMGM(t *testing.T) {
	// setup posts in the conversations, then has the PDP decide reading and writing them.
	setup := func(t *testing.T, allowRead, allowWrite bool) (*dmGmFixture, map[string]*model.Post) {
		t.Helper()
		f := setupDMGMAccessTest(t)
		f.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePostUsernameOverride = true
			*cfg.ServiceSettings.EnablePostIconOverride = true
		})
		posts := map[string]*model.Post{}
		for _, channel := range []*model.Channel{f.dm, f.gm} {
			post, _, appErr := f.th.App.CreatePost(f.th.Context, &model.Post{
				UserId:    f.th.BasicUser2.Id,
				ChannelId: channel.Id,
				Message:   "secret " + model.NewId(),
			}, channel, model.CreatePostFlags{})
			require.Nil(t, appErr)
			// Saving strips the overrides from a user's post; an integration's keeps them.
			post.AddProp(model.PostPropsOverrideUsername, "override")
			post.AddProp(model.PostPropsOverrideIconURL, "https://example.com/icon.png")
			posts[channel.Id] = post
		}

		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
		decidesDMGM(mockACS, map[string]bool{
			model.AccessControlPolicyActionDMGMReadAccess:  allowRead,
			model.AccessControlPolicyActionDMGMWriteAccess: allowWrite,
		})
		return f, posts
	}
	// build runs the way the push hub does: for the recipient, with no session.
	build := func(t *testing.T, f *dmGmFixture, post *model.Post, channel *model.Channel) *model.PushNotification {
		t.Helper()
		msg, appErr := f.th.App.BuildPushNotificationMessage(
			request.EmptyContext(f.th.App.Log()),
			model.FullNotification,
			post,
			f.th.BasicUser,
			channel,
			"conversation name",
			f.th.BasicUser2.Username,
			true, false, "",
		)
		require.Nil(t, appErr)
		return msg
	}
	defaultMessage := i18n.GetUserTranslations(model.DefaultLocale)("api.push_notification.id_loaded.default_message")

	t.Run("a denied recipient gets an id-only push", func(t *testing.T) {
		f, posts := setup(t, false, true)
		notification := &eMocks.NotificationInterface{}
		notification.On("CheckLicense").Return(nil)
		f.th.App.Srv().ch.Notification = notification
		t.Cleanup(func() { f.th.App.Srv().ch.Notification = nil })

		for _, channel := range []*model.Channel{f.dm, f.gm} {
			msg := build(t, f, posts[channel.Id], channel)
			require.True(t, msg.IsIdLoaded, "%s", channel.Type)
			require.Equal(t, posts[channel.Id].Id, msg.PostId)
			require.Equal(t, defaultMessage, msg.Message)
			require.Empty(t, msg.ChannelName)
		}
	})

	t.Run("without the id-only path a denied recipient learns no names", func(t *testing.T) {
		f, posts := setup(t, false, true)

		for _, channel := range []*model.Channel{f.dm, f.gm} {
			msg := build(t, f, posts[channel.Id], channel)
			require.False(t, msg.IsIdLoaded, "%s", channel.Type)
			require.Equal(t, posts[channel.Id].Id, msg.PostId)
			require.Equal(t, defaultMessage, msg.Message)
			require.Empty(t, msg.ChannelName)
			require.Empty(t, msg.SenderName)
			require.Empty(t, msg.OverrideUsername)
			require.Empty(t, msg.OverrideIconURL)
		}
	})

	t.Run("an allowed recipient gets the content and the names", func(t *testing.T) {
		f, posts := setup(t, true, true)

		msg := build(t, f, posts[f.gm.Id], f.gm)
		require.Contains(t, msg.Message, posts[f.gm.Id].Message)
		require.Equal(t, "conversation name", msg.ChannelName)
		require.Equal(t, "override", msg.SenderName)
		require.Equal(t, model.CategoryCanReply, msg.Category)
	})

	t.Run("a recipient who may not write gets no reply action", func(t *testing.T) {
		f, posts := setup(t, true, false)

		for _, channel := range []*model.Channel{f.dm, f.gm} {
			msg := build(t, f, posts[channel.Id], channel)
			require.Contains(t, msg.Message, posts[channel.Id].Message, "%s", channel.Type)
			require.Empty(t, msg.Category)
		}

		// A channel's reply action doesn't depend on the conversation decision.
		msg := build(t, f, f.th.BasicPost, f.th.BasicChannel)
		require.Equal(t, model.CategoryCanReply, msg.Category)
	})

	t.Run("one evaluation per action covers the read, badge and write checks", func(t *testing.T) {
		f, posts := setup(t, true, true)
		build(t, f, posts[f.dm.Id], f.dm)

		mockACS := f.th.App.Srv().ch.AccessControl.(*eMocks.AccessControlServiceInterface)
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})
}

func TestDMGMPushBadge(t *testing.T) {
	// BasicUser is mentioned once in a channel and once in each conversation.
	setup := func(t *testing.T, allowRead bool) *dmGmFixture {
		t.Helper()
		f := setupDMGMAccessTest(t)
		f.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDisabled
		})
		for _, channel := range []*model.Channel{f.th.BasicChannel, f.dm, f.gm} {
			_, _, appErr := f.th.App.CreatePost(f.th.Context, &model.Post{
				UserId:    f.th.BasicUser2.Id,
				ChannelId: channel.Id,
				Message:   "@" + f.th.BasicUser.Username + " hello",
			}, channel, model.CreatePostFlags{})
			require.Nil(t, appErr)
		}

		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
		decidesDMGM(mockACS, map[string]bool{
			model.AccessControlPolicyActionDMGMReadAccess:  allowRead,
			model.AccessControlPolicyActionDMGMWriteAccess: true,
		})
		return f
	}
	badge := func(t *testing.T, f *dmGmFixture) int {
		t.Helper()
		msg, appErr := f.th.App.BuildPushNotificationMessage(request.EmptyContext(f.th.App.Log()), model.FullNotification,
			f.th.BasicPost, f.th.BasicUser, f.th.BasicChannel, f.th.BasicChannel.Name, f.th.BasicUser2.Username, true, false, "")
		require.Nil(t, appErr)
		return msg.Badge
	}

	t.Run("counts only channel mentions while conversations are hidden", func(t *testing.T) {
		f := setup(t, false)
		require.Equal(t, 1, badge(t, f))

		// The other push types use the same count.
		count, appErr := f.th.App.getUserBadgeCount(request.EmptyContext(f.th.App.Log()), f.th.BasicUser.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, 1, count)
	})

	t.Run("counts conversation mentions too while they can be read", func(t *testing.T) {
		f := setup(t, true)
		require.Equal(t, 3, badge(t, f))
	})
}

func TestDMGMPushBadgeExcludesConversationThreads(t *testing.T) {
	f := setupDMGMAccessTest(t)
	f.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsAlwaysOn
	})
	// A reply mentioning BasicUser in a thread of theirs, in a channel and in the DM.
	for _, channel := range []*model.Channel{f.th.BasicChannel, f.dm} {
		root := createDMGMPost(t, f.th, channel, f.th.BasicUser.Id, "")
		_, _, appErr := f.th.App.CreatePost(f.th.Context, &model.Post{
			UserId:    f.th.BasicUser2.Id,
			ChannelId: channel.Id,
			RootId:    root.Id,
			Message:   "@" + f.th.BasicUser.Username + " reply",
		}, channel, model.CreatePostFlags{})
		require.Nil(t, appErr)
	}

	mockACS := f.mockACS(t)
	allDMGMGoverned(mockACS)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
	decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

	count, appErr := f.th.App.getUserBadgeCount(request.EmptyContext(f.th.App.Log()), f.th.BasicUser.Id, true)
	require.Nil(t, appErr)
	require.Equal(t, 1, count, "only the channel thread's mention")
}
