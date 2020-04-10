// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

// Registers a given function to be called when the cluster leader may have changed. Returns a unique ID for the
// listener which can later be used to remove it. If clustering is not enabled in this build, the callback will never
// be called.
func (s *Server) AddClusterLeaderChangedListener(listener func()) string {
	id := model.NewId()
	s.clusterLeaderListeners.Store(id, listener)
	return id
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveClusterLeaderChangedListener(id string) {
	s.clusterLeaderListeners.Delete(id)
}

func (s *Server) InvokeClusterLeaderChangedListeners() {
	s.Log.Info("Cluster leader changed. Invoking ClusterLeaderChanged listeners.")
	s.Go(func() {
		s.clusterLeaderListeners.Range(func(_, listener interface{}) bool {
			listener.(func())()
			return true
		})
	})
}

func (a *App) Publish(message *model.WebSocketEvent) {
	if metrics := a.Metrics(); metrics != nil {
		metrics.IncrementWebsocketEvent(message.EventType())
	}

	a.PublishSkipClusterSend(message)

	if a.Cluster() != nil {
		cm := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_PUBLISH,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     message.ToJson(),
		}

		if message.EventType() == model.WEBSOCKET_EVENT_POSTED ||
			message.EventType() == model.WEBSOCKET_EVENT_POST_EDITED ||
			message.EventType() == model.WEBSOCKET_EVENT_DIRECT_ADDED ||
			message.EventType() == model.WEBSOCKET_EVENT_GROUP_ADDED ||
			message.EventType() == model.WEBSOCKET_EVENT_ADDED_TO_TEAM {
			cm.SendType = model.CLUSTER_SEND_RELIABLE
		}

		a.Cluster().SendClusterMessage(cm)
	}
}

func (a *App) invalidateCacheForChannel(channel *model.Channel) {
	a.Srv().Store.Channel().InvalidateChannel(channel.Id)
	a.invalidateCacheForChannelByNameSkipClusterSend(channel.TeamId, channel.Name)

	if a.Cluster() != nil {
		nameMsg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_BY_NAME,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Props:    make(map[string]string),
		}

		nameMsg.Props["name"] = channel.Name
		if channel.TeamId == "" {
			nameMsg.Props["id"] = "dm"
		} else {
			nameMsg.Props["id"] = channel.TeamId
		}

		a.Cluster().SendClusterMessage(nameMsg)
	}
}

func (a *App) invalidateCacheForChannelMembers(channelId string) {
	a.Srv().Store.User().InvalidateProfilesInChannelCache(channelId)
	a.Srv().Store.Channel().InvalidateMemberCount(channelId)
	a.Srv().Store.Channel().InvalidateGuestCount(channelId)
}

func (a *App) invalidateCacheForChannelMembersNotifyProps(channelId string) {
	a.invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelId)

	if a.Cluster() != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBERS_NOTIFY_PROPS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     channelId,
		}
		a.Cluster().SendClusterMessage(msg)
	}
}

func (a *App) invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelId string) {
	a.Srv().Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelId)
}

func (a *App) invalidateCacheForChannelByNameSkipClusterSend(teamId, name string) {
	if teamId == "" {
		teamId = "dm"
	}

	a.Srv().Store.Channel().InvalidateChannelByName(teamId, name)
}

func (a *App) invalidateCacheForChannelPosts(channelId string) {
	a.Srv().Store.Channel().InvalidatePinnedPostCount(channelId)
	a.Srv().Store.Post().InvalidateLastPostTimeCache(channelId)
}

func (a *App) InvalidateCacheForUser(userId string) {
	a.invalidateCacheForUserSkipClusterSend(userId)

	a.Srv().Store.User().InvalidateProfilesInChannelCacheByUser(userId)
	a.Srv().Store.User().InvalidateProfileCacheForUser(userId)

	if a.Cluster() != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		a.Cluster().SendClusterMessage(msg)
	}
}

func (a *App) invalidateCacheForUserTeams(userId string) {
	a.invalidateCacheForUserTeamsSkipClusterSend(userId)
	a.Srv().Store.Team().InvalidateAllTeamIdsForUser(userId)

	if a.Cluster() != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_USER_TEAMS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		a.Cluster().SendClusterMessage(msg)
	}
}
