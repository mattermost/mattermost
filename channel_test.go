package pluginapi_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/require"

	"pluginapi"
)

func TestGetMembers(t *testing.T) {
	t.Run("empty list", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api)

		api.On("GetChannelMembers", "channelID", 1, 10).Return(nil, nil)

		cm, err := client.Channel.GetMembers("channelID", 1, 10)
		require.NoError(t, err)
		require.Empty(t, cm)
	})
}
