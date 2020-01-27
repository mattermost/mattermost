// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) AddStatusCacheSkipClusterSend(status *model.Status) {
	a.Srv.statusCache.Add(status.UserId, status)
}

func (a *App) AddStatusCache(status *model.Status) {
	a.AddStatusCacheSkipClusterSend(status)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_UPDATE_STATUS,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     status.ToClusterJson(),
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) GetAllStatuses() map[string]*model.Status {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return map[string]*model.Status{}
	}

	userIds := a.Srv.statusCache.Keys()
	statusMap := map[string]*model.Status{}

	for _, userId := range userIds {
		status := a.GetStatusFromCache(userId)
		if status != nil {
			statusMap[userId] = status
		}
	}

	return statusMap
}

func (a *App) GetStatusesByIds(userIds []string) (map[string]interface{}, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return map[string]interface{}{}, nil
	}

	statusMap := map[string]interface{}{}
	metrics := a.Metrics

	missingUserIds := []string{}
	for _, userId := range userIds {
		if result, ok := a.Srv.statusCache.Get(userId); ok {
			statusMap[userId] = result.(*model.Status).Status
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter("Status")
			}
		} else {
			missingUserIds = append(missingUserIds, userId)
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Status")
			}
		}
	}

	if len(missingUserIds) > 0 {
		statuses, err := a.Srv.Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, err
		}

		for _, s := range statuses {
			a.AddStatusCacheSkipClusterSend(s)
			statusMap[s.UserId] = s.Status
		}

	}

	// For the case where the user does not have a row in the Status table and cache
	for _, userId := range missingUserIds {
		if _, ok := statusMap[userId]; !ok {
			statusMap[userId] = model.STATUS_OFFLINE
		}
	}

	return statusMap, nil
}

//GetUserStatusesByIds used by apiV4
func (a *App) GetUserStatusesByIds(userIds []string) ([]*model.Status, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return []*model.Status{}, nil
	}

	var statusMap []*model.Status
	metrics := a.Metrics

	missingUserIds := []string{}
	for _, userId := range userIds {
		if result, ok := a.Srv.statusCache.Get(userId); ok {
			statusMap = append(statusMap, result.(*model.Status))
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter("Status")
			}
		} else {
			missingUserIds = append(missingUserIds, userId)
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Status")
			}
		}
	}

	if len(missingUserIds) > 0 {
		statuses, err := a.Srv.Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, err
		}

		for _, s := range statuses {
			a.AddStatusCacheSkipClusterSend(s)
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
	for _, userId := range missingUserIds {
		statusMap = append(statusMap, &model.Status{UserId: userId, Status: "offline"})
	}

	return statusMap, nil
}

// SetStatusLastActivityAt sets the last activity at for a user on the local app server and updates
// status to away if needed. Used by the WS to set status to away if an 'online' device disconnects
// while an 'away' device is still connected
func (a *App) SetStatusLastActivityAt(userId string, activityAt int64) {
	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(userId); err != nil {
		return
	}

	status.LastActivityAt = activityAt

	a.AddStatusCacheSkipClusterSend(status)
	a.SetStatusAwayIfNeeded(userId, false)
}

func (a *App) SetStatusOnline(userId string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	broadcast := false

	var oldStatus string = model.STATUS_OFFLINE
	var oldTime int64
	var oldManual bool
	var status *model.Status
	var err *model.AppError

	if status, err = a.GetStatus(userId); err != nil {
		status = &model.Status{UserId: userId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
		broadcast = true
	} else {
		if status.Manual && !manual {
			return // manually set status always overrides non-manual one
		}

		if status.Status != model.STATUS_ONLINE {
			broadcast = true
		}

		oldStatus = status.Status
		oldTime = status.LastActivityAt
		oldManual = status.Manual

		status.Status = model.STATUS_ONLINE
		status.Manual = false // for "online" there's no manual setting
		status.LastActivityAt = model.GetMillis()
	}

	a.AddStatusCache(status)

	// Only update the database if the status has changed, the status has been manually set,
	// or enough time has passed since the previous action
	if status.Status != oldStatus || status.Manual != oldManual || status.LastActivityAt-oldTime > model.STATUS_MIN_UPDATE_TIME {
		if broadcast {
			if err := a.Srv.Store.Status().SaveOrUpdate(status); err != nil {
				mlog.Error("Failed to save status", mlog.String("user_id", userId), mlog.Err(err), mlog.String("user_id", userId))
			}
		} else {
			if err := a.Srv.Store.Status().UpdateLastActivityAt(status.UserId, status.LastActivityAt); err != nil {
				mlog.Error("Failed to save status", mlog.String("user_id", userId), mlog.Err(err), mlog.String("user_id", userId))
			}
		}
	}

	if broadcast {
		a.BroadcastStatus(status)
	}
}

func (a *App) BroadcastStatus(status *model.Status) {
	if a.Srv.Busy.IsBusy() {
		// this is considered a non-critical service and will be disabled when server busy.
		return
	}
	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_STATUS_CHANGE, "", "", status.UserId, nil)
	event.Add("status", status.Status)
	event.Add("user_id", status.UserId)
	a.Publish(event)
}

func (a *App) SetStatusOffline(userId string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userId)
	if err == nil && status.Manual && !manual {
		return // manually set status always overrides non-manual one
	}

	status = &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: manual, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	a.SaveAndBroadcastStatus(status)
}

func (a *App) SetStatusAwayIfNeeded(userId string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userId)

	if err != nil {
		status = &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: manual, LastActivityAt: 0, ActiveChannel: ""}
	}

	if !manual && status.Manual {
		return // manually set status always overrides non-manual one
	}

	if !manual {
		if status.Status == model.STATUS_AWAY {
			return
		}

		if !a.IsUserAway(status.LastActivityAt) {
			return
		}
	}

	status.Status = model.STATUS_AWAY
	status.Manual = manual
	status.ActiveChannel = ""

	a.SaveAndBroadcastStatus(status)
}

func (a *App) SetStatusDoNotDisturb(userId string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userId)

	if err != nil {
		status = &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.STATUS_DND
	status.Manual = true

	a.SaveAndBroadcastStatus(status)
}

func (a *App) SaveAndBroadcastStatus(status *model.Status) {
	a.AddStatusCache(status)

	if err := a.Srv.Store.Status().SaveOrUpdate(status); err != nil {
		mlog.Error("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}

	a.BroadcastStatus(status)
}

func (a *App) SetStatusOutOfOffice(userId string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userId)

	if err != nil {
		status = &model.Status{UserId: userId, Status: model.STATUS_OUT_OF_OFFICE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.STATUS_OUT_OF_OFFICE
	status.Manual = true

	a.SaveAndBroadcastStatus(status)
}

func (a *App) GetStatusFromCache(userId string) *model.Status {
	if result, ok := a.Srv.statusCache.Get(userId); ok {
		status := result.(*model.Status)
		statusCopy := &model.Status{}
		*statusCopy = *status
		return statusCopy
	}

	return nil
}

func (a *App) GetStatus(userId string) (*model.Status, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return &model.Status{}, nil
	}

	status := a.GetStatusFromCache(userId)
	if status != nil {
		return status, nil
	}

	return a.Srv.Store.Status().Get(userId)
}

func (a *App) IsUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *a.Config().TeamSettings.UserStatusAwayTimeout*1000
}
