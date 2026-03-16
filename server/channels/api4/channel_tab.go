// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// deprecated wraps a handler to add Deprecation and Sunset headers for old /bookmarks routes.
func deprecated(handler func(*Context, http.ResponseWriter, *http.Request)) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Deprecation", "true")
		w.Header().Set("Sunset", "Mon, 01 Sep 2026 00:00:00 GMT")
		w.Header().Set("Link", `</api/v4/channels/{channel_id}/tabs>; rel="successor-version"`)
		handler(c, w, r)
	}
}

func (api *API) InitChannelTabs() {
	if api.srv.Config().FeatureFlags.ChannelTabs {
		// Primary /tabs routes
		api.BaseRoutes.ChannelTabs.Handle("", api.APISessionRequired(createChannelTab)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelTab.Handle("", api.APISessionRequired(updateChannelTab)).Methods(http.MethodPatch)
		api.BaseRoutes.ChannelTab.Handle("/sort_order", api.APISessionRequired(updateChannelTabSortOrder)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelTab.Handle("", api.APISessionRequired(deleteChannelTab)).Methods(http.MethodDelete)
		api.BaseRoutes.ChannelTabs.Handle("", api.APISessionRequired(listChannelTabsForChannel)).Methods(http.MethodGet)

		// Deprecated /bookmarks routes — remove Sept 2026
		api.BaseRoutes.ChannelTabsDeprecated.Handle("", api.APISessionRequired(deprecated(createChannelTab))).Methods(http.MethodPost)
		api.BaseRoutes.ChannelTabDeprecated.Handle("", api.APISessionRequired(deprecated(updateChannelTab))).Methods(http.MethodPatch)
		api.BaseRoutes.ChannelTabDeprecated.Handle("/sort_order", api.APISessionRequired(deprecated(updateChannelTabSortOrder))).Methods(http.MethodPost)
		api.BaseRoutes.ChannelTabDeprecated.Handle("", api.APISessionRequired(deprecated(deleteChannelTab))).Methods(http.MethodDelete)
		api.BaseRoutes.ChannelTabsDeprecated.Handle("", api.APISessionRequired(deprecated(listChannelTabsForChannel))).Methods(http.MethodGet)
	}
}

func createChannelTab(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("createChannelTab", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

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
		c.Err = model.NewAppError("createChannelTab", "api.channel.bookmark.create_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	var channelTab *model.ChannelTab
	err := json.NewDecoder(r.Body).Decode(&channelTab)
	if err != nil || channelTab == nil {
		c.SetInvalidParamWithErr("channelTab", err)
		return
	}
	channelTab.ChannelId = c.Params.ChannelId

	auditRec := c.MakeAuditRecord(model.AuditEventCreateChannelTab, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channelTab", channelTab)

	switch channel.Type {
	case model.ChannelTypeOpen:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionAddTabPublicChannel); !ok {
			c.SetPermissionError(model.PermissionAddTabPublicChannel)
			return
		}

	case model.ChannelTypePrivate:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionAddTabPrivateChannel); !ok {
			c.SetPermissionError(model.PermissionAddTabPrivateChannel)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("createChannelTab", "api.channel.bookmark.create_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("createChannelTab", "api.channel.bookmark.create_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("createChannelTab", "api.channel.bookmark.create_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	newChannelTab, appErr := c.App.CreateChannelTab(c.AppContext, channelTab, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(newChannelTab)
	auditRec.AddEventObjectType("channelTabWithFileInfo")
	c.LogAudit("display_name=" + newChannelTab.DisplayName)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newChannelTab); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelTab(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("updateChannelTab", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var patch *model.ChannelTabPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("channelTabPatch", err)
		return
	}

	originalChannelTab, appErr := c.App.GetTab(c.Params.ChannelTabId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}
	patchedTab := originalChannelTab.Clone()
	auditRec := c.MakeAuditRecord(model.AuditEventUpdateChannelTab, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channelTab", patch)

	// The channel bookmark should belong to the same channel specified in the URL
	if patchedTab.ChannelId != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	auditRec.AddEventPriorState(originalChannelTab)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateChannelTab", "api.channel.bookmark.update_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	isMember := false
	switch channel.Type {
	case model.ChannelTypeOpen:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionEditTabPublicChannel)
		if !ok {
			c.SetPermissionError(model.PermissionEditTabPublicChannel)
			return
		}
		isMember = member

	case model.ChannelTypePrivate:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionEditTabPrivateChannel)
		if !ok {
			c.SetPermissionError(model.PermissionEditTabPrivateChannel)
			return
		}
		isMember = member

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("updateChannelTab", "api.channel.bookmark.update_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		isMember = true
		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("updateChannelTab", "api.channel.bookmark.update_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("updateChannelTab", "api.channel.bookmark.update_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	patchedTab.Patch(patch)
	updateChannelTabResponse, appErr := c.App.UpdateChannelTab(c.AppContext, patchedTab, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	auditRec.Success()
	auditRec.AddEventResultState(updateChannelTabResponse)
	auditRec.AddEventObjectType("updateChannelTabResponse")
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(updateChannelTabResponse); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelTabSortOrder(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("updateChannelTabSortOrder", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var newSortOrder int64
	if err := json.NewDecoder(r.Body).Decode(&newSortOrder); err != nil {
		c.SetInvalidParamWithErr("channelTabSortOrder", err)
		return
	}

	if newSortOrder < 0 {
		c.SetInvalidParam("channelTabSortOrder")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateChannelTabSortOrder, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", c.Params.ChannelTabId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateChannelTabSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	isMember := false
	switch channel.Type {
	case model.ChannelTypeOpen:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionOrderTabPublicChannel)
		if !ok {
			c.SetPermissionError(model.PermissionOrderTabPublicChannel)
			return
		}
		isMember = member
	case model.ChannelTypePrivate:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionOrderTabPrivateChannel)
		if !ok {
			c.SetPermissionError(model.PermissionOrderTabPrivateChannel)
			return
		}
		isMember = member
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("updateChannelTabSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		isMember = true
		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("updateChannelTabSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("updateChannelTabSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	bookmarks, appErr := c.App.UpdateChannelTabSortOrder(c.Params.ChannelTabId, c.Params.ChannelId, newSortOrder, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	for _, b := range bookmarks {
		if b.Id == c.Params.ChannelTabId {
			auditRec.AddEventResultState(b)
			auditRec.AddEventObjectType("channelTabWithFileInfo")
			break
		}
	}
	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteChannelTab(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("deleteChannelTab", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteChannelTab, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", c.Params.ChannelTabId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("deleteChannelTab", "api.channel.bookmark.delete_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	isMember := false
	switch channel.Type {
	case model.ChannelTypeOpen:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionDeleteTabPublicChannel)
		if !ok {
			c.SetPermissionError(model.PermissionDeleteTabPublicChannel)
			return
		}
		isMember = member
	case model.ChannelTypePrivate:
		ok, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionDeleteTabPrivateChannel)
		if !ok {
			c.SetPermissionError(model.PermissionDeleteTabPrivateChannel)
			return
		}
		isMember = member
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("deleteChannelTab", "api.channel.bookmark.delete_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		isMember = true
		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("deleteChannelTab", "api.channel.bookmark.delete_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("deleteChannelTab", "api.channel.bookmark.delete_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	oldTab, obErr := c.App.GetTab(c.Params.ChannelTabId, false)
	if obErr != nil {
		c.Err = obErr
		return
	}

	// The channel bookmark should belong to the same channel specified in the URL
	if oldTab.ChannelId != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}
	auditRec.AddEventPriorState(oldTab)

	bookmark, appErr := c.App.DeleteChannelTab(c.Params.ChannelTabId, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	auditRec.Success()
	auditRec.AddEventResultState(bookmark)
	c.LogAudit("bookmark=" + bookmark.DisplayName)

	if err := json.NewEncoder(w).Encode(bookmark); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listChannelTabsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("listChannelTabsForChannel", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	bookmarks, appErr := c.App.GetChannelTabs(c.Params.ChannelId, c.Params.TabsSince)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventListChannelTabsForChannel, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
