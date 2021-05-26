// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func (s *Server) clusterInstallPluginHandler(msg *model.ClusterMessage) {
	s.installPluginFromData(model.PluginEventDataFromJson(strings.NewReader(msg.Data)))
}

func (s *Server) clusterRemovePluginHandler(msg *model.ClusterMessage) {
	s.removePluginFromData(model.PluginEventDataFromJson(strings.NewReader(msg.Data)))
}

func (s *Server) clusterPluginEventHandler(msg *model.ClusterMessage) {
	env := s.GetPluginsEnvironment()
	if env == nil {
		return
	}
	if msg.Props == nil {
		mlog.Warn("ClusterMessage.Props for plugin event should not be nil")
		return
	}
	pluginID := msg.Props["PluginID"]
	eventID := msg.Props["EventID"]
	if pluginID == "" || eventID == "" {
		mlog.Warn("Invalid ClusterMessage.Props values for plugin event",
			mlog.String("plugin_id", pluginID), mlog.String("event_id", eventID))
		return
	}

	hooks, err := env.HooksForPlugin(pluginID)
	if err != nil {
		mlog.Warn("Getting hooks for plugin failed", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return
	}

	hooks.OnPluginClusterEvent(&plugin.Context{}, model.PluginClusterEvent{
		Id:   eventID,
		Data: []byte(msg.Data),
	})
}

// registerClusterHandlers registers the cluster message handlers that are handled by the server.
//
// The cluster event handlers are spread across this function and NewLocalCacheLayer.
// Be careful to not have duplicated handlers here and there.
func (s *Server) registerClusterHandlers() {
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_PUBLISH, s.clusterPublishHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_UPDATE_STATUS, s.clusterUpdateStatusHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES, s.clusterInvalidateAllCachesHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS, s.clusterInvalidateCacheForChannelMembersNotifyPropHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME, s.clusterInvalidateCacheForChannelByNameHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER, s.clusterInvalidateCacheForUserHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS, s.clusterInvalidateCacheForUserTeamsHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_BUSY_STATE_CHANGED, s.clusterBusyStateChgHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER, s.clusterClearSessionCacheForUserHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_ALL_USERS, s.clusterClearSessionCacheForAllUsersHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INSTALL_PLUGIN, s.clusterInstallPluginHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_REMOVE_PLUGIN, s.clusterRemovePluginHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_PLUGIN_EVENT, s.clusterPluginEventHandler)
}

func (s *Server) clusterPublishHandler(msg *model.ClusterMessage) {
	event := model.WebSocketEventFromJson(strings.NewReader(msg.Data))
	if event == nil {
		return
	}
	s.PublishSkipClusterSend(event)
}

func (s *Server) clusterUpdateStatusHandler(msg *model.ClusterMessage) {
	status := model.StatusFromJson(strings.NewReader(msg.Data))
	s.statusCache.Set(status.UserId, status)
}

func (s *Server) clusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	s.InvalidateAllCachesSkipSend()
}

func (s *Server) clusterInvalidateCacheForChannelMembersNotifyPropHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(msg.Data)
}

func (s *Server) clusterInvalidateCacheForChannelByNameHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForChannelByNameSkipClusterSend(msg.Props["id"], msg.Props["name"])
}

func (s *Server) clusterInvalidateCacheForUserHandler(msg *model.ClusterMessage) {
	s.invalidateCacheForUserSkipClusterSend(msg.Data)
}

func (s *Server) clusterInvalidateCacheForUserTeamsHandler(msg *model.ClusterMessage) {
	s.invalidateWebConnSessionCacheForUser(msg.Data)
}

func (s *Server) clearSessionCacheForUserSkipClusterSend(userID string) {
	if keys, err := s.sessionCache.Keys(); err == nil {
		var session *model.Session
		for _, key := range keys {
			if err := s.sessionCache.Get(key, &session); err == nil {
				if session.UserId == userID {
					s.sessionCache.Remove(key)
					if s.Metrics != nil {
						s.Metrics.IncrementMemCacheInvalidationCounterSession()
					}
				}
			}
		}
	}

	s.invalidateWebConnSessionCacheForUser(userID)
}

func (s *Server) clearSessionCacheForAllUsersSkipClusterSend() {
	mlog.Info("Purging sessions cache")
	s.sessionCache.Purge()
}

func (s *Server) clusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	s.clearSessionCacheForUserSkipClusterSend(msg.Data)
}

func (s *Server) clusterClearSessionCacheForAllUsersHandler(msg *model.ClusterMessage) {
	s.clearSessionCacheForAllUsersSkipClusterSend()
}

func (s *Server) clusterBusyStateChgHandler(msg *model.ClusterMessage) {
	s.serverBusyStateChanged(model.ServerBusyStateFromJson(strings.NewReader(msg.Data)))
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
