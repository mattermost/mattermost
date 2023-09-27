// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitIPFiltering() {
	api.BaseRoutes.IPFiltering.Handle("", api.APISessionRequired(getIPFilters)).Methods("GET")
	api.BaseRoutes.IPFiltering.Handle("", api.APISessionRequired(applyIPFilters)).Methods("POST")
}

func ensureIPFilteringInterface(c *Context, where string) bool {
	if c.App.IPFiltering() == nil {
		c.Err = model.NewAppError(where, "api.context.ip_filtering.not_available.app_error", nil, "", http.StatusNotImplemented)
		return false
	}
	return true
}

func getIPFilters(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureIPFilteringInterface(c, "getIPFilters")
	if !ensured {
		return
	}

	ipFiltering := c.App.IPFiltering()

	allowedRanges, err := ipFiltering.GetIPFilters()
	if err != nil {
		c.Err = model.NewAppError("getIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(allowedRanges)
	if err != nil {
		c.Err = model.NewAppError("getIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func applyIPFilters(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureIPFilteringInterface(c, "applyIPFilters")
	if !ensured {
		return
	}

	auditRec := c.MakeAuditRecord("applyIPFilters", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	ipFiltering := c.App.IPFiltering()

	var allowedRanges *model.AllowedIPRanges
	if err := json.NewDecoder(r.Body).Decode(allowedRanges); err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "IPFilter", allowedRanges)

	if err := ipFiltering.ApplyIPFilters(allowedRanges); err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusCreated)

}
