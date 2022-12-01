// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	storemocks "github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestPostPersistentNotificationApp(t *testing.T) {
	t.Run("DeletePersistentNotificationsPost", func(t *testing.T) { testDeletePersistentNotificationsPost(t) })
}

func testDeletePersistentNotificationsPost(t *testing.T) {
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true

		err := th.App.DeletePersistentNotificationsPost(post, "", false)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete without checking mentions", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true

		err := th.App.DeletePersistentNotificationsPost(post, "", false)
		require.Nil(t, err)

		mockChannel.AssertNotCalled(t, "GetChannelsByIds", mock.Anything, mock.Anything)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})

	mentionedUserCases := []struct {
		desc            string
		mentionedUserID string
		assertFn        func(t *testing.T, err *model.AppError, mockPostPersistentNotification storemocks.PostPersistentNotificationStore)
	}{
		{
			desc:            "should delete for mentioned user",
			mentionedUserID: "uid1",
			assertFn: func(t *testing.T, err *model.AppError, mockPostPersistentNotification storemocks.PostPersistentNotificationStore) {
				require.Nil(t, err)
				mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
			},
		},
		{
			desc:            "should not delete for non-mentioned user",
			mentionedUserID: "uid2",
			assertFn: func(t *testing.T, err *model.AppError, mockPostPersistentNotification storemocks.PostPersistentNotificationStore) {
				require.NotNil(t, err)
				mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
			},
		},
	}

	for _, tc := range mentionedUserCases {
		tc := tc
		t.Run(tc.desc, func(t *testing.T) {
			os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
			defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

			th := SetupWithStoreMock(t)
			defer th.TearDown()

			user1 := &model.User{Id: "uid1", Username: "user-1"}
			profileMap := map[string]*model.User{user1.Id: user1}
			team := &model.Team{Id: "tid"}
			channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
			post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @user-1", UserId: user1.Id}

			mockStore := th.App.Srv().Store().(*storemocks.Store)

			mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
			mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
			mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: post.Id}}, false, nil)
			mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

			mockChannel := storemocks.ChannelStore{}
			mockStore.On("Channel").Return(&mockChannel)
			mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)

			mockTeam := storemocks.TeamStore{}
			mockStore.On("Team").Return(&mockTeam)
			mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

			mockUser := storemocks.UserStore{}
			mockStore.On("User").Return(&mockUser)
			mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

			mockGroup := storemocks.GroupStore{}
			mockStore.On("Group").Return(&mockGroup)
			mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

			th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
			cfg := th.App.Config()
			*cfg.ServiceSettings.PostPriority = true

			err := th.App.DeletePersistentNotificationsPost(post, tc.mentionedUserID, true)
			tc.assertFn(t, err, mockPostPersistentNotification)
		})
	}
}

func testSendPersistentNotifications(t *testing.T) {
	t.Run("Delete expired notifications posts", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		profileMap := map[string]*model.User{user1.Id: user1}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		expiredMillis := time.Now().AddDate(-1, 0, 0).UnixMilli()
		expiredPost := &model.Post{Id: "pid1", ChannelId: channel.Id, Message: "tagging @user-1", UserId: user1.Id, CreateAt: expiredMillis}
		validPost := &model.Post{Id: "pid2", ChannelId: channel.Id, Message: "tagging @user-1", UserId: user1.Id, CreateAt: model.GetMillis()}
		posts := []*model.Post{
			expiredPost,
			validPost,
		}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("Get", mock.Anything).Return([]*model.PostPersistentNotifications{{PostId: posts[0].Id}, {PostId: posts[1].Id}}, false, nil)
		mockPostPersistentNotification.On("Delete", mock.MatchedBy(func(ids []string) bool { return len(ids) == 1 && ids[0] == expiredPost.Id })).Return(nil)

		mockPost := storemocks.PostStore{}
		mockStore.On("Post").Return(&mockPost)
		mockPost.On("GetPostsByIds", mock.Anything).Return(posts, nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)

		mockTeam := storemocks.TeamStore{}
		mockStore.On("Team").Return(&mockTeam)
		mockTeam.On("GetMany", mock.Anything).Return([]*model.Team{team}, nil)

		mockUser := storemocks.UserStore{}
		mockStore.On("User").Return(&mockUser)
		mockUser.On("GetAllProfilesInChannel", mock.Anything, mock.Anything, mock.Anything).Return(profileMap, nil)

		mockGroup := storemocks.GroupStore{}
		mockStore.On("Group").Return(&mockGroup)
		mockGroup.On("GetGroups", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Group{}, nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.EmailSettings.SendEmailNotifications = true
		*cfg.EmailSettings.RequireEmailVerification = false
		*cfg.TeamSettings.MaxNotificationsPerChannel = 10
		// *cfg.ServiceSettings.PersistenceNotificationInterval = "5m"
		// *cfg.ServiceSettings.PersistenceNotificationMaxCount = 10

		// err := th.App.DeletePersistentNotificationsPost(post, tc.mentionedUserID, true)
		// tc.assertFn(t, err, mockPostPersistentNotification)
	})
}
