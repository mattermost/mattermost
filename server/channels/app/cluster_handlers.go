// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (s *Server) clusterInstallPluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		s.Log().Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().installPluginFromClusterMessage(data.Id)
}

func (s *Server) clusterRemovePluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		s.Log().Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().removePluginFromClusterMessage(data.Id)
}

func (s *Server) clusterPluginEventHandler(msg *model.ClusterMessage) {
	if msg.Props == nil {
		s.Log().Warn("ClusterMessage.Props for plugin event should not be nil")
		return
	}
	pluginID := msg.Props["PluginID"]
	eventID := msg.Props["EventID"]
	if pluginID == "" || eventID == "" {
		s.Log().Warn("Invalid ClusterMessage.Props values for plugin event",
			mlog.String("plugin_id", pluginID),
			mlog.String("event_id", eventID),
		)
		return
	}

	hooks, err := s.Channels().HooksForPlugin(pluginID)
	if err != nil {
		s.Log().Warn("Getting hooks for plugin failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return
	}

	hooks.OnPluginClusterEvent(&plugin.Context{}, model.PluginClusterEvent{
		Id:   eventID,
		Data: msg.Data,
	})
}

// clusterAutomationSignalHandler delivers a signal that the emitting node could
// not, because no subscriber was active there. The claim keeps a single node
// from a set of app nodes starting the flow.
func (s *Server) clusterAutomationSignalHandler(msg *model.ClusterMessage) {
	var event model.AutomationSignalEvent
	if err := json.Unmarshal(msg.Data, &event); err != nil {
		s.Log().Warn("Failed to decode automation signal", mlog.Err(err))
		return
	}
	s.Channels().deliverForwardedAutomationSignal(&event)
}

// registerClusterHandlers registers the cluster message handlers that are handled by the server.
//
// The cluster event handlers are spread across this function and NewLocalCacheLayer.
// Be careful to not have duplicated handlers here and there.
func (s *Server) registerClusterHandlers() {
	s.platform.RegisterClusterMessageHandler(model.ClusterEventInstallPlugin, s.clusterInstallPluginHandler)
	s.platform.RegisterClusterMessageHandler(model.ClusterEventRemovePlugin, s.clusterRemovePluginHandler)
	s.platform.RegisterClusterMessageHandler(model.ClusterEventPluginEvent, s.clusterPluginEventHandler)
	s.platform.RegisterClusterMessageHandler(model.ClusterEventAutomationSignal, s.clusterAutomationSignalHandler)
	s.platform.RegisterClusterMessageHandler(clusterEventInvalidateChannelGuardCache, s.Channels().clusterInvalidateGuardCacheHandler)

	s.platform.RegisterClusterHandlers()
}
