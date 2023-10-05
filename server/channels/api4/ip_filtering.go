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
	api.BaseRoutes.IPFiltering.Handle("/my_ip", api.APISessionRequired(myIP)).Methods("GET")
}

func ensureIPFilteringInterface(c *Context, where string) bool {
	if c.App.IPFiltering() == nil || !c.App.Config().FeatureFlags.CloudIPFiltering {
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
	// TODO: Permissions

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

	// TODO: Permissions

	auditRec := c.MakeAuditRecord("applyIPFilters", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	ipFiltering := c.App.IPFiltering()

	allowedRanges := &model.AllowedIPRanges{} // Initialize the allowedRanges variable
	if err := json.NewDecoder(r.Body).Decode(allowedRanges); err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "IPFilter", allowedRanges)

	updatedAllowedRanges, err := ipFiltering.ApplyIPFilters(allowedRanges)

	if err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.apply_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	json, err := json.Marshal(updatedAllowedRanges)
	if err != nil {
		c.Err = model.NewAppError("applyIPFilters", "api.context.ip_filtering.get_ip_filters.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func myIP(c *Context, w http.ResponseWriter, r *http.Request) {
	ensured := ensureIPFilteringInterface(c, "myIP")

	if !ensured {
		return
	}

	response := &model.GetIPAddressResponse{
		IP: c.AppContext.IPAddress(),
	}

	json, err := json.Marshal(response)
	if err != nil {
		c.Err = model.NewAppError("myIP", "api.context.ip_filtering.get_my_ip.failed", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}
