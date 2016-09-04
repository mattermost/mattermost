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

func AddStatusCache(status *model.Status) {
	statusCache.Add(status.UserId, status)

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().UpdateStatus(status)
	}
}

func InitStatus() {
	l4g.Debug(utils.T("api.status.init.debug"))

	BaseRoutes.Users.Handle("/status", ApiUserRequiredActivity(getStatusesHttp, false)).Methods("GET")
	BaseRoutes.Users.Handle("/status/set_active_channel", ApiUserRequiredActivity(setActiveChannel, false)).Methods("POST")
	BaseRoutes.WebSocket.Handle("get_statuses", ApiWebSocketHandler(getStatusesWebSocket))
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

func SetStatusOnline(userId string, sessionId string, manual bool) {
	broadcast := false

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
		status.Status = model.STATUS_ONLINE
		status.Manual = false // for "online" there's no manually or auto set
		status.LastActivityAt = model.GetMillis()
	}

	AddStatusCache(status)

	achan := Srv.Store.Session().UpdateLastActivityAt(sessionId, model.GetMillis())

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

	if broadcast {
		event := model.NewWebSocketEvent("", "", status.UserId, model.WEBSOCKET_EVENT_STATUS_CHANGE)
		event.Add("status", model.STATUS_ONLINE)
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

	event := model.NewWebSocketEvent("", "", status.UserId, model.WEBSOCKET_EVENT_STATUS_CHANGE)
	event.Add("status", model.STATUS_OFFLINE)
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

	event := model.NewWebSocketEvent("", "", status.UserId, model.WEBSOCKET_EVENT_STATUS_CHANGE)
	event.Add("status", model.STATUS_AWAY)
	go Publish(event)
}

func GetStatus(userId string) (*model.Status, *model.AppError) {
	if status, ok := statusCache.Get(userId); ok {
		return status.(*model.Status), nil
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
	}

	AddStatusCache(status)

	if result := <-Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		return result.Err
	}

	return nil
}
