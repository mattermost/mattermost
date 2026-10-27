package pluginapi_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
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

func TestGetNodeID(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("GetClusterNodeID").Return("node1")

	require.Equal(t, "node1", client.Cluster.GetNodeID())
}

func TestGetNodes(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		nodes := []*model.ClusterInfo{{Id: "node1"}, {Id: "node2"}}
		api.On("GetClusterNodes").Return(nodes, nil)

		got, err := client.Cluster.GetNodes()
		require.NoError(t, err)
		require.Equal(t, nodes, got)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetClusterNodes").Return(nil, errors.New("someError"))

		_, err := client.Cluster.GetNodes()
		require.Error(t, err)
	})
}
