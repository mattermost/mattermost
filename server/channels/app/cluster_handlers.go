// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v7/plugin"
)

func (s *Server) clusterInstallPluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		mlog.Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().installPluginFromData(data)
}

func (s *Server) clusterRemovePluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		mlog.Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().removePluginFromData(data)
}

func (s *Server) clusterPluginEventHandler(msg *model.ClusterMessage) {
	if msg.Props == nil {
		mlog.Warn("ClusterMessage.Props for plugin event should not be nil")
		return
	}
	pluginID := msg.Props["PluginID"]
	// if the plugin key is empty, the message might be coming from a product.
	if pluginID == "" {
		pluginID = msg.Props["ProductID"]
	}
	eventID := msg.Props["EventID"]
	if pluginID == "" || eventID == "" {
		mlog.Warn("Invalid ClusterMessage.Props values for plugin event",
			mlog.String("plugin_id", pluginID), mlog.String("event_id", eventID))
		return
	}

	channels, ok := s.products["channels"].(*Channels)
	if !ok {
		return
	}

	hooks, err := channels.HooksForPluginOrProduct(pluginID)
	if err != nil {
		mlog.Warn("Getting hooks for plugin failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return
	}

	hooks.OnPluginClusterEvent(&plugin.Context{}, model.PluginClusterEvent{
		Id:   eventID,
		Data: msg.Data,
	})
}

// registerClusterHandlers registers the cluster message handlers that are handled by the server.
//
// The cluster event handlers are spread across this function and NewLocalCacheLayer.
// Be careful to not have duplicated handlers here and there.
func (s *Server) registerClusterHandlers() {

	s.platform.RegisterClusterMessageHandler(model.ClusterEventInstallPlugin, s.clusterInstallPluginHandler)
	s.platform.RegisterClusterMessageHandler(model.ClusterEventRemovePlugin, s.clusterRemovePluginHandler)
	s.platform.RegisterClusterMessageHandler(model.ClusterEventPluginEvent, s.clusterPluginEventHandler)

	s.platform.RegisterClusterHandlers()
}
