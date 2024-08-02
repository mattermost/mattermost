package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// ClusterService exposes methods to interact with cluster nodes.
type ClusterService struct {
	api plugin.API
}

// ClusterService broadcasts a plugin event to all other running instances of
// the calling plugin that are present in the cluster.
//
// This method is used to allow plugin communication in a High-Availability cluster.
// The receiving side should implement the OnPluginClusterEvent hook
// to receive events sent through this method.
//
// Minimum server version: 5.36
func (c *ClusterService) PublishPluginEvent(ev model.PluginClusterEvent, opts model.PluginClusterEventSendOptions) error {
	return c.api.PublishPluginClusterEvent(ev, opts)
}
