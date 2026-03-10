// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitView() {
	if api.srv.Config().FeatureFlags.IntegratedBoards {
		api.BaseRoutes.ChannelViews.Handle("", api.APISessionRequired(createView)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelViews.Handle("", api.APISessionRequired(getViewsForChannel)).Methods(http.MethodGet)
		api.BaseRoutes.ChannelView.Handle("", api.APISessionRequired(getView)).Methods(http.MethodGet)
		api.BaseRoutes.ChannelView.Handle("", api.APISessionRequired(updateView)).Methods(http.MethodPatch)
		api.BaseRoutes.ChannelView.Handle("", api.APISessionRequired(deleteView)).Methods(http.MethodDelete)
		api.BaseRoutes.ChannelView.Handle("/sort_order", api.APISessionRequired(updateViewSortOrder)).Methods(http.MethodPost)
	}
}

func createView(c *Context, w http.ResponseWriter, r *http.Request) {
	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var view *model.View
	if err := json.NewDecoder(r.Body).Decode(&view); err != nil || view == nil {
		c.SetInvalidParamWithErr("view", err)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("createView", "api.view.create.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	view.ChannelId = c.Params.ChannelId
	view.CreatorId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventCreateView, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "view", view)

	if !checkViewWritePermission(c, channel) {
		return
	}

	created, appErr := c.App.CreateView(c.AppContext, view, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(created)
	auditRec.AddEventObjectType("view")
	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(created); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getViewsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("getViewsForChannel", "api.view.list.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventListViewsForChannel, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	query := r.URL.Query()
	opts := model.ViewQueryOpts{
		PerPage: c.Params.PerPage,
	}
	opts.IncludeDeleted, _ = strconv.ParseBool(query.Get("include_deleted"))
	if pageStr := query.Get("page"); pageStr != "" {
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 0 {
			c.SetInvalidParam("page")
			return
		}
		opts.Page = page
	}

	views, appErr := c.App.GetViewsForChannel(c.AppContext, c.Params.ChannelId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	resp := model.ViewListResponse{
		Views:   views,
		HasMore: len(views) == c.Params.PerPage,
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getView(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireViewId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("getView", "api.view.get.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetView, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "view_id", c.Params.ViewId)
	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	view, appErr := c.App.GetView(c.AppContext, c.Params.ViewId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if view.ChannelId != c.Params.ChannelId {
		c.Err = model.NewAppError("getView", "api.view.get.channel_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	auditRec.AddEventResultState(view)
	auditRec.AddEventObjectType("view")

	if err := json.NewEncoder(w).Encode(view); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateView(c *Context, w http.ResponseWriter, r *http.Request) {
	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId().RequireViewId()
	if c.Err != nil {
		return
	}

	var patch *model.ViewPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("viewPatch", err)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateView", "api.view.update.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateView, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "view_id", c.Params.ViewId)

	if !checkViewWritePermission(c, channel) {
		return
	}

	view, appErr := c.App.GetView(c.AppContext, c.Params.ViewId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if view.ChannelId != c.Params.ChannelId {
		c.Err = model.NewAppError("updateView", "api.view.update.channel_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	auditRec.AddEventPriorState(view.Clone())

	updated, appErr := c.App.UpdateView(c.AppContext, view, patch, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updated)
	auditRec.AddEventObjectType("view")
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteView(c *Context, w http.ResponseWriter, r *http.Request) {
	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId().RequireViewId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("deleteView", "api.view.delete.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteView, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "view_id", c.Params.ViewId)

	if !checkViewWritePermission(c, channel) {
		return
	}

	view, appErr := c.App.GetView(c.AppContext, c.Params.ViewId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if view.ChannelId != c.Params.ChannelId {
		c.Err = model.NewAppError("deleteView", "api.view.delete.channel_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	auditRec.AddEventPriorState(view)

	if appErr := c.App.DeleteView(c.AppContext, view, connectionID); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(view)
	auditRec.AddEventObjectType("view")
	c.LogAudit("")

	ReturnStatusOK(w)
}

func updateViewSortOrder(c *Context, w http.ResponseWriter, r *http.Request) {
	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId().RequireViewId()
	if c.Err != nil {
		return
	}

	var newSortOrder int64
	if err := json.NewDecoder(r.Body).Decode(&newSortOrder); err != nil {
		c.SetInvalidParamWithErr("viewSortOrder", err)
		return
	}

	if newSortOrder < 0 {
		c.SetInvalidParam("viewSortOrder")
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateViewSortOrder", "api.view.update_sort_order.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateViewSortOrder, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "view_id", c.Params.ViewId)

	if !checkViewWritePermission(c, channel) {
		return
	}

	views, appErr := c.App.UpdateViewSortOrder(c.AppContext, c.Params.ViewId, c.Params.ChannelId, newSortOrder, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, v := range views {
		if v.Id == c.Params.ViewId {
			auditRec.AddEventResultState(v)
			auditRec.AddEventObjectType("view")
			break
		}
	}
	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(views); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// checkViewWritePermission checks that the user has permission to write (create/update/delete) views
// in the given channel. Returns true if permission is granted, false otherwise (with c.Err set).
func checkViewWritePermission(c *Context, channel *model.Channel) bool {
	switch channel.Type {
	case model.ChannelTypeOpen:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePublicChannelProperties); !ok {
			c.SetPermissionError(model.PermissionManagePublicChannelProperties)
			return false
		}
	case model.ChannelTypePrivate:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePrivateChannelProperties); !ok {
			c.SetPermissionError(model.PermissionManagePrivateChannelProperties)
			return false
		}
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("checkViewWritePermission", "api.view.write.dm_gm.forbidden.app_error", nil, "", http.StatusForbidden).Wrap(errGet)
			return false
		}
		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return false
		}
		if user.IsGuest() {
			c.Err = model.NewAppError("checkViewWritePermission", "api.view.write.guest.forbidden.app_error", nil, "", http.StatusForbidden)
			return false
		}
	default:
		c.Err = model.NewAppError("checkViewWritePermission", "api.view.write.forbidden.app_error", nil, "", http.StatusForbidden)
		return false
	}
	return true
}
