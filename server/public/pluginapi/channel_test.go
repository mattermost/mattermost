package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestGetMembers(t *testing.T) {
	t.Run("empty list", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetChannelMembers", "channelID", 1, 10).Return(nil, nil)

		cm, err := client.Channel.ListMembers("channelID", 1, 10)
		require.NoError(t, err)
		require.Empty(t, cm)
	})
}

func TestGetTeamChannelByName(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetChannelByNameForTeamName", "1", "2", true).Return(&model.Channel{TeamId: "3"}, nil)

		channel, err := client.Channel.GetByNameForTeamName("1", "2", true)
		require.NoError(t, err)
		require.Equal(t, &model.Channel{TeamId: "3"}, channel)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetChannelByNameForTeamName", "1", "2", true).Return(nil, newAppError())

		channel, err := client.Channel.GetByNameForTeamName("1", "2", true)
		require.EqualError(t, err, "here: id, an error occurred")
		require.Zero(t, channel)
	})
}

func TestGetTeamUserChannels(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetChannelsForTeamForUser", "1", "2", true).Return([]*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, nil)

		channels, err := client.Channel.ListForTeamForUser("1", "2", true)
		require.NoError(t, err)
		require.Equal(t, []*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, channels)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetChannelsForTeamForUser", "1", "2", true).Return(nil, appErr)

		channels, err := client.Channel.ListForTeamForUser("1", "2", true)
		require.Equal(t, appErr, err)
		require.Len(t, channels, 0)
	})
}

func TestGetPublicTeamChannels(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetPublicChannelsForTeam", "1", 2, 3).Return([]*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, nil)

		channels, err := client.Channel.ListPublicChannelsForTeam("1", 2, 3)
		require.NoError(t, err)
		require.Equal(t, []*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, channels)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetPublicChannelsForTeam", "1", 2, 3).Return(nil, appErr)

		channels, err := client.Channel.ListPublicChannelsForTeam("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Len(t, channels, 0)
	})
}

func TestCreateChannel(t *testing.T) {
	t.Run("create channel with no replicas", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DataSourceReplicas: []string{},
			},
		}
		api.On("GetConfig").Return(config).Once()

		c := &model.Channel{
			Id:          model.NewId(),
			Name:        "name",
			DisplayName: "displayname",
		}
		api.On("CreateChannel", c).Return(c, nil).Once()

		err := client.Channel.Create(c)
		require.NoError(t, err)
	})

	t.Run("create channel and wait once", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DataSourceReplicas: []string{"replica1"},
			},
		}
		api.On("GetConfig").Return(config).Once()

		c := &model.Channel{
			Id:          model.NewId(),
			Name:        "name",
			DisplayName: "displayname",
		}
		api.On("CreateChannel", c).Return(c, nil).Once()
		api.On("GetChannel", c.Id).Return(c, nil).Once()

		err := client.Channel.Create(c)
		require.NoError(t, err)
	})

	t.Run("create channel and wait multiple times", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DataSourceReplicas: []string{"replica1"},
			},
		}
		api.On("GetConfig").Return(config).Once()

		c := &model.Channel{
			Id:          model.NewId(),
			Name:        "name",
			DisplayName: "displayname",
		}
		api.On("CreateChannel", c).Return(c, nil).Once()

		notFoundErr := model.NewAppError("", "", nil, "", http.StatusNotFound)
		api.On("GetChannel", c.Id).Return(c, notFoundErr).Times(3)
		api.On("GetChannel", c.Id).Return(c, nil).Times(1)

		err := client.Channel.Create(c)
		require.NoError(t, err)
	})

	t.Run("create channel, wait multiple times and return error", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DataSourceReplicas: []string{"replica1"},
			},
		}
		api.On("GetConfig").Return(config).Once()

		c := &model.Channel{
			Id:          model.NewId(),
			Name:        "name",
			DisplayName: "displayname",
		}
		api.On("CreateChannel", c).Return(c, nil).Once()

		notFoundErr := model.NewAppError("", "", nil, "", http.StatusNotFound)
		api.On("GetChannel", c.Id).Return(c, notFoundErr).Times(3)

		otherErr := model.NewAppError("", "", nil, "", http.StatusInternalServerError)
		api.On("GetChannel", c.Id).Return(c, otherErr).Times(1)

		err := client.Channel.Create(c)
		require.Error(t, err)
	})

	t.Run("create channel, give up waiting", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DataSourceReplicas: []string{"replica1"},
			},
		}
		api.On("GetConfig").Return(config).Once()

		c := &model.Channel{
			Id:          model.NewId(),
			Name:        "name",
			DisplayName: "displayname",
		}
		api.On("CreateChannel", c).Return(c, nil).Once()

		notFoundErr := model.NewAppError("", "", nil, "", http.StatusNotFound)
		api.On("GetChannel", c.Id).Return(c, notFoundErr)

		err := client.Channel.Create(c)
		require.Error(t, err)
		require.Contains(t, err.Error(), "giving up waiting")
	})
}

func TestCreateSidebarCategory(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		category := model.SidebarCategoryWithChannels{}

		api.On("CreateChannelSidebarCategory", "user_id", "team_id", &category).
			Return(&model.SidebarCategoryWithChannels{
				SidebarCategory: model.SidebarCategory{
					Id:     "id",
					UserId: "user_id",
					TeamId: "team_id",
				},
				Channels: []string{"channelA", "channelB"}},
				nil)

		err := client.Channel.CreateSidebarCategory("user_id", "team_id", &category)

		require.NoError(t, err)
		require.Equal(t,
			model.SidebarCategoryWithChannels{
				SidebarCategory: model.SidebarCategory{Id: "id", UserId: "user_id", TeamId: "team_id"},
				Channels:        []string{"channelA", "channelB"}},
			category)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		inputCategory := model.SidebarCategoryWithChannels{}
		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CreateChannelSidebarCategory", "user_id", "team_id", &inputCategory).
			Return(&model.SidebarCategoryWithChannels{}, appErr)

		err := client.Channel.CreateSidebarCategory("user_id", "team_id", &inputCategory)

		require.Equal(t, appErr, err)
	})
}

func TestGetSidebarCategories(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetChannelSidebarCategories", "user_id", "team_id").
			Return(&model.OrderedSidebarCategories{
				Categories: nil,
				Order:      []string{"channelA", "channelB"},
			},
				nil)

		categories, err := client.Channel.GetSidebarCategories("user_id", "team_id")

		require.NoError(t, err)
		require.Equal(t,
			model.OrderedSidebarCategories{
				Categories: nil,
				Order:      []string{"channelA", "channelB"},
			},
			*categories)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetChannelSidebarCategories", "user_id", "team_id").Return(nil, appErr)

		_, err := client.Channel.GetSidebarCategories("user_id", "team_id")

		require.Equal(t, appErr, err)
	})
}

func TestUpdateSidebarCategories(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		categories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{},
				Channels:        nil,
			},
		}
		updatedCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:     "id",
					UserId: "user_id",
					TeamId: "team_id",
				},
				Channels: []string{"channelA", "channelB"},
			}}

		api.On("UpdateChannelSidebarCategories", "user_id", "team_id", categories).Return(updatedCategories, nil)

		err := client.Channel.UpdateSidebarCategories("user_id", "team_id", categories)

		require.NoError(t, err)
		require.EqualValues(t, updatedCategories, categories)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		inputCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{},
				Channels:        nil,
			},
		}
		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("UpdateChannelSidebarCategories", "user_id", "team_id", inputCategories).Return(nil, appErr)

		err := client.Channel.UpdateSidebarCategories("user_id", "team_id", inputCategories)

		require.Equal(t, appErr, err)
	})
}
