// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// GetUserStatusesByIds used by apiV4
func (a *App) GetUserStatusesByIds(userIDs []string) ([]*model.Status, *model.AppError) {
	return a.Srv().Platform().GetUserStatusesByIds(userIDs)
}

// SetStatusLastActivityAt sets the last activity at for a user on the local app server and updates
// status to away if needed. Used by the WS to set status to away if an 'online' device disconnects
// while an 'away' device is still connected
func (a *App) SetStatusLastActivityAt(userID string, activityAt int64) {
	var status *model.Status
	var err *model.AppError
	if status, err = a.GetStatus(userID); err != nil {
		return
	}

	status.LastActivityAt = activityAt

	a.Srv().Platform().AddStatusCacheSkipClusterSend(status)
	a.SetStatusAwayIfNeeded(userID, false)
}

func (a *App) SetStatusOnline(userID string, manual bool) {
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

	a.Srv().Platform().AddStatusCache(status)

	// Only update the database if the status has changed, the status has been manually set,
	// or enough time has passed since the previous action
	if status.Status != oldStatus || status.Manual != oldManual || status.LastActivityAt-oldTime > model.StatusMinUpdateTime {
		if broadcast {
			if err := a.Srv().Store().Status().SaveOrUpdate(status); err != nil {
				mlog.Warn("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		} else {
			if err := a.Srv().Store().Status().UpdateLastActivityAt(status.UserId, status.LastActivityAt); err != nil {
				mlog.Error("Failed to save status", mlog.String("user_id", userID), mlog.Err(err), mlog.String("user_id", userID))
			}
		}
	}

	if broadcast {
		a.Srv().Platform().BroadcastStatus(status)
	}
}

func (a *App) SetStatusOffline(userID string, manual bool) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)
	if err == nil && status.Manual && !manual {
		return // manually set status always overrides non-manual one
	}

	status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	a.Srv().Platform().SaveAndBroadcastStatus(status)
}

func (a *App) SetStatusAwayIfNeeded(userID string, manual bool) {
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

	a.Srv().Platform().SaveAndBroadcastStatus(status)
}

// SetStatusDoNotDisturbTimed takes endtime in unix epoch format in UTC
// and sets status of given userId to dnd which will be restored back after endtime
func (a *App) SetStatusDoNotDisturbTimed(userId string, endtime int64) {
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

	a.Srv().Platform().SaveAndBroadcastStatus(status)
}

func (a *App) SetStatusDoNotDisturb(userID string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusDnd
	status.Manual = true

	a.Srv().Platform().SaveAndBroadcastStatus(status)
}

func (a *App) SetStatusOutOfOffice(userID string) {
	if !*a.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := a.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOutOfOffice, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	status.Status = model.StatusOutOfOffice
	status.Manual = true

	a.Srv().Platform().SaveAndBroadcastStatus(status)
}

func (a *App) GetStatusFromCache(userID string) *model.Status {
	return a.Srv().Platform().GetStatusFromCache(userID)
}

func (a *App) GetStatus(userID string) (*model.Status, *model.AppError) {
	return a.Srv().Platform().GetStatus(userID)
}

func (a *App) IsUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *a.Config().TeamSettings.UserStatusAwayTimeout*1000
}

// UpdateDNDStatusOfUsers is a recurring task which is started when server starts
// which unsets dnd status of users if needed and saves and broadcasts it
func (a *App) UpdateDNDStatusOfUsers() {
	statuses, err := a.UpdateExpiredDNDStatuses()
	if err != nil {
		mlog.Warn("Failed to fetch dnd statues from store", mlog.String("err", err.Error()))
		return
	}
	for i := range statuses {
		a.Srv().Platform().AddStatusCache(statuses[i])
		a.Srv().Platform().BroadcastStatus(statuses[i])
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

	// Add only status set by user to recent statuses
	if !cs.SetByProduct {
		if err := a.addRecentCustomStatus(userID, cs); err != nil {
			a.Log().Error("Can't add recent custom status for", mlog.String("userID", userID), mlog.Err(err))
		}
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

func (a *App) GetRecentCustomStatuses(userID string) ([]*model.CustomStatus, error) {
	pref, err := a.GetPreferenceByCategoryAndNameForUser(userID, model.PreferenceCategoryCustomStatus, model.PreferenceNameRecentCustomStatuses)
	if err != nil {
		return nil, err
	}

	var existingRCS []*model.CustomStatus
	if jsonErr := json.Unmarshal([]byte(pref.Value), &existingRCS); jsonErr != nil {
		return nil, jsonErr
	}

	return existingRCS, nil
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
