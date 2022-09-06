// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (ps *PlatformService) AddStatusCacheSkipClusterSend(status *model.Status) {
	ps.statusCache.Set(status.UserId, status)
}

func (ps *PlatformService) AddStatusCache(status *model.Status) {
	ps.AddStatusCacheSkipClusterSend(status)

	if ps.Cluster() != nil {
		statusJSON, err := json.Marshal(status)
		if err != nil {
			ps.logger.Warn("Failed to encode status to JSON", mlog.Err(err))
		}
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventUpdateStatus,
			SendType: model.ClusterSendBestEffort,
			Data:     statusJSON,
		}
		ps.Cluster().SendClusterMessage(msg)
	}
}

func (ps *PlatformService) GetAllStatuses() map[string]*model.Status {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return map[string]*model.Status{}
	}

	statusMap := map[string]*model.Status{}
	if userIDs, err := ps.statusCache.Keys(); err == nil {
		for _, userID := range userIDs {
			status := ps.GetStatusFromCache(userID)
			if status != nil {
				statusMap[userID] = status
			}
		}
	}
	return statusMap
}

func (ps *PlatformService) GetStatusesByIds(userIDs []string) (map[string]any, *model.AppError) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return map[string]any{}, nil
	}

	statusMap := map[string]any{}
	metrics := ps.Metrics()

	missingUserIds := []string{}
	for _, userID := range userIDs {
		var status *model.Status
		if err := ps.statusCache.Get(userID, &status); err == nil {
			statusMap[userID] = status.Status
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter("Status")
			}
		} else {
			missingUserIds = append(missingUserIds, userID)
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Status")
			}
		}
	}

	if len(missingUserIds) > 0 {
		statuses, err := ps.Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, model.NewAppError("GetStatusesByIds", "app.status.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, s := range statuses {
			ps.AddStatusCacheSkipClusterSend(s)
			statusMap[s.UserId] = s.Status
		}

	}

	// For the case where the user does not have a row in the Status table and cache
	for _, userID := range missingUserIds {
		if _, ok := statusMap[userID]; !ok {
			statusMap[userID] = model.StatusOffline
		}
	}

	return statusMap, nil
}

// GetUserStatusesByIds used by apiV4
func (ps *PlatformService) GetUserStatusesByIds(userIDs []string) ([]*model.Status, *model.AppError) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return []*model.Status{}, nil
	}

	var statusMap []*model.Status
	metrics := ps.Metrics()

	missingUserIds := []string{}
	for _, userID := range userIDs {
		var status *model.Status
		if err := ps.statusCache.Get(userID, &status); err == nil {
			statusMap = append(statusMap, status)
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter("Status")
			}
		} else {
			missingUserIds = append(missingUserIds, userID)
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Status")
			}
		}
	}

	if len(missingUserIds) > 0 {
		statuses, err := ps.Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, model.NewAppError("GetUserStatusesByIds", "app.status.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, s := range statuses {
			ps.AddStatusCacheSkipClusterSend(s)
		}

		statusMap = append(statusMap, statuses...)

	}

	// For the case where the user does not have a row in the Status table and cache
	// remove the existing ids from missingUserIds and then create a offline state for the missing ones
	// This also return the status offline for the non-existing Ids in the system
	for i := 0; i < len(missingUserIds); i++ {
		missingUserId := missingUserIds[i]
		for _, userMap := range statusMap {
			if missingUserId == userMap.UserId {
				missingUserIds = append(missingUserIds[:i], missingUserIds[i+1:]...)
				i--
				break
			}
		}
	}
	for _, userID := range missingUserIds {
		statusMap = append(statusMap, &model.Status{UserId: userID, Status: "offline"})
	}

	return statusMap, nil
}

func (ps *PlatformService) BroadcastStatus(status *model.Status) {
	if ps.Busy.IsBusy() {
		// this is considered a non-critical service and will be disabled when server busy.
		return
	}
	event := model.NewWebSocketEvent(model.WebsocketEventStatusChange, "", "", status.UserId, nil, "")
	event.Add("status", status.Status)
	event.Add("user_id", status.UserId)
	ps.Publish(event)
}

func (ps *PlatformService) SaveAndBroadcastStatus(status *model.Status) {
	ps.AddStatusCache(status)

	if err := ps.Store.Status().SaveOrUpdate(status); err != nil {
		mlog.Warn("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}

	ps.BroadcastStatus(status)
}

func (ps *PlatformService) GetStatusFromCache(userID string) *model.Status {
	var status *model.Status
	if err := ps.statusCache.Get(userID, &status); err == nil {
		statusCopy := &model.Status{}
		*statusCopy = *status
		return statusCopy
	}

	return nil
}

func (ps *PlatformService) GetStatus(userID string) (*model.Status, *model.AppError) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return &model.Status{}, nil
	}

	status := ps.GetStatusFromCache(userID)
	if status != nil {
		return status, nil
	}

	status, err := ps.Store.Status().Get(userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetStatus", "app.status.get.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetStatus", "app.status.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return status, nil
}
