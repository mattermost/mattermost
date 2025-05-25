// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

func (ps *PlatformService) AddStatusCacheSkipClusterSend(status *model.Status) {
	if err := ps.statusCache.SetWithDefaultExpiry(status.UserId, status); err != nil {
		ps.logger.Warn("Failed to set cache entry for status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}
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
	err := ps.statusCache.Scan(func(keys []string) error {
		if len(keys) == 0 {
			return nil
		}

		toPass := allocateCacheTargets[*model.Status](len(keys))
		errs := ps.statusCache.GetMulti(keys, toPass)
		for i, err := range errs {
			if err != nil {
				if err != cache.ErrKeyNotFound {
					return err
				}
				continue
			}
			gotStatus := *(toPass[i].(**model.Status))
			if gotStatus != nil {
				statusMap[keys[i]] = gotStatus
				continue
			}
			ps.logger.Warn("Found nil status in GetAllStatuses. This is not expected")
		}
		return nil
	})
	if err != nil {
		ps.logger.Warn("Error while getting all status in GetAllStatuses", mlog.Err(err))
		return nil
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

	toPass := allocateCacheTargets[*model.Status](len(userIDs))
	// First, we do a GetMulti to get all the status objects.
	errs := ps.statusCache.GetMulti(userIDs, toPass)
	for i, err := range errs {
		if err != nil {
			if err != cache.ErrKeyNotFound {
				ps.logger.Warn("Error in GetStatusesByIds: ", mlog.Err(err))
			}
			missingUserIds = append(missingUserIds, userIDs[i])
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter(ps.statusCache.Name())
			}
		} else {
			// If we get a hit, we need to cast it back to the right type.
			gotStatus := *(toPass[i].(**model.Status))
			if gotStatus == nil {
				ps.logger.Warn("Found nil in GetStatusesByIds. This is not expected")
				continue
			}
			statusMap[userIDs[i]] = gotStatus.Status
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter(ps.statusCache.Name())
			}
		}
	}

	if len(missingUserIds) > 0 {
		// For cache misses, we fill them back from the DB.
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
	toPass := allocateCacheTargets[*model.Status](len(userIDs))
	// First, we do a GetMulti to get all the status objects.
	errs := ps.statusCache.GetMulti(userIDs, toPass)
	for i, err := range errs {
		if err != nil {
			if err != cache.ErrKeyNotFound {
				ps.logger.Warn("Error in GetUserStatusesByIds: ", mlog.Err(err))
			}
			missingUserIds = append(missingUserIds, userIDs[i])
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter(ps.statusCache.Name())
			}
		} else {
			// If we get a hit, we need to cast it back to the right type.
			gotStatus := *(toPass[i].(**model.Status))
			if gotStatus == nil {
				ps.logger.Warn("Found nil in GetUserStatusesByIds. This is not expected")
				continue
			}
			statusMap = append(statusMap, gotStatus)
			if metrics != nil {
				metrics.IncrementMemCacheHitCounter(ps.statusCache.Name())
			}
		}
	}

	if len(missingUserIds) > 0 {
		// For cache misses, we fill them back from the DB.
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
		return status
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

// SetStatusLastActivityAt sets the last activity at for a user on the local app server and updates
// status to away if needed. Used by the WS to set status to away if an 'online' device disconnects
// while an 'away' device is still connected
func (ps *PlatformService) SetStatusLastActivityAt(userID string, activityAt int64) {
	var status *model.Status
	var err *model.AppError
	if status, err = ps.GetStatus(userID); err != nil {
		return
	}

	status.LastActivityAt = activityAt

	ps.AddStatusCacheSkipClusterSend(status)
	ps.SetStatusAwayIfNeeded(userID, false)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

func (ps *PlatformService) UpdateLastActivityAtIfNeeded(session model.Session) {
	now := model.GetMillis()

	ps.UpdateWebConnUserActivity(session, now)

	if now-session.LastActivityAt < model.SessionActivityTimeout {
		return
	}

	if err := ps.Store.Session().UpdateLastActivityAt(session.Id, now); err != nil {
		mlog.Warn("Failed to update LastActivityAt", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
	}

	session.LastActivityAt = now
	if err := ps.AddSessionToCache(&session); err != nil {
		mlog.Warn("Failed to add session to cache", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
	}
}

func (ps *PlatformService) SetStatusOnline(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	broadcast := false

	var oldStatus string = model.StatusOffline
	var oldTime int64
	var oldManual bool
	var status *model.Status
	var err *model.AppError

	if status, err = ps.GetStatus(userID); err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
		broadcast = true
	} else {
		if status.Manual && !manual {
			return // manually set status always overrides non-manual one
		}

		if status.Status != model.StatusOnline {
			broadcast = true
		}

		oldStatus = status.Status
		oldTime = status.LastActivityAt
		oldManual = status.Manual

		status.Status = model.StatusOnline
		status.Manual = false // for "online" there's no manual setting
		status.LastActivityAt = model.GetMillis()
	}

	ps.AddStatusCache(status)

	// Only update the database if the status has changed, the status has been manually set,
	// or enough time has passed since the previous action
	if status.Status != oldStatus || status.Manual != oldManual || status.LastActivityAt-oldTime > model.StatusMinUpdateTime {
		if broadcast {
			if err := ps.Store.Status().SaveOrUpdate(status); err != nil {
				mlog.Warn("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		} else {
			if err := ps.Store.Status().UpdateLastActivityAt(status.UserId, status.LastActivityAt); err != nil {
				mlog.Error("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		}
		if ps.sharedChannelService != nil {
			ps.sharedChannelService.NotifyUserStatusChanged(status)
		}
	}

	if broadcast {
		ps.BroadcastStatus(status)
	}
}

func (ps *PlatformService) SetStatusOffline(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)
	if err == nil && status.Manual && !manual {
		return // manually set status always overrides non-manual one
	}

	status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

func (ps *PlatformService) SetStatusAwayIfNeeded(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: 0, ActiveChannel: ""}
	}

	if !manual && status.Manual {
		return // manually set status always overrides non-manual one
	}

	if !manual {
		if status.Status == model.StatusAway {
			return
		}

		if !ps.isUserAway(status.LastActivityAt) {
			return
		}
	}

	status.Status = model.StatusAway
	status.Manual = manual
	status.ActiveChannel = ""

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

// SetStatusDoNotDisturbTimed takes endtime in unix epoch format in UTC
// and sets status of given userId to dnd which will be restored back after endtime
func (ps *PlatformService) SetStatusDoNotDisturbTimed(userID string, endtime int64) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.PrevStatus = status.Status
	status.Status = model.StatusDnd
	status.Manual = true

	status.DNDEndTime = truncateDNDEndTime(endtime)

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

// truncateDNDEndTime takes a user-provided timestamp (in seconds) for when their DND expiry should end and truncates
// it to line up with the DND expiry job so that the user's DND time doesn't expire late by an interval. The job to
// expire statuses runs every minute currently, so this trims the seconds and milliseconds off the given timestamp.
//
// This will result in statuses expiring slightly earlier than specified in the UI, but the status will expire at
// the correct time on the wall clock. For example, if the time is currently 13:04:29 and the user sets the expiry to
// 5 minutes, truncating will make the status will expire at 13:09:00 instead of at 13:10:00.
//
// Note that the timestamps used by this are in seconds, not milliseconds. This matches UserStatus.DNDEndTime.
func truncateDNDEndTime(endtime int64) int64 {
	return time.Unix(endtime, 0).Truncate(model.DNDExpiryInterval).Unix()
}

func (ps *PlatformService) SetStatusDoNotDisturb(userID string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusDnd
	status.Manual = true

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

func (ps *PlatformService) SetStatusOutOfOffice(userID string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOutOfOffice, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusOutOfOffice
	status.Manual = true

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

func (ps *PlatformService) isUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *ps.Config().TeamSettings.UserStatusAwayTimeout*1000
}
