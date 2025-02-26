// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

func (ps *PlatformService) RegisterClusterHandlers() {
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventPublish, ps.ClusterPublishHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventUpdateStatus, ps.ClusterUpdateStatusHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateAllCaches, ps.ClusterInvalidateAllCachesHandler)
	ps.clusterIFace.RegisterClusterMessageHandler(model.ClusterEventInvalidateWebConnCacheForUser, ps.clusterInvalidateWebConnSessionCacheForUserHandler)
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
	if err := json.Unmarshal(msg.Data, &status); err != nil {
		ps.logger.Warn("Failed to decode status from JSON", mlog.Err(err))
	}

	if err := ps.statusCache.SetWithDefaultExpiry(status.UserId, status); err != nil {
		ps.logger.Warn("Failed to store the status in the cache", mlog.String("user_id", status.UserId), mlog.Err(err))
	}
}

func (ps *PlatformService) ClusterInvalidateAllCachesHandler(msg *model.ClusterMessage) {
	ps.InvalidateAllCachesSkipSend()
}

func (ps *PlatformService) clusterInvalidateWebConnSessionCacheForUserHandler(msg *model.ClusterMessage) {
	ps.invalidateWebConnSessionCacheForUserSkipClusterSend(string(msg.Data))
}

func (ps *PlatformService) ClearSessionCacheForUserSkipClusterSend(userID string) {
	ps.ClearUserSessionCacheLocal(userID)
	ps.invalidateWebConnSessionCacheForUserSkipClusterSend(userID)
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
	if err := json.Unmarshal(msg.Data, &sbs); err != nil {
		ps.logger.Warn("Failed to decode server busy state from JSON", mlog.Err(err))
	}

	ps.Busy.ClusterEventChanged(&sbs)
	if sbs.Busy {
		ps.logger.Warn("server busy state activated via cluster event - non-critical services disabled", mlog.Int("expires_sec", sbs.Expires))
	} else {
		ps.logger.Info("server busy state cleared via cluster event - non-critical services enabled")
	}
}

func (ps *PlatformService) invalidateWebConnSessionCacheForUserSkipClusterSend(userID string) {
	hub := ps.GetHubForUserId(userID)
	if hub != nil {
		hub.InvalidateUser(userID)
	}
}

func (ps *PlatformService) InvalidateAllCachesSkipSend() {
	ps.logger.Info("Purging all caches")
	ps.ClearAllUsersSessionCacheLocal()
	if err := ps.statusCache.Purge(); err != nil {
		ps.logger.Warn("Failed to clear the status cache", mlog.Err(err))
	}
	ps.Store.Team().ClearCaches()
	ps.Store.Channel().ClearCaches()
	ps.Store.User().ClearCaches()
	ps.Store.Post().ClearCaches()
	ps.Store.FileInfo().ClearCaches()
	ps.Store.Webhook().ClearCaches()

	if err := linkCache.Purge(); err != nil {
		ps.logger.Warn("Failed to clear the link cache", mlog.Err(err))
	}
	ps.LoadLicense()
}

func (ps *PlatformService) InvalidateAllCaches() *model.AppError {
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
