// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
)

// GetUserStatusesByIds used by apiV4
func (a *App) GetUserStatusesByIds(userIDs []string) ([]*model.Status, *model.AppError) {
	return a.Srv().Platform().GetUserStatusesByIds(userIDs)
}

// SetStatusLastActivityAt sets the last activity at for a user on the local app server and updates
// status to away if needed. Used by the WS to set status to away if an 'online' device disconnects
// while an 'away' device is still connected
func (a *App) SetStatusLastActivityAt(userID string, activityAt int64) {
	a.Srv().Platform().SetStatusLastActivityAt(userID, activityAt)
}

func (a *App) SetStatusOnline(userID string, manual bool) {
	a.Srv().Platform().SetStatusOnline(userID, manual)
}

func (a *App) SetStatusOffline(userID string, manual bool) {
	a.Srv().Platform().SetStatusOffline(userID, manual)
}

func (a *App) SetStatusAwayIfNeeded(userID string, manual bool) {
	a.Srv().Platform().SetStatusAwayIfNeeded(userID, manual)
}

// SetStatusDoNotDisturbTimed takes endtime in unix epoch format in UTC
// and sets status of given userId to dnd which will be restored back after endtime
func (a *App) SetStatusDoNotDisturbTimed(userId string, endtime int64) {
	a.Srv().Platform().SetStatusDoNotDisturbTimed(userId, endtime)
}

func (a *App) SetStatusDoNotDisturb(userID string) {
	a.Srv().Platform().SetStatusDoNotDisturb(userID)
}

func (a *App) SetStatusOutOfOffice(userID string) {
	a.Srv().Platform().SetStatusOutOfOffice(userID)
}

func (a *App) GetStatusFromCache(userID string) *model.Status {
	return a.Srv().Platform().GetStatusFromCache(userID)
}

func (a *App) GetStatus(userID string) (*model.Status, *model.AppError) {
	return a.Srv().Platform().GetStatus(userID)
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
