// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

// StatusTransitionManager returns the centralized status transition manager.
// This is only used when AccurateStatuses is enabled.
func (ps *PlatformService) StatusTransitionManager() *StatusTransitionManager {
	return ps.statusTransitionManager
}

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
		ps.Log().Warn("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
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

	// Log the activity update
	username := ""
	if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
		username = user.Username
	}
	ps.LogActivityUpdate(userID, username, status.Status, model.StatusLogDeviceUnknown, false, "", "", "", model.StatusLogTriggerSetActivity, "SetStatusLastActivityAt", activityAt)
}

func (ps *PlatformService) UpdateLastActivityAtIfNeeded(session model.Session) {
	now := model.GetMillis()

	ps.UpdateWebConnUserActivity(session, now)

	if now-session.LastActivityAt < model.SessionActivityTimeout {
		return
	}

	if err := ps.Store.Session().UpdateLastActivityAt(session.Id, now); err != nil {
		ps.Log().Warn("Failed to update LastActivityAt", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
	}

	session.LastActivityAt = now
	if err := ps.AddSessionToCache(&session); err != nil {
		ps.Log().Warn("Failed to add session to cache", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
	}

	// Log the activity update (session activity from WebSocket messages)
	// Get current status for logging
	status, statusErr := ps.GetStatus(session.UserId)
	currentStatus := model.StatusOffline
	if statusErr == nil && status != nil {
		currentStatus = status.Status
	}
	username := ""
	if user, userErr := ps.Store.User().Get(context.Background(), session.UserId); userErr == nil {
		username = user.Username
	}
	ps.LogActivityUpdate(session.UserId, username, currentStatus, model.StatusLogDeviceUnknown, false, "", "", "", model.StatusLogTriggerWebSocket, "UpdateLastActivityAtIfNeeded", now)
}

// UpdateActivityFromManualAction updates LastActivityAt and potentially sets the user
// to Online status when they perform a manual action (e.g., marking messages as unread,
// sending a message, etc.). This is used when AccurateStatuses is enabled to ensure
// manual actions are properly tracked.
//
// Unlike SetStatusOnline, this function:
// - Always updates LastActivityAt
// - Only changes status if user is Away or Offline (not DND or OOO)
// - Respects manually set statuses (won't change if status.Manual is true)
func (ps *PlatformService) UpdateActivityFromManualAction(userID string, channelID string, trigger string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// Only process if AccurateStatuses feature is enabled
	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	now := model.GetMillis()

	status, err := ps.GetStatus(userID)
	if err != nil {
		// User doesn't have a status yet, create one
		status = &model.Status{
			UserId:         userID,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  channelID,
		}
	}

	oldStatus := status.Status
	oldLastActivityAt := status.LastActivityAt

	// Always update LastActivityAt on manual action
	status.LastActivityAt = now
	if channelID != "" {
		status.ActiveChannel = channelID
	}

	// Determine if we should change status to Online
	newStatus := status.Status
	statusChanged := false

	// Only auto-set to Online if:
	// 1. User is currently Away or Offline
	// 2. User's status is NOT manually set
	// 3. User is NOT in DND or Out of Office mode
	if status.Status != model.StatusDnd && status.Status != model.StatusOutOfOffice {
		if !status.Manual {
			if status.Status == model.StatusAway || status.Status == model.StatusOffline {
				// If user was DND but went offline due to inactivity, restore DND instead of Online
				if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
					newStatus = model.StatusDnd
					status.Manual = true
					status.PrevStatus = ""
				} else {
					newStatus = model.StatusOnline
				}
				statusChanged = true
				status.Status = newStatus
			}
		}
	}

	// Handle NoOffline: If user is offline, set them online (even if manual)
	if ps.Config().FeatureFlags.NoOffline && oldStatus == model.StatusOffline {
		newStatus = model.StatusOnline
		statusChanged = true
		status.Status = newStatus
		status.Manual = false
	}

	// Save the status update
	ps.AddStatusCache(status)

	// Save to database
	lastActivityAtChanged := status.LastActivityAt != oldLastActivityAt
	if statusChanged {
		if dbErr := ps.Store.Status().SaveOrUpdate(status); dbErr != nil {
			ps.Log().Warn("Failed to save status from manual action", mlog.String("user_id", userID), mlog.Err(dbErr))
		}
	} else if lastActivityAtChanged {
		if dbErr := ps.Store.Status().UpdateLastActivityAt(userID, status.LastActivityAt); dbErr != nil {
			ps.Log().Warn("Failed to update LastActivityAt from manual action", mlog.String("user_id", userID), mlog.Err(dbErr))
		}
	}

	// Log the status change
	if statusChanged {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		reason := model.StatusLogReasonManual
		if ps.Config().FeatureFlags.NoOffline && oldStatus == model.StatusOffline {
			reason = model.StatusLogReasonOfflinePrevented
		}
		// This is NOT a manual status change - it's automatic from user activity (e.g., sending message, marking unread)
		ps.LogStatusChange(userID, username, oldStatus, newStatus, reason, model.StatusLogDeviceUnknown, true, channelID, false, "UpdateActivityFromManualAction")
	} else {
		// Log activity update (no status change)
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		var channelName string
		var channelType string
		if channelID != "" {
			if channel, chanErr := ps.Store.Channel().Get(channelID, false); chanErr == nil {
				channelName = channel.DisplayName
				if channelName == "" {
					channelName = channel.Name
				}
				channelType = string(channel.Type)

				// For DM channels, resolve the other user's username
				if channel.Type == model.ChannelTypeDirect {
					otherUserID1, otherUserID2 := channel.GetBothUsersForDM()
					otherUserID := otherUserID1
					if otherUserID1 == userID {
						otherUserID = otherUserID2
					}
					if otherUserID != "" {
						if otherUser, otherUserErr := ps.Store.User().Get(context.Background(), otherUserID); otherUserErr == nil {
							channelName = otherUser.Username
						}
					}
				} else if channel.Type == model.ChannelTypeGroup && channel.DisplayName == "" {
					// For GM channels without a display name, build one from members
					opts := model.ChannelMembersGetOptions{ChannelID: channelID, Offset: 0, Limit: 100}
					if members, membersErr := ps.Store.Channel().GetMembers(opts); membersErr == nil {
						var usernames []string
						for _, member := range members {
							if member.UserId != userID {
								if memberUser, memberUserErr := ps.Store.User().Get(context.Background(), member.UserId); memberUserErr == nil {
									usernames = append(usernames, memberUser.Username)
								}
							}
						}
						if len(usernames) > 0 {
							channelName = strings.Join(usernames, ", ")
						}
					}
				}
			}
		}
		ps.LogActivityUpdate(userID, username, status.Status, model.StatusLogDeviceUnknown, true, channelID, channelName, channelType, trigger, "UpdateActivityFromManualAction", status.LastActivityAt)
	}

	// Broadcast status change if status changed
	if statusChanged {
		ps.BroadcastStatus(status)
		if ps.sharedChannelService != nil {
			ps.sharedChannelService.NotifyUserStatusChanged(status)
		}
	}
}

// SetOnlineIfNoOffline sets a user to Online if the NoOffline feature flag is enabled
// and the user is currently Away or Offline. This is independent of AccurateStatuses
// and is called from SetActiveChannel and FetchHistory triggers.
func (ps *PlatformService) SetOnlineIfNoOffline(userID string, channelID string, trigger string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// Only process if NoOffline feature is enabled
	if !ps.Config().FeatureFlags.NoOffline {
		return
	}

	status, err := ps.GetStatus(userID)
	if err != nil {
		// User doesn't have a status yet, create one as Online
		status = &model.Status{
			UserId:         userID,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
			ActiveChannel:  channelID,
		}
		ps.AddStatusCache(status)
		if dbErr := ps.Store.Status().SaveOrUpdate(status); dbErr != nil {
			ps.Log().Warn("Failed to save status from NoOffline", mlog.String("user_id", userID), mlog.Err(dbErr))
		}
		ps.BroadcastStatus(status)
		return
	}

	// Only act on Away or Offline users
	// Don't touch DND or Out of Office statuses
	if status.Status != model.StatusAway && status.Status != model.StatusOffline {
		return
	}

	// If user was DND but went offline due to inactivity, restore DND instead of Online
	if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
		oldStatus := status.Status
		status.Status = model.StatusDnd
		status.Manual = true
		status.PrevStatus = ""
		status.LastActivityAt = model.GetMillis()
		if channelID != "" {
			status.ActiveChannel = channelID
		}

		ps.AddStatusCache(status)
		if dbErr := ps.Store.Status().SaveOrUpdate(status); dbErr != nil {
			ps.Log().Warn("Failed to save status from NoOffline DND restore", mlog.String("user_id", userID), mlog.Err(dbErr))
		}

		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		ps.LogStatusChange(userID, username, oldStatus, model.StatusDnd, model.StatusLogReasonDNDRestored, model.StatusLogDeviceUnknown, true, channelID, false, "SetOnlineIfNoOffline/"+trigger)

		ps.BroadcastStatus(status)
		if ps.sharedChannelService != nil {
			ps.sharedChannelService.NotifyUserStatusChanged(status)
		}
		return
	}

	oldStatus := status.Status

	// Set to Online
	status.Status = model.StatusOnline
	status.Manual = false
	status.LastActivityAt = model.GetMillis()
	if channelID != "" {
		status.ActiveChannel = channelID
	}

	// Save to cache and database
	ps.AddStatusCache(status)
	if dbErr := ps.Store.Status().SaveOrUpdate(status); dbErr != nil {
		ps.Log().Warn("Failed to save status from NoOffline", mlog.String("user_id", userID), mlog.Err(dbErr))
	}

	// Log the status change
	username := ""
	if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
		username = user.Username
	}
	ps.LogStatusChange(userID, username, oldStatus, model.StatusOnline, model.StatusLogReasonOfflinePrevented, model.StatusLogDeviceUnknown, true, channelID, false, "SetOnlineIfNoOffline/"+trigger)

	// Broadcast status change
	ps.BroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

func (ps *PlatformService) SetStatusOnline(userID string, manual bool, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonConnect,
			Manual:    manual,
			Device:    device,
		})
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
			// Log the activity update (user already online, just refreshing LastActivityAt)
			username := ""
			if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
				username = user.Username
			}
			ps.LogActivityUpdate(userID, username, model.StatusOnline, device, true, "", "", "", model.StatusLogTriggerHeartbeat, "SetStatusOnline", status.LastActivityAt)
		}
		if ps.sharedChannelService != nil {
			ps.sharedChannelService.NotifyUserStatusChanged(status)
		}
	}

	if broadcast {
		ps.BroadcastStatus(status)

		// Log the status change
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		reason := model.StatusLogReasonManual
		if !manual {
			reason = model.StatusLogReasonConnect
		}
		// Use passed device, fall back to API if manual and no device provided
		logDevice := device
		if logDevice == "" && manual {
			logDevice = model.StatusLogDeviceAPI
		}
		// manual=true means user explicitly set their status to Online
		ps.LogStatusChange(userID, username, oldStatus, model.StatusOnline, reason, logDevice, true, "", manual, "SetStatusOnline")
	}
}

func (ps *PlatformService) SetStatusOffline(userID string, manual bool, force bool, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if ps.Config().FeatureFlags.AccurateStatuses {
		ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusOffline,
			Reason:    TransitionReasonDisconnect,
			Manual:    manual,
			Force:     force,
			Device:    device,
		})
		return
	}

	oldStatus := model.StatusOnline // default if we can't get it
	status, err := ps.GetStatus(userID)
	if err != nil {
		ps.Log().Warn("Error getting status. Setting it to offline forcefully.", mlog.String("user_id", userID), mlog.Err(err))
	} else {
		oldStatus = status.Status
		if !force && status.Manual && !manual {
			return // manually set status always overrides non-manual one
		}
	}
	ps._setStatusOfflineAndNotify(userID, manual)

	// Log the status change
	if oldStatus != model.StatusOffline {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		reason := model.StatusLogReasonManual
		if !manual {
			reason = model.StatusLogReasonDisconnect
		}
		// Use passed device, fall back to API if manual and no device provided
		logDevice := device
		if logDevice == "" && manual {
			logDevice = model.StatusLogDeviceAPI
		}
		// manual=true means user explicitly set their status to Offline
		ps.LogStatusChange(userID, username, oldStatus, model.StatusOffline, reason, logDevice, false, "", manual, "SetStatusOffline")
	}
}

func (ps *PlatformService) _setStatusOfflineAndNotify(userID string, manual bool) {
	status := &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}
}

// QueueSetStatusOffline queues a status update to set a user offline
// instead of directly updating it for better performance during high load
func (ps *PlatformService) QueueSetStatusOffline(userID string, manual bool, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	oldStatus := model.StatusOnline // default if we can't get it
	status, err := ps.GetStatus(userID)
	if err != nil {
		ps.Log().Warn("Error getting status. Setting it to offline forcefully.", mlog.String("user_id", userID), mlog.Err(err))
	} else {
		oldStatus = status.Status
		if status.Manual && !manual {
			// Force will be false here, so no need to add another variable.
			return // manually set status always overrides non-manual one
		}
	}

	status = &model.Status{
		UserId:         userID,
		Status:         model.StatusOffline,
		Manual:         manual,
		LastActivityAt: model.GetMillis(),
		ActiveChannel:  "",
	}

	select {
	case ps.statusUpdateChan <- status:
		// Successfully queued
	default:
		// Channel is full, fall back to direct update
		ps.Log().Warn("Status update channel is full. Falling back to direct update")
		ps._setStatusOfflineAndNotify(userID, manual)
	}

	// Log the status change (logged when queued, actual update may be slightly delayed)
	if oldStatus != model.StatusOffline {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		reason := model.StatusLogReasonManual
		if !manual {
			reason = model.StatusLogReasonDisconnect
		}
		// Use passed device, fall back to API if manual and no device provided
		logDevice := device
		if logDevice == "" && manual {
			logDevice = model.StatusLogDeviceAPI
		}
		// manual=true means user explicitly set their status to Offline
		ps.LogStatusChange(userID, username, oldStatus, model.StatusOffline, reason, logDevice, false, "", manual, "QueueSetStatusOffline")
	}
}

const (
	statusUpdateBufferSize     = sendQueueSize // We use the webConn sendQueue size as a reference point for the buffer size.
	statusUpdateFlushThreshold = statusUpdateBufferSize / 8
	statusUpdateBatchInterval  = 500 * time.Millisecond // Max time to wait before processing
)

// processStatusUpdates processes status updates in batches for better performance
// This runs as a goroutine and continuously monitors the statusUpdateChan
func (ps *PlatformService) processStatusUpdates() {
	defer close(ps.statusUpdateDoneSignal)

	statusBatch := make(map[string]*model.Status)
	ticker := time.NewTicker(statusUpdateBatchInterval)
	defer ticker.Stop()

	flush := func(broadcast bool) {
		if len(statusBatch) == 0 {
			return
		}

		// Add each status to cache.
		for _, status := range statusBatch {
			ps.AddStatusCache(status)
		}

		// Process statuses in batch
		if err := ps.Store.Status().SaveOrUpdateMany(statusBatch); err != nil {
			ps.logger.Warn("Failed to save multiple statuses", mlog.Err(err))
		}

		// Broadcast each status only if hub is still running
		if broadcast {
			for _, status := range statusBatch {
				ps.BroadcastStatus(status)
				if ps.sharedChannelService != nil {
					ps.sharedChannelService.NotifyUserStatusChanged(status)
				}
			}
		}

		clear(statusBatch)
	}

	for {
		select {
		case status := <-ps.statusUpdateChan:
			// In case of duplicates, we override the last entry
			statusBatch[status.UserId] = status

			if len(statusBatch) >= statusUpdateFlushThreshold {
				ps.logger.Debug("Flushing statuses because the current buffer exceeded the flush threshold.", mlog.Int("current_buffer", len(statusBatch)), mlog.Int("flush_threshold", statusUpdateFlushThreshold))
				flush(true)
			}
		case <-ticker.C:
			flush(true)
		case <-ps.statusUpdateExitSignal:
			// Process any remaining statuses before shutting down
			// Skip broadcast since hub is already stopped
			ps.logger.Debug("Exit signal received. Flushing any remaining statuses.")
			flush(false)
			return
		}
	}
}

func (ps *PlatformService) SetStatusAwayIfNeeded(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if ps.Config().FeatureFlags.AccurateStatuses {
		ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusAway,
			Reason:    TransitionReasonInactivity,
			Manual:    manual,
		})
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: 0, ActiveChannel: ""}
	}

	if !manual && status.Manual {
		return // manually set status always overrides non-manual one
	}

	// Don't set Away if user was DND and went Offline due to DND inactivity timeout.
	// They should stay Offline (preserving notification suppression via PrevStatus)
	// until they show activity, at which point DND will be restored.
	if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
		return
	}

	if !manual {
		if status.Status == model.StatusAway {
			return
		}

		if !ps.isUserAway(status.LastActivityAt) {
			return
		}
	}

	oldStatus := status.Status
	status.Status = model.StatusAway
	status.Manual = manual
	status.ActiveChannel = ""

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the status change
	if oldStatus != model.StatusAway {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		reason := model.StatusLogReasonManual
		if !manual {
			reason = model.StatusLogReasonInactivity
		}
		device := model.StatusLogDeviceUnknown
		if manual {
			device = model.StatusLogDeviceAPI
		}
		// manual=true means user explicitly set their status to Away
		ps.LogStatusChange(userID, username, oldStatus, model.StatusAway, reason, device, false, "", manual, "SetStatusAwayIfNeeded")
	}
}

// SetStatusDoNotDisturbTimed takes endtime in unix epoch format in UTC
// and sets status of given userId to dnd which will be restored back after endtime
func (ps *PlatformService) SetStatusDoNotDisturbTimed(userID string, endtime int64) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if ps.Config().FeatureFlags.AccurateStatuses {
		ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:     userID,
			NewStatus:  model.StatusDnd,
			Reason:     TransitionReasonManual,
			Manual:     true,
			DNDEndTime: truncateDNDEndTime(endtime),
		})
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	oldStatus := status.Status
	status.PrevStatus = status.Status
	status.Status = model.StatusDnd
	status.Manual = true

	status.DNDEndTime = truncateDNDEndTime(endtime)

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the status change
	if oldStatus != model.StatusDnd {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		// DND timed is always a manual user action
		ps.LogStatusChange(userID, username, oldStatus, model.StatusDnd, model.StatusLogReasonManual, model.StatusLogDeviceAPI, true, "", true, "SetStatusDoNotDisturbTimed")
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

	if ps.Config().FeatureFlags.AccurateStatuses {
		ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusDnd,
			Reason:    TransitionReasonManual,
			Manual:    true,
		})
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	}

	oldStatus := status.Status
	status.Status = model.StatusDnd
	status.Manual = true

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the status change
	if oldStatus != model.StatusDnd {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		// DND is always a manual user action
		ps.LogStatusChange(userID, username, oldStatus, model.StatusDnd, model.StatusLogReasonManual, model.StatusLogDeviceAPI, true, "", true, "SetStatusDoNotDisturb")
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

	oldStatus := status.Status
	status.Status = model.StatusOutOfOffice
	status.Manual = true

	ps.SaveAndBroadcastStatus(status)
	if ps.sharedChannelService != nil {
		ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the status change
	if oldStatus != model.StatusOutOfOffice {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}
		// Out of Office is always a manual user action
		ps.LogStatusChange(userID, username, oldStatus, model.StatusOutOfOffice, model.StatusLogReasonManual, model.StatusLogDeviceAPI, true, "", true, "SetStatusOutOfOffice")
	}
}

func (ps *PlatformService) isUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *ps.Config().TeamSettings.UserStatusAwayTimeout*1000
}

// UpdateActivityFromHeartbeat processes a heartbeat from the client and updates
// the user's LastActivityAt and status accordingly. This is used for accurate
// status tracking when the AccurateStatuses feature flag is enabled.
//
// Logic:
// 1. If window is active OR channel changed → This is manual activity → Update LastActivityAt
// 2. If user is Away/Offline and has manual activity → Set to Online (except DND)
// 3. If user is Online and has been inactive (no manual activity) for X minutes → Set to Away
// 4. If user is DND and has been inactive for Y minutes → Set to Offline
func (ps *PlatformService) UpdateActivityFromHeartbeat(userID string, windowActive bool, channelID string, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// Only process if AccurateStatuses feature is enabled
	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	now := model.GetMillis()

	status, err := ps.GetStatus(userID)
	if err != nil {
		// User doesn't have a status yet, create one
		status = &model.Status{
			UserId:         userID,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  channelID,
		}
	}

	oldStatus := status.Status
	oldLastActivityAt := status.LastActivityAt

	// Determine if this heartbeat represents manual activity
	// Manual activity = window is active OR user switched to a different channel
	// Note: We only consider it a "channel change" if we previously knew what channel they were on.
	// This prevents false positives when ActiveChannel is empty (not stored in DB, only in cache).
	channelChanged := channelID != "" && status.ActiveChannel != "" && channelID != status.ActiveChannel
	isManualActivity := windowActive || channelChanged

	// Only update LastActivityAt on manual activity (this is the key fix!)
	if isManualActivity {
		status.LastActivityAt = now
	}

	// Update active channel if provided
	if channelID != "" {
		status.ActiveChannel = channelID
	}

	// Calculate inactivity timeouts
	inactivityTimeout := int64(*ps.Config().MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes) * 60 * 1000
	dndInactivityTimeout := int64(*ps.Config().MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes) * 60 * 1000
	timeSinceLastActivity := now - status.LastActivityAt

	// Determine new status based on activity and feature flags
	newStatus := status.Status

	// Handle DND users: Check DND inactivity timeout
	if status.Status == model.StatusDnd {
		// DND users can be set to Offline after extended inactivity
		if dndInactivityTimeout > 0 && timeSinceLastActivity >= dndInactivityTimeout {
			// Save PrevStatus so we can restore DND when user returns
			// and block notifications while they appear offline
			status.PrevStatus = model.StatusDnd
			newStatus = model.StatusOffline
			status.Manual = false
		}
		// Note: DND users are NOT automatically set back to Online on activity
		// They must manually change their status
	} else if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd && isManualActivity {
		// User was DND, went offline due to inactivity, and is now active again
		// Restore their DND status
		newStatus = model.StatusDnd
		status.Manual = true
		status.PrevStatus = ""
	} else if status.Status == model.StatusOutOfOffice {
		// Out of Office is similar to DND - it's a manual status that shouldn't auto-change
		// (no automatic offline timeout for OOO)
	} else {
		// Handle non-DND, non-OOO statuses

		// NoOffline feature: If user is offline but showing manual activity, set them online
		if ps.Config().FeatureFlags.NoOffline && status.Status == model.StatusOffline && isManualActivity {
			newStatus = model.StatusOnline
			status.Manual = false
		}

		// AccurateStatuses: Handle status transitions based on activity
		if !status.Manual {
			// Only auto-adjust non-manual statuses
			if isManualActivity {
				// Manual activity detected - user should be online
				if status.Status == model.StatusAway || status.Status == model.StatusOffline {
					newStatus = model.StatusOnline
				}
			} else {
				// No manual activity in this heartbeat
				// Check if enough time has passed since last activity to set Away
				if status.Status == model.StatusOnline && inactivityTimeout > 0 && timeSinceLastActivity >= inactivityTimeout {
					newStatus = model.StatusAway
				}
			}
		}
	}

	statusChanged := oldStatus != newStatus
	if statusChanged {
		status.Status = newStatus
	}

	// Log the status change if logging is enabled
	if statusChanged {
		reason := model.StatusLogReasonHeartbeat
		if isManualActivity && oldStatus == model.StatusAway {
			reason = model.StatusLogReasonWindowFocus
		} else if !isManualActivity && newStatus == model.StatusAway {
			reason = model.StatusLogReasonInactivity
		} else if ps.Config().FeatureFlags.NoOffline && oldStatus == model.StatusOffline {
			reason = model.StatusLogReasonOfflinePrevented
		} else if oldStatus == model.StatusDnd && newStatus == model.StatusOffline {
			reason = model.StatusLogReasonDNDExpired
		} else if oldStatus == model.StatusOffline && newStatus == model.StatusDnd {
			reason = model.StatusLogReasonDNDRestored
		}

		// Get username for logging
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}

		// This is NOT a manual status change - it's automatic from heartbeat activity
		ps.LogStatusChange(userID, username, oldStatus, newStatus, reason, device, windowActive, channelID, false, "UpdateActivityFromHeartbeat")
	}

	// Save the status update
	ps.AddStatusCache(status)

	// Only save to database if something changed (status or LastActivityAt)
	lastActivityAtChanged := status.LastActivityAt != oldLastActivityAt
	if statusChanged {
		if dbErr := ps.Store.Status().SaveOrUpdate(status); dbErr != nil {
			ps.Log().Warn("Failed to save status from heartbeat", mlog.String("user_id", userID), mlog.Err(dbErr))
		}
		// Broadcast status change via WebSocket so other users see the update
		ps.BroadcastStatus(status)
	} else if lastActivityAtChanged {
		if dbErr := ps.Store.Status().UpdateLastActivityAt(userID, status.LastActivityAt); dbErr != nil {
			ps.Log().Warn("Failed to update LastActivityAt from heartbeat", mlog.String("user_id", userID), mlog.Err(dbErr))
		}
	}

	// Log activity update (for status dashboard) only if there was manual activity
	if isManualActivity && !statusChanged {
		username := ""
		if user, userErr := ps.Store.User().Get(context.Background(), userID); userErr == nil {
			username = user.Username
		}

		// Determine trigger based on what activity was detected
		var trigger string
		var channelName string
		var channelType string
		if channelChanged {
			trigger = model.StatusLogTriggerChannelView
			// Try to get channel name for display
			if channel, chanErr := ps.Store.Channel().Get(channelID, false); chanErr == nil {
				channelName = channel.DisplayName
				if channelName == "" {
					channelName = channel.Name
				}
				channelType = string(channel.Type)

				// For DM channels, resolve the other user's username
				if channel.Type == model.ChannelTypeDirect {
					otherUserID1, otherUserID2 := channel.GetBothUsersForDM()
					otherUserID := otherUserID1
					if otherUserID1 == userID {
						otherUserID = otherUserID2
					}
					if otherUserID != "" {
						if otherUser, otherUserErr := ps.Store.User().Get(context.Background(), otherUserID); otherUserErr == nil {
							channelName = otherUser.Username
						}
					}
				} else if channel.Type == model.ChannelTypeGroup && channel.DisplayName == "" {
					// For GM channels without a display name, build one from members
					opts := model.ChannelMembersGetOptions{ChannelID: channelID, Offset: 0, Limit: 100}
					if members, membersErr := ps.Store.Channel().GetMembers(opts); membersErr == nil {
						var usernames []string
						for _, member := range members {
							if member.UserId != userID {
								if memberUser, memberUserErr := ps.Store.User().Get(context.Background(), member.UserId); memberUserErr == nil {
									usernames = append(usernames, memberUser.Username)
								}
							}
						}
						if len(usernames) > 0 {
							channelName = strings.Join(usernames, ", ")
						}
					}
				}
			}
		} else if windowActive {
			trigger = model.StatusLogTriggerWindowActive
		}

		if trigger != "" {
			ps.LogActivityUpdate(userID, username, status.Status, device, windowActive, channelID, channelName, channelType, trigger, "UpdateActivityFromHeartbeat", status.LastActivityAt)
		}
	}

	// Broadcast status change if status changed
	if statusChanged {
		ps.BroadcastStatus(status)
		if ps.sharedChannelService != nil {
			ps.sharedChannelService.NotifyUserStatusChanged(status)
		}
	}
}
