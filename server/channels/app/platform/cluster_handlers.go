// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime/debug"

	"github.com/mattermost/mattermost-server/server/v8/channels/einterfaces"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func (ps *PlatformService) RegisterClusterHandlers() {
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventPublish, ps.ClusterPublishHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventUpdateStatus, ps.ClusterUpdateStatusHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateAllCaches, ps.ClusterInvalidateAllCachesHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelMembersNotifyProps, ps.clusterInvalidateCacheForChannelMembersNotifyPropHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelByName, ps.clusterInvalidateCacheForChannelByNameHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForUser, ps.clusterInvalidateCacheForUserHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForUserTeams, ps.clusterInvalidateCacheForUserTeamsHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventBusyStateChanged, ps.clusterBusyStateChgHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventClearSessionCacheForUser, ps.clusterClearSessionCacheForUserHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventClearSessionCacheForAllUsers, ps.clusterClearSessionCacheForAllUsersHandler)

	for e, h := range ps.additionalClusterHandlers {
		ps.clusterIFace.RegisterClusterMessageHandler(e, h)
	}
}

func (ps *PlatformService) RegisterClusterMessageHandler(ev model.ClusterEvent, h einterfaces.ClusterMessageHandler) {
	ps.additionalClusterHandlers[ev] = h
}

// ClusterHandlersPreCheck checks whether the platform service is ready to handle cluster messages.
func (ps *PlatformService) ClusterHandlersPreCheck() error {
	if ps.Store == nil {
		return fmt.Errorf("could not find store")
	}

	if ps.statusCache == nil {
		return fmt.Errorf("could not find status cache")
	}

	return nil
}

func (ps *PlatformService) ClusterPublishHandler(msg *model.ClusterMessage) {
	event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
	if err != nil {
		ps.logger.Warn("Failed to decode event from JSON", mlog.Err(err))
		return
	}

	ps.PublishSkipClusterSend(event)
}

func (ps *PlatformService) ClusterUpdateStatusHandler(msg *model.ClusterMessage) {
	var status model.Status
	if jsonErr := json.Unmarshal(msg.Data, &status); jsonErr != nil {
		ps.logger.Warn("Failed to decode status from JSON")
	}

	ps.statusCache.Set(status.UserId, status)
}

func (ps *PlatformService) ClusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	ps.InvalidateAllCachesSkipSend()
}

func (ps *PlatformService) clusterInvalidateCacheForChannelMembersNotifyPropHandler(msg *model.ClusterMessage) {
	ps.invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(string(msg.Data))
}

func (ps *PlatformService) clusterInvalidateCacheForChannelByNameHandler(msg *model.ClusterMessage) {
	ps.invalidateCacheForChannelByNameSkipClusterSend(msg.Props["id"], msg.Props["name"])
}

func (ps *PlatformService) clusterInvalidateCacheForUserHandler(msg *model.ClusterMessage) {
	ps.InvalidateCacheForUserSkipClusterSend(string(msg.Data))
}

func (ps *PlatformService) clusterInvalidateCacheForUserTeamsHandler(msg *model.ClusterMessage) {
	ps.invalidateWebConnSessionCacheForUser(string(msg.Data))
}

func (ps *PlatformService) ClearSessionCacheForUserSkipClusterSend(userID string) {
	ps.ClearUserSessionCacheLocal(userID)
	ps.invalidateWebConnSessionCacheForUser(userID)
}

func (ps *PlatformService) ClearSessionCacheForAllUsersSkipClusterSend() {
	ps.logger.Info("Purging sessions cache")
	ps.ClearAllUsersSessionCacheLocal()
}

func (ps *PlatformService) clusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	ps.ClearSessionCacheForUserSkipClusterSend(string(msg.Data))
}

func (ps *PlatformService) clusterClearSessionCacheForAllUsersHandler(msg *model.ClusterMessage) {
	ps.ClearSessionCacheForAllUsersSkipClusterSend()
}

func (ps *PlatformService) clusterBusyStateChgHandler(msg *model.ClusterMessage) {
	var sbs model.ServerBusyState
	if jsonErr := json.Unmarshal(msg.Data, &sbs); jsonErr != nil {
		mlog.Warn("Failed to decode server busy state from JSON", mlog.Err(jsonErr))
	}

	ps.Busy.ClusterEventChanged(&sbs)
	if sbs.Busy {
		ps.logger.Warn("server busy state activated via cluster event - non-critical services disabled", mlog.Int64("expires_sec", sbs.Expires))
	} else {
		ps.logger.Info("server busy state cleared via cluster event - non-critical services enabled")
	}
}

func (ps *PlatformService) invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelID string) {
	ps.Store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelID)
}

func (ps *PlatformService) invalidateCacheForChannelByNameSkipClusterSend(teamID, name string) {
	if teamID == "" {
		teamID = "dm"
	}

	ps.Store.Channel().InvalidateChannelByName(teamID, name)
}

func (ps *PlatformService) InvalidateCacheForUserSkipClusterSend(userID string) {
	ps.Store.Channel().InvalidateAllChannelMembersForUser(userID)
	ps.invalidateWebConnSessionCacheForUser(userID)
}

func (ps *PlatformService) invalidateWebConnSessionCacheForUser(userID string) {
	hub := ps.GetHubForUserId(userID)
	if hub != nil {
		hub.InvalidateUser(userID)
	}
}

func (ps *PlatformService) InvalidateAllCachesSkipSend() {
	ps.logger.Info("Purging all caches")
	ps.ClearAllUsersSessionCacheLocal()
	ps.statusCache.Purge()
	ps.Store.Team().ClearCaches()
	ps.Store.Channel().ClearCaches()
	ps.Store.User().ClearCaches()
	ps.Store.Post().ClearCaches()
	ps.Store.FileInfo().ClearCaches()
	ps.Store.Webhook().ClearCaches()

	linkCache.Purge()
	ps.LoadLicense()
}

func (ps *PlatformService) InvalidateAllCaches() *model.AppError {
	debug.FreeOSMemory()
	ps.InvalidateAllCachesSkipSend()

	if ps.clusterIFace != nil {

		msg := &model.ClusterMessage{
			Event:            model.ClusterEventInvalidateAllCaches,
			SendType:         model.ClusterSendReliable,
			WaitForAllToSend: true,
		}

		ps.clusterIFace.SendClusterMessage(msg)
	}

	return nil
}
