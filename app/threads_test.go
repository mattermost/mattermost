// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/users"
	"github.com/mattermost/mattermost-server/v6/model"
	storemocks "github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestUpdateThreadReadForUser(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	t.Run("Ensure thread membership is created and followed", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		rootPost, appErr := th.App.CreatePost(th.Context, &model.Post{UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hi"}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		replyPost, appErr := th.App.CreatePost(th.Context, &model.Post{RootId: rootPost.Id, UserId: th.BasicUser2.Id, CreateAt: model.GetMillis(), ChannelId: th.BasicChannel.Id, Message: "hi"}, th.BasicChannel, false, false)
		require.Nil(t, appErr)
		threads, appErr := th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		require.Zero(t, threads.Total)

		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "currentSessionId", th.BasicUser.Id, th.BasicChannel.TeamId, rootPost.Id, replyPost.CreateAt)
		require.Nil(t, appErr)

		threads, appErr = th.App.GetThreadsForUser(th.BasicUser.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		assert.NotZero(t, threads.Total)

		threadMembership, appErr := th.App.GetThreadMembershipForUser(th.BasicUser.Id, rootPost.Id)
		require.Nil(t, appErr)
		require.NotNil(t, threadMembership)
		assert.True(t, threadMembership.Following)
	})

	t.Run("Ensure no panic on error", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
		mockUserStore.On("Get", mock.Anything, "user1").Return(&model.User{Id: "user1"}, nil)

		mockThreadStore := storemocks.ThreadStore{}
		mockThreadStore.On("MaintainMembership", "user1", "postid", mock.Anything).Return(nil, errors.New("error"))

		var err error
		th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
			UserStore:    &mockUserStore,
			SessionStore: &storemocks.SessionStore{},
			OAuthStore:   &storemocks.OAuthStore{},
			ConfigFn:     th.App.ch.srv.platform.Config,
			LicenseFn:    th.App.ch.srv.License,
		})
		require.NoError(t, err)
		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Thread").Return(&mockThreadStore)

		_, err = th.App.UpdateThreadReadForUser(th.Context, "currentSessionId", "user1", "team1", "postid", 100)
		require.Error(t, err)
	})
}
