// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (s *Server) clusterInstallPluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		s.Log().Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().installPluginFromData(request.EmptyContext(s.Log()), data)
}

func (s *Server) clusterRemovePluginHandler(msg *model.ClusterMessage) {
	var data model.PluginEventData
	if jsonErr := json.Unmarshal(msg.Data, &data); jsonErr != nil {
		s.Log().Warn("Failed to decode from JSON", mlog.Err(jsonErr))
	}
	s.Channels().removePluginFromData(request.EmptyContext(s.Log()), data)
}

func (s *Server) clusterPluginEventHandler(msg *model.ClusterMessage) {
	env := s.Channels().GetPluginsEnvironment()
	if env == nil {
		return
	}
	if msg.Props == nil {
		s.Log().Warn("ClusterMessage.Props for plugin event should not be nil")
		return
	}
	pluginID := msg.Props["PluginID"]
	eventID := msg.Props["EventID"]
	if pluginID == "" || eventID == "" {
		s.Log().Warn("Invalid ClusterMessage.Props values for plugin event",
			mlog.String("plugin_id", pluginID), mlog.String("event_id", eventID))
		return
	}

	hooks, err := env.HooksForPlugin(pluginID)
	if err != nil {
		s.Log().Warn("Getting hooks for plugin failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
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
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventPublish, s.clusterPublishHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventUpdateStatus, s.clusterUpdateStatusHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateAllCaches, s.clusterInvalidateAllCachesHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelMembersNotifyProps, s.clusterInvalidateCacheForChannelMembersNotifyPropHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelByName, s.clusterInvalidateCacheForChannelByNameHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForUser, s.clusterInvalidateCacheForUserHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForUserTeams, s.clusterInvalidateCacheForUserTeamsHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventBusyStateChanged, s.clusterBusyStateChgHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventClearSessionCacheForUser, s.clusterClearSessionCacheForUserHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventClearSessionCacheForAllUsers, s.clusterClearSessionCacheForAllUsersHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventInstallPlugin, s.clusterInstallPluginHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventRemovePlugin, s.clusterRemovePluginHandler)
	s.Cluster.RegisterClusterMessageHandler(model.ClusterEventPluginEvent, s.clusterPluginEventHandler)
}

func (s *Server) clusterPublishHandler(msg *model.ClusterMessage) {
	event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
	if err != nil {
		s.Log().Warn("Failed to decode event from JSON", mlog.Err(err))
		return
	}
	s.PublishSkipClusterSend(request.EmptyContext(s.Log()), event)
}

func (s *Server) clusterUpdateStatusHandler(msg *model.ClusterMessage) {
	var status model.Status
	if jsonErr := json.Unmarshal(msg.Data, &status); jsonErr != nil {
		s.Log().Warn("Failed to decode status from JSON")
	}
	s.statusCache.Set(status.UserId, status)
}

func (s *Server) clusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	s.InvalidateAllCachesSkipSend(request.EmptyContext(s.Log()))
}

func (s *Server) clusterInvalidateCacheForChannelMembersNotifyPropHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(string(msg.Data))
}

func (s *Server) clusterInvalidateCacheForChannelByNameHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForChannelByNameSkipClusterSend(msg.Props["id"], msg.Props["name"])
}

func (s *Server) clusterInvalidateCacheForUserHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForUserSkipClusterSend(string(msg.Data))
}

func (s *Server) clusterInvalidateCacheForUserTeamsHandler(msg *model.ClusterMessage) {
	s.invalidateWebConnSessionCacheForUser(string(msg.Data))
}

func (s *Server) clearSessionCacheForUserSkipClusterSend(userID string) {
	s.userService.ClearUserSessionCacheLocal(userID)
	s.invalidateWebConnSessionCacheForUser(userID)
}

func (s *Server) clearSessionCacheForAllUsersSkipClusterSend() {
	s.Log().Info("Purging sessions cache")
	s.userService.ClearAllUsersSessionCacheLocal()
}

func (s *Server) clusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	s.clearSessionCacheForUserSkipClusterSend(string(msg.Data))
}

func (s *Server) clusterClearSessionCacheForAllUsersHandler(msg *model.ClusterMessage) {
	s.clearSessionCacheForAllUsersSkipClusterSend()
}

func (s *Server) clusterBusyStateChgHandler(msg *model.ClusterMessage) {
	var sbs model.ServerBusyState
	if jsonErr := json.Unmarshal(msg.Data, &sbs); jsonErr != nil {
		s.Log().Warn("Failed to decode server busy state from JSON", mlog.Err(jsonErr))
	}
	s.serverBusyStateChanged(request.EmptyContext(s.Log()), &sbs)
}

func (s *Server) invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelID string) {
	s.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelID)
}

func (s *Server) invalidateCacheForChannelByNameSkipClusterSend(teamID, name string) {
	if teamID == "" {
		teamID = "dm"
	}

	s.Store.Channel().InvalidateChannelByName(teamID, name)
}

func (s *Server) invalidateCacheForUserSkipClusterSend(userID string) {
	s.Store.Channel().InvalidateAllChannelMembersForUser(userID)
	s.invalidateWebConnSessionCacheForUser(userID)
}

func (s *Server) invalidateWebConnSessionCacheForUser(userID string) {
	hub := s.GetHubForUserId(userID)
	if hub != nil {
		hub.InvalidateUser(userID)
	}
}
