// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (a *App) AddStatusCacheSkipClusterSend(status *model.Status) {
	a.Srv().statusCache.Set(status.UserId, status)
}

func (a *App) AddStatusCache(status *model.Status) {
	a.AddStatusCacheSkipClusterSend(status)

	if a.Cluster() != nil {
		statusJSON, err := json.Marshal(status)
		if err != nil {
			a.Log().Warn("Failed to encode status to JSON", mlog.Err(err))
		}
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventUpdateStatus,
			SendType: model.ClusterSendBestEffort,
			Data:     statusJSON,
		}
		a.Cluster().SendClusterMessage(msg)
	}
}

func (a *App) GetAllStatuses() map[string]*model.Status {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return map[string]*model.Status{}
	}

	statusMap := map[string]*model.Status{}
	if userIDs, err := a.Srv().statusCache.Keys(); err == nil {
		for _, userID := range userIDs {
			status := a.GetStatusFromCache(userID)
			if status != nil {
				statusMap[userID] = status
			}
		}
	}
	return statusMap
}

func (a *App) GetStatusesByIds(userIDs []string) (map[string]any, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return map[string]any{}, nil
	}

	statusMap := map[string]any{}
	metrics := a.Metrics()

	missingUserIds := []string{}
	for _, userID := range userIDs {
		var status *model.Status
		if err := a.Srv().statusCache.Get(userID, &status); err == nil {
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
		statuses, err := a.Srv().Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, model.NewAppError("GetStatusesByIds", "app.status.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, s := range statuses {
			a.AddStatusCacheSkipClusterSend(s)
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
func (a *App) GetUserStatusesByIds(userIDs []string) ([]*model.Status, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return []*model.Status{}, nil
	}

	var statusMap []*model.Status
	metrics := a.Metrics()

	missingUserIds := []string{}
	for _, userID := range userIDs {
		var status *model.Status
		if err := a.Srv().statusCache.Get(userID, &status); err == nil {
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
		statuses, err := a.Srv().Store.Status().GetByIds(missingUserIds)
		if err != nil {
			return nil, model.NewAppError("GetUserStatusesByIds", "app.status.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
	for _, userID := range missingUserIds {
		statusMap = append(statusMap, &model.Status{UserId: userID, Status: "offline"})
	}

	return statusMap, nil
}

// SetStatusLastActivityAt sets the last activity at for a user on the local app server and updates
// status to away if needed. Used by the WS to set status to away if an 'online' device disconnects
// while an 'away' device is still connected
func (a *App) SetStatusLastActivityAt(c request.CTX, userID string, activityAt int64) {
	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(userID); err != nil {
		return
	}

	status.LastActivityAt = activityAt

	a.AddStatusCacheSkipClusterSend(status)
	a.SetStatusAwayIfNeeded(c, userID, false)
}

func (a *App) SetStatusOnline(c request.CTX, userID string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	broadcast := false

	var oldStatus string = model.StatusOffline
	var oldTime int64
	var oldManual bool
	var status *model.Status
	var err *model.AppError

	if status, err = a.GetStatus(userID); err != nil {
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

	a.AddStatusCache(status)

	// Only update the database if the status has changed, the status has been manually set,
	// or enough time has passed since the previous action
	if status.Status != oldStatus || status.Manual != oldManual || status.LastActivityAt-oldTime > model.StatusMinUpdateTime {
		if broadcast {
			if err := a.Srv().Store.Status().SaveOrUpdate(status); err != nil {
				c.Logger().Warn("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		} else {
			if err := a.Srv().Store.Status().UpdateLastActivityAt(status.UserId, status.LastActivityAt); err != nil {
				c.Logger().Error("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		}
	}

	if broadcast {
		a.BroadcastStatus(c, status)
	}
}

func (a *App) BroadcastStatus(c request.CTX, status *model.Status) {
	if a.Srv().Busy.IsBusy() {
		// this is considered a non-critical service and will be disabled when server busy.
		return
	}
	event := model.NewWebSocketEvent(model.WebsocketEventStatusChange, "", "", status.UserId, nil, "")
	event.Add("status", status.Status)
	event.Add("user_id", status.UserId)
	a.Publish(c, event)
}

func (a *App) SetStatusOffline(c request.CTX, userID string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)
	if err == nil && status.Manual && !manual {
		return // manually set status always overrides non-manual one
	}

	status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	a.SaveAndBroadcastStatus(c, status)
}

func (a *App) SetStatusAwayIfNeeded(c request.CTX, userID string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)

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

		if !a.IsUserAway(status.LastActivityAt) {
			return
		}
	}

	status.Status = model.StatusAway
	status.Manual = manual
	status.ActiveChannel = ""

	a.SaveAndBroadcastStatus(c, status)
}

// SetStatusDoNotDisturbTimed takes endtime in unix epoch format in UTC
// and sets status of given userId to dnd which will be restored back after endtime
func (a *App) SetStatusDoNotDisturbTimed(c request.CTX, userId string, endtime int64) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userId)

	if err != nil {
		status = &model.Status{UserId: userId, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.PrevStatus = status.Status
	status.Status = model.StatusDnd
	status.Manual = true

	status.DNDEndTime = endtime

	a.SaveAndBroadcastStatus(c, status)
}

func (a *App) SetStatusDoNotDisturb(c request.CTX, userID string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusDnd
	status.Manual = true

	a.SaveAndBroadcastStatus(c, status)
}

func (a *App) SaveAndBroadcastStatus(c request.CTX, status *model.Status) {
	a.AddStatusCache(status)

	if err := a.Srv().Store.Status().SaveOrUpdate(status); err != nil {
		c.Logger().Warn("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}

	a.BroadcastStatus(c, status)
}

func (a *App) SetStatusOutOfOffice(c request.CTX, userID string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOutOfOffice, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusOutOfOffice
	status.Manual = true

	a.SaveAndBroadcastStatus(c, status)
}

func (a *App) GetStatusFromCache(userID string) *model.Status {
	var status *model.Status
	if err := a.Srv().statusCache.Get(userID, &status); err == nil {
		statusCopy := &model.Status{}
		*statusCopy = *status
		return statusCopy
	}

	return nil
}

func (a *App) GetStatus(userID string) (*model.Status, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return &model.Status{}, nil
	}

	status := a.GetStatusFromCache(userID)
	if status != nil {
		return status, nil
	}

	status, err := a.Srv().Store.Status().Get(userID)
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

func (a *App) IsUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *a.Config().TeamSettings.UserStatusAwayTimeout*1000
}

// UpdateDNDStatusOfUsers is a recurring task which is started when server starts
// which unsets dnd status of users if needed and saves and broadcasts it
func (a *App) UpdateDNDStatusOfUsers(c request.CTX) {
	statuses, err := a.UpdateExpiredDNDStatuses()
	if err != nil {
		c.Logger().Warn("Failed to fetch dnd statues from store", mlog.String("err", err.Error()))
		return
	}
	for i := range statuses {
		a.AddStatusCache(statuses[i])
		a.BroadcastStatus(c, statuses[i])
	}
}

func (a *App) SetCustomStatus(c request.CTX, userID string, cs *model.CustomStatus) *model.AppError {
	if cs == nil || (cs.Emoji == "" && cs.Text == "") {
		return model.NewAppError("SetCustomStatus", "api.custom_status.set_custom_statuses.update.app_error", nil, "", http.StatusBadRequest)
	}

	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	user.SetCustomStatus(cs)
	_, updateErr := a.UpdateUser(c, user, true)
	if updateErr != nil {
		return updateErr
	}

	if err := a.addRecentCustomStatus(userID, cs); err != nil {
		c.Logger().Error("Can't add recent custom status for", mlog.String("userID", userID), mlog.Err(err))
	}

	return nil
}

func (a *App) RemoveCustomStatus(c request.CTX, userID string) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	user.ClearCustomStatus()
	_, updateErr := a.UpdateUser(c, user, true)
	if updateErr != nil {
		return updateErr
	}

	return nil
}

func (a *App) GetCustomStatus(userID string) (*model.CustomStatus, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		return &model.CustomStatus{}, err
	}

	return user.GetCustomStatus(), nil
}

func (a *App) addRecentCustomStatus(userID string, status *model.CustomStatus) *model.AppError {
	var newRCS model.RecentCustomStatuses

	pref, appErr := a.GetPreferenceByCategoryAndNameForUser(userID, model.PreferenceCategoryCustomStatus, model.PreferenceNameRecentCustomStatuses)
	if appErr != nil || pref.Value == "" {
		newRCS = model.RecentCustomStatuses{*status}
	} else {
		var existingRCS model.RecentCustomStatuses
		if err := json.Unmarshal([]byte(pref.Value), &existingRCS); err != nil {
			return model.NewAppError("addRecentCustomStatus", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		newRCS = existingRCS.Add(status)
	}

	newRCSJSON, err := json.Marshal(newRCS)
	if err != nil {
		return model.NewAppError("addRecentCustomStatus", "api.marshal_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	pref = &model.Preference{
		UserId:   userID,
		Category: model.PreferenceCategoryCustomStatus,
		Name:     model.PreferenceNameRecentCustomStatuses,
		Value:    string(newRCSJSON),
	}
	if appErr := a.UpdatePreferences(userID, model.Preferences{*pref}); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) RemoveRecentCustomStatus(userID string, status *model.CustomStatus) *model.AppError {
	pref, appErr := a.GetPreferenceByCategoryAndNameForUser(userID, model.PreferenceCategoryCustomStatus, model.PreferenceNameRecentCustomStatuses)
	if appErr != nil {
		return appErr
	}

	if pref.Value == "" {
		return model.NewAppError("RemoveRecentCustomStatus", "api.custom_status.recent_custom_statuses.delete.app_error", nil, "", http.StatusBadRequest)
	}

	var existingRCS model.RecentCustomStatuses
	if err := json.Unmarshal([]byte(pref.Value), &existingRCS); err != nil {
		return model.NewAppError("RemoveRecentCustomStatus", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if ok, err := existingRCS.Contains(status); !ok || err != nil {
		return model.NewAppError("RemoveRecentCustomStatus", "api.custom_status.recent_custom_statuses.delete.app_error", nil, "", http.StatusBadRequest)
	}

	newRCS, err := existingRCS.Remove(status)
	if err != nil {
		return model.NewAppError("RemoveRecentCustomStatus", "api.custom_status.recent_custom_statuses.delete.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	newRCSJSON, err := json.Marshal(newRCS)
	if err != nil {
		return model.NewAppError("RemoveRecentCustomStatus", "api.marshal_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	pref.Value = string(newRCSJSON)
	if appErr := a.UpdatePreferences(userID, model.Preferences{*pref}); appErr != nil {
		return appErr
	}

	return nil
}
