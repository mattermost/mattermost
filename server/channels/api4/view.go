// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

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
		api.BaseRoutes.ChannelViewPosts.Handle("", api.APISessionRequired(getPostsForView)).Methods(http.MethodGet)
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

	opts := model.ViewQueryOpts{
		Page:    c.Params.Page,
		PerPage: c.Params.PerPage,
	}

	views, appErr := c.App.GetViewsForChannel(c.AppContext, c.Params.ChannelId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.Params.IncludeTotalCount {
		totalCount, appErr := c.App.GetViewsCountForChannel(c.AppContext, c.Params.ChannelId, opts)
		if appErr != nil {
			c.Err = appErr
			return
		}
		vwc := &model.ViewsWithCount{
			Views:      views,
			TotalCount: totalCount,
		}
		if err := json.NewEncoder(w).Encode(vwc); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if err := json.NewEncoder(w).Encode(views); err != nil {
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
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionCreatePost); !ok {
		c.SetPermissionError(model.PermissionCreatePost)
		return false
	}
	return true
}

func getPostsForView(c *Context, w http.ResponseWriter, r *http.Request) {
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
		c.Err = model.NewAppError("getPostsForView", "api.view.get_posts.deleted_channel.app_error", nil, "channel has been deleted", http.StatusNotFound)
		return
	}

	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetPostsForView, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
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
		c.Err = model.NewAppError("getPostsForView", "api.view.get_posts.channel_mismatch.app_error", nil, "", http.StatusNotFound)
		return
	}

	// TODO: In the future, this will filter posts based on the view's configuration
	// (e.g., property values, sort order). For now, it returns all posts in the channel.
	options := model.GetPostsOptions{
		ChannelId: c.Params.ChannelId,
		Page:      c.Params.Page,
		PerPage:   c.Params.PerPage,
		UserId:    c.AppContext.Session().UserId,
	}

	list, appErr := c.App.GetPostsForView(c.AppContext, options)
	if appErr != nil {
		c.Err = appErr
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, list)
	clientPostList, isMemberForAllPreviews, appErr := c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMemberForAllPreviews {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access_on_previews", true)
	}
	auditRec.Success()

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
