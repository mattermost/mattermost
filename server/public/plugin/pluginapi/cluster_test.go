package pluginapi_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

func TestPublishPluginClusterEvent(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("PublishPluginClusterEvent",
			model.PluginClusterEvent{Id: "someID", Data: []byte("foo")},
			model.PluginClusterEventSendOptions{SendType: model.PluginClusterEventSendTypeReliable},
		).Return(nil)

		err := client.Cluster.PublishPluginEvent(
			model.PluginClusterEvent{Id: "someID", Data: []byte("foo")},
			model.PluginClusterEventSendOptions{SendType: model.PluginClusterEventSendTypeReliable},
		)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("PublishPluginClusterEvent",
			model.PluginClusterEvent{Id: "someID", Data: []byte("foo")},
			model.PluginClusterEventSendOptions{SendType: model.PluginClusterEventSendTypeReliable},
		).Return(errors.New("someError"))

		err := client.Cluster.PublishPluginEvent(
			model.PluginClusterEvent{Id: "someID", Data: []byte("foo")},
			model.PluginClusterEventSendOptions{SendType: model.PluginClusterEventSendTypeReliable},
		)
		require.Error(t, err)
	})
}
