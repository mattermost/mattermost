package pluginapi_test

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestGetMembers(t *testing.T) {
	t.Run("empty list", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

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
		client := pluginapi.NewClient(api)

		api.On("GetChannelByNameForTeamName", "1", "2", true).Return(&model.Channel{TeamId: "3"}, nil)

		channel, err := client.Channel.GetByNameForTeamName("1", "2", true)
		require.NoError(t, err)
		require.Equal(t, &model.Channel{TeamId: "3"}, channel)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

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
		client := pluginapi.NewClient(api)

		api.On("GetChannelsForTeamForUser", "1", "2", true).Return([]*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, nil)

		channels, err := client.Channel.ListForTeamForUser("1", "2", true)
		require.NoError(t, err)
		require.Equal(t, []*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, channels)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

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
		client := pluginapi.NewClient(api)

		api.On("GetPublicChannelsForTeam", "1", 2, 3).Return([]*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, nil)

		channels, err := client.Channel.ListPublicChannelsForTeam("1", 2, 3)
		require.NoError(t, err)
		require.Equal(t, []*model.Channel{{TeamId: "3"}, {TeamId: "4"}}, channels)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		appErr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetPublicChannelsForTeam", "1", 2, 3).Return(nil, appErr)

		channels, err := client.Channel.ListPublicChannelsForTeam("1", 2, 3)
		require.Equal(t, appErr, err)
		require.Len(t, channels, 0)
	})
}
