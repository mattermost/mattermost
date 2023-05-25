// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost-server/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestResolvePersistentNotification(t *testing.T) {
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(nil, &store.ErrNotFound{})
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, "")
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete for mentioned user", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

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
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, user1.Id)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for post owner", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1"}
		post := &model.Post{Id: "test id", UserId: user1.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		err := th.App.ResolvePersistentNotification(th.Context, post, user1.Id)
		require.Nil(t, err)

		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should not delete for non-mentioned user", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		user1 := &model.User{Id: "uid1", Username: "user-1"}
		user2 := &model.User{Id: "uid2", Username: "user-2"}
		user3 := &model.User{Id: "uid3", Username: "user-3"}
		profileMap := map[string]*model.User{user1.Id: user1, user2.Id: user2, user3.Id: user3}
		team := &model.Team{Id: "tid"}
		channel := &model.Channel{Id: "chid", TeamId: team.Id, Type: model.ChannelTypeOpen}
		post := &model.Post{Id: "pid", ChannelId: channel.Id, Message: "tagging @" + user1.Username, UserId: user2.Id}

		mockStore := th.App.Srv().Store().(*storemocks.Store)

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockChannel := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannel)
		mockChannel.On("GetChannelsByIds", mock.Anything, mock.Anything).Return([]*model.Channel{channel}, nil)
		mockChannel.On("GetAllChannelMembersNotifyPropsForChannel", mock.Anything, mock.Anything).Return(map[string]model.StringMap{}, nil)

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
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.ResolvePersistentNotification(th.Context, post, user3.Id)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})
}

func TestDeletePersistentNotification(t *testing.T) {
	t.Run("should not delete when no posts exist", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(nil, &store.ErrNotFound{})
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true

		err := th.App.DeletePersistentNotification(th.Context, post)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertNotCalled(t, "Delete", mock.Anything)
	})

	t.Run("should delete", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_POSTPRIORITY", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_POSTPRIORITY")

		th := SetupWithStoreMock(t)
		defer th.TearDown()

		post := &model.Post{Id: "test id"}

		mockPostPersistentNotification := storemocks.PostPersistentNotificationStore{}
		mockPostPersistentNotification.On("GetSingle", mock.Anything).Return(&model.PostPersistentNotifications{PostId: post.Id}, nil)
		mockPostPersistentNotification.On("Delete", mock.Anything).Return(nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("PostPersistentNotification").Return(&mockPostPersistentNotification)

		th.App.Srv().SetLicense(getLicWithSkuShortName(model.LicenseShortSkuProfessional))
		cfg := th.App.Config()
		*cfg.ServiceSettings.PostPriority = true

		err := th.App.DeletePersistentNotification(th.Context, post)
		require.Nil(t, err)
		mockPostPersistentNotification.AssertCalled(t, "Delete", mock.Anything)
	})
}

func TestSendPersistentNotifications(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)

	s := "Urgent"
	tr := true
	p1 := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "test " + "@" + th.BasicUser2.Username,
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                &s,
				PersistentNotifications: &tr,
			},
		},
	}
	_, appErr := th.App.CreatePost(th.Context, p1, th.BasicChannel, false, false)
	require.Nil(t, appErr)

	err := th.App.SendPersistentNotifications()
	require.NoError(t, err)
}
