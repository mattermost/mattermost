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

func SetStatusOnline(userId string, sessionId string) {
	broadcast := false

	var status *model.Status
	var err *model.AppError
	if status, err = GetStatus(userId); err != nil {
		status = &model.Status{userId, model.STATUS_ONLINE, model.GetMillis()}
		broadcast = true
	} else {
		if status.Status != model.STATUS_ONLINE {
			broadcast = true
		}
		status.Status = model.STATUS_ONLINE
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

func SetStatusOffline(userId string) {
	status := &model.Status{userId, model.STATUS_OFFLINE, model.GetMillis()}

	AddStatusCache(status)

	if result := <-Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		l4g.Error(utils.T("api.status.save_status.error"), userId, result.Err)
	}

	event := model.NewWebSocketEvent("", "", status.UserId, model.WEBSOCKET_EVENT_STATUS_CHANGE)
	event.Add("status", model.STATUS_OFFLINE)
	go Publish(event)
}

func SetStatusAwayIfNeeded(userId string) {
	status, err := GetStatus(userId)
	if err != nil {
		status = &model.Status{userId, model.STATUS_OFFLINE, 0}
	}

	if status.Status == model.STATUS_AWAY {
		return
	}

	if !IsUserAway(status.LastActivityAt) {
		return
	}

	status.Status = model.STATUS_AWAY

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
