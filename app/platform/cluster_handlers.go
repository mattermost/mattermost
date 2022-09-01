// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// nolint: unused
package platform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime/debug"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// ClusterHandlersPreCheck checks whether the platform service is ready to handle cluster messages.
func (ps *PlatformService) ClusterHandlersPreCheck() error {
	if ps.store == nil {
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

func (ps *PlatformService) clearSessionCacheForUserSkipClusterSend(userID string) {
	ps.ClearUserSessionCacheLocal(userID)
	ps.invalidateWebConnSessionCacheForUser(userID)
}

func (ps *PlatformService) clearSessionCacheForAllUsersSkipClusterSend() {
	mlog.Info("Purging sessions cache")
	ps.ClearAllUsersSessionCacheLocal()
}

func (ps *PlatformService) clusterClearSessionCacheForUserHandler(msg *model.ClusterMessage) {
	ps.clearSessionCacheForUserSkipClusterSend(string(msg.Data))
}

func (ps *PlatformService) clusterClearSessionCacheForAllUsersHandler(msg *model.ClusterMessage) {
	ps.clearSessionCacheForAllUsersSkipClusterSend()
}

func (ps *PlatformService) clusterBusyStateChgHandler(msg *model.ClusterMessage) {
	var sbs model.ServerBusyState
	if jsonErr := json.Unmarshal(msg.Data, &sbs); jsonErr != nil {
		mlog.Warn("Failed to decode server busy state from JSON", mlog.Err(jsonErr))
	}

	// TODO: platform: add busy state
	// ps.serverBusyStateChanged(&sbs)
}

func (ps *PlatformService) invalidateCacheForChannelMembersNotifyPropsSkipClusterSend(channelID string) {
	ps.store.Channel().InvalidateCacheForChannelMembersNotifyProps(channelID)
}

func (ps *PlatformService) invalidateCacheForChannelByNameSkipClusterSend(teamID, name string) {
	if teamID == "" {
		teamID = "dm"
	}

	ps.store.Channel().InvalidateChannelByName(teamID, name)
}

func (ps *PlatformService) InvalidateCacheForUserSkipClusterSend(userID string) {
	ps.store.Channel().InvalidateAllChannelMembersForUser(userID)
	ps.invalidateWebConnSessionCacheForUser(userID)
}

func (ps *PlatformService) invalidateWebConnSessionCacheForUser(userID string) {
	hub := ps.GetHubForUserId(userID)
	if hub != nil {
		hub.InvalidateUser(userID)
	}
}

func (ps *PlatformService) InvalidateAllCachesSkipSend() {
	mlog.Info("Purging all caches")
	ps.ClearAllUsersSessionCacheLocal()
	ps.statusCache.Purge()
	ps.store.Team().ClearCaches()
	ps.store.Channel().ClearCaches()
	ps.store.User().ClearCaches()
	ps.store.Post().ClearCaches()
	ps.store.FileInfo().ClearCaches()
	ps.store.Webhook().ClearCaches()

	// TODO: platform: license and link cache
	//linkCache.Purge()
	//ps.LoadLicense()
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
