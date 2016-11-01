// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

var statusCache *utils.Cache = utils.NewLru(model.STATUS_CACHE_SIZE)

func AddStatusCacheSkipClusterSend(status *model.Status) {
	statusCache.Add(status.UserId, status)
}

func AddStatusCache(status *model.Status) {
	AddStatusCacheSkipClusterSend(status)

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().UpdateStatus(status)
	}
}

func InitStatus() {
	l4g.Debug(utils.T("api.status.init.debug"))

	BaseRoutes.Users.Handle("/status", ApiUserRequired(getStatusesHttp)).Methods("GET")
	BaseRoutes.Users.Handle("/status/ids", ApiUserRequired(getStatusesByIdsHttp)).Methods("POST")
	BaseRoutes.Users.Handle("/status/set_active_channel", ApiUserRequired(setActiveChannel)).Methods("POST")
	BaseRoutes.WebSocket.Handle("get_statuses", ApiWebSocketHandler(getStatusesWebSocket))
	BaseRoutes.WebSocket.Handle("get_statuses_by_ids", ApiWebSocketHandler(getStatusesByIdsWebSocket))
}

func getStatusesHttp(c *Context, w http.ResponseWriter, r *http.Request) {
	statusMap, err := GetAllStatuses()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}

func getStatusesWebSocket(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	statusMap, err := GetAllStatuses()
	if err != nil {
		return nil, err
	}

	return statusMap, nil
}

// Only returns 300 statuses max
func GetAllStatuses() (map[string]interface{}, *model.AppError) {
	if result := <-Srv.Store.Status().GetOnlineAway(); result.Err != nil {
		return nil, result.Err
	} else {
		statuses := result.Data.([]*model.Status)

		statusMap := map[string]interface{}{}
		for _, s := range statuses {
			statusMap[s.UserId] = s.Status
		}

		return statusMap, nil
	}
}

func getStatusesByIdsHttp(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("getStatusesByIdsHttp", "user_ids")
		return
	}

	statusMap, err := GetStatusesByIds(userIds)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}

func getStatusesByIdsWebSocket(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var userIds []string
	if userIds = model.ArrayFromInterface(req.Data["user_ids"]); len(userIds) == 0 {
		l4g.Error(model.StringInterfaceToJson(req.Data))
		return nil, NewInvalidWebSocketParamError(req.Action, "user_ids")
	}

	statusMap, err := GetStatusesByIds(userIds)
	if err != nil {
		return nil, err
	}

	return statusMap, nil
}

func GetStatusesByIds(userIds []string) (map[string]interface{}, *model.AppError) {
	statusMap := map[string]interface{}{}

	missingUserIds := []string{}
	for _, userId := range userIds {
		if result, ok := statusCache.Get(userId); ok {
			statusMap[userId] = result.(*model.Status).Status
		} else {
			missingUserIds = append(missingUserIds, userId)
		}
	}

	if len(missingUserIds) > 0 {
		if result := <-Srv.Store.Status().GetByIds(missingUserIds); result.Err != nil {
			return nil, result.Err
		} else {
			statuses := result.Data.([]*model.Status)

			for _, s := range statuses {
				AddStatusCache(s)
				statusMap[s.UserId] = s.Status
			}
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

func SetStatusOnline(userId string, sessionId string, manual bool) {
	broadcast := false

	var oldStatus string = model.STATUS_OFFLINE
	var oldTime int64 = 0
	var oldManual bool = false
	var status *model.Status
	var err *model.AppError

	if status, err = GetStatus(userId); err != nil {
		status = &model.Status{userId, model.STATUS_ONLINE, false, model.GetMillis(), ""}
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

	AddStatusCache(status)

	// Only update the database if the status has changed, the status has been manually set,
	// or enough time has passed since the previous action
	if status.Status != oldStatus || status.Manual != oldManual || status.LastActivityAt-oldTime > model.STATUS_MIN_UPDATE_TIME {
		achan := Srv.Store.Session().UpdateLastActivityAt(sessionId, status.LastActivityAt)

		var schan store.StoreChannel
		if broadcast {
			schan = Srv.Store.Status().SaveOrUpdate(status)
		} else {
			schan = Srv.Store.Status().UpdateLastActivityAt(status.UserId, status.LastActivityAt)
		}

		if result := <-achan; result.Err != nil {
			l4g.Error(utils.T("api.status.last_activity.error"), userId, sessionId, result.Err)
		}

		if result := <-schan; result.Err != nil {
			l4g.Error(utils.T("api.status.save_status.error"), userId, result.Err)
		}
	}

	if broadcast {
		event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_STATUS_CHANGE, "", "", status.UserId, nil)
		event.Add("status", model.STATUS_ONLINE)
		event.Add("user_id", status.UserId)
		go Publish(event)
	}
}

func SetStatusOffline(userId string, manual bool) {
	status, err := GetStatus(userId)
	if err == nil && status.Manual && !manual {
		return // manually set status always overrides non-manual one
	}

	status = &model.Status{userId, model.STATUS_OFFLINE, manual, model.GetMillis(), ""}

	AddStatusCache(status)

	if result := <-Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		l4g.Error(utils.T("api.status.save_status.error"), userId, result.Err)
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_STATUS_CHANGE, "", "", status.UserId, nil)
	event.Add("status", model.STATUS_OFFLINE)
	event.Add("user_id", status.UserId)
	go Publish(event)
}

func SetStatusAwayIfNeeded(userId string, manual bool) {
	status, err := GetStatus(userId)

	if err != nil {
		status = &model.Status{userId, model.STATUS_OFFLINE, manual, 0, ""}
	}

	if !manual && status.Manual {
		return // manually set status always overrides non-manual one
	}

	if !manual {
		if status.Status == model.STATUS_AWAY {
			return
		}

		if !IsUserAway(status.LastActivityAt) {
			return
		}
	}

	status.Status = model.STATUS_AWAY
	status.Manual = manual
	status.ActiveChannel = ""

	AddStatusCache(status)

	if result := <-Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		l4g.Error(utils.T("api.status.save_status.error"), userId, result.Err)
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_STATUS_CHANGE, "", "", status.UserId, nil)
	event.Add("status", model.STATUS_AWAY)
	event.Add("user_id", status.UserId)
	go Publish(event)
}

func GetStatus(userId string) (*model.Status, *model.AppError) {
	if result, ok := statusCache.Get(userId); ok {
		status := result.(*model.Status)
		statusCopy := &model.Status{}
		*statusCopy = *status
		return statusCopy, nil
	}

	if result := <-Srv.Store.Status().Get(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Status), nil
	}
}

func IsUserAway(lastActivityAt int64) bool {
	return model.GetMillis()-lastActivityAt >= *utils.Cfg.TeamSettings.UserStatusAwayTimeout*1000
}

func DoesStatusAllowPushNotification(user *model.User, status *model.Status, channelId string) bool {
	props := user.NotifyProps

	if props["push"] == "none" {
		return false
	}

	if pushStatus, ok := props["push_status"]; (pushStatus == model.STATUS_ONLINE || !ok) && (status.ActiveChannel != channelId || model.GetMillis()-status.LastActivityAt > model.STATUS_CHANNEL_TIMEOUT) {
		return true
	} else if pushStatus == model.STATUS_AWAY && (status.Status == model.STATUS_AWAY || status.Status == model.STATUS_OFFLINE) {
		return true
	} else if pushStatus == model.STATUS_OFFLINE && status.Status == model.STATUS_OFFLINE {
		return true
	}

	return false
}

func setActiveChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.MapFromJson(r.Body)

	var channelId string
	var ok bool
	if channelId, ok = data["channel_id"]; !ok || len(channelId) > 26 {
		c.SetInvalidParam("setActiveChannel", "channel_id")
		return
	}

	if err := SetActiveChannel(c.Session.UserId, channelId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func SetActiveChannel(userId string, channelId string) *model.AppError {
	status, err := GetStatus(userId)
	if err != nil {
		status = &model.Status{userId, model.STATUS_ONLINE, false, model.GetMillis(), channelId}
	} else {
		status.ActiveChannel = channelId
		if !status.Manual {
			status.Status = model.STATUS_ONLINE
		}
		status.LastActivityAt = model.GetMillis()
	}

	AddStatusCache(status)

	if result := <-Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		return result.Err
	}

	return nil
}
