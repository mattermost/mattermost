// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitStatus() {
	api.BaseRoutes.Users.Handle("/status", api.ApiUserRequired(getStatusesHttp)).Methods("GET")
	api.BaseRoutes.Users.Handle("/status/ids", api.ApiUserRequired(getStatusesByIdsHttp)).Methods("POST")
}

func getStatusesHttp(c *Context, w http.ResponseWriter, r *http.Request) {
	statusMap := model.StatusMapToInterfaceMap(c.App.GetAllStatuses())
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
