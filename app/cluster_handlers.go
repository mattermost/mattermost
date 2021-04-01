// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

// registerAppClusterMessageHandlers registers the cluster message handlers that are handled by the App layer.
//
// The cluster event handlers are spread across this function, Server.registerClusterHandlers and
// NewLocalCacheLayer. Be careful to not have duplicated handlers here and
// there.
func (a *App) registerAppClusterMessageHandlers() {
	a.Cluster().RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER, a.clusterClearSessionCacheForUserHandler)
	a.Cluster().RegisterClusterMessageHandler(model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_ALL_USERS, a.clusterClearSessionCacheForAllUsersHandler)
	a.Cluster().RegisterClusterMessageHandler(model.CLUSTER_EVENT_INSTALL_PLUGIN, a.clusterInstallPluginHandler)
	a.Cluster().RegisterClusterMessageHandler(model.CLUSTER_EVENT_REMOVE_PLUGIN, a.clusterRemovePluginHandler)
}

func (a *App) clusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	a.ClearSessionCacheForUserSkipClusterSend(msg.Data)
}

func (a *App) clusterClearSessionCacheForAllUsersHandler(msg *model.ClusterMessage) {
	a.ClearSessionCacheForAllUsersSkipClusterSend()
}

func (a *App) clusterInstallPluginHandler(msg *model.ClusterMessage) {
	a.InstallPluginFromData(model.PluginEventDataFromJson(strings.NewReader(msg.Data)))
}

func (a *App) clusterRemovePluginHandler(msg *model.ClusterMessage) {
	a.RemovePluginFromData(model.PluginEventDataFromJson(strings.NewReader(msg.Data)))
}

// registerClusterHandlers registers the cluster message handlers that are handled by the server.
func (s *Server) registerClusterHandlers() {
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_PUBLISH, s.clusterPublishHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_UPDATE_STATUS, s.clusterUpdateStatusHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES, s.clusterInvalidateAllCachesHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS, s.clusterInvalidateCacheForChannelMembersNotifyPropHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME, s.clusterInvalidateCacheForChannelByNameHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER, s.clusterInvalidateCacheForUserHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS, s.clusterInvalidateCacheForUserTeamsHandler)
	s.Cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_BUSY_STATE_CHANGED, s.clusterBusyStateChgHandler)
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
