// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func InitStatus() {
	l4g.Debug(utils.T("api.status.init.debug"))

	BaseRoutes.Users.Handle("/status", ApiUserRequired(getStatusesHttp)).Methods("GET")
	BaseRoutes.Users.Handle("/status/ids", ApiUserRequired(getStatusesByIdsHttp)).Methods("POST")
}

func getStatusesHttp(c *Context, w http.ResponseWriter, r *http.Request) {
	statusMap := model.StatusMapToInterfaceMap(app.GetAllStatuses())
	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}

func getStatusesByIdsHttp(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("getStatusesByIdsHttp", "user_ids")
		return
	}

	statusMap, err := c.App.GetStatusesByIds(userIds)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.StringInterfaceToJson(statusMap)))
}
