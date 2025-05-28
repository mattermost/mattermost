// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitChannelBookmarks() {
	if api.srv.Config().FeatureFlags.ChannelBookmarks {
		api.BaseRoutes.ChannelBookmarks.Handle("", api.APISessionRequired(createChannelBookmark)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelBookmark.Handle("", api.APISessionRequired(updateChannelBookmark)).Methods(http.MethodPatch)
		api.BaseRoutes.ChannelBookmark.Handle("/sort_order", api.APISessionRequired(updateChannelBookmarkSortOrder)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelBookmark.Handle("", api.APISessionRequired(deleteChannelBookmark)).Methods(http.MethodDelete)
		api.BaseRoutes.ChannelBookmarks.Handle("", api.APISessionRequired(listChannelBookmarksForChannel)).Methods(http.MethodGet)
	}
}

func createChannelBookmark(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
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
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	var channelBookmark *model.ChannelBookmark
	err := json.NewDecoder(r.Body).Decode(&channelBookmark)
	if err != nil || channelBookmark == nil {
		c.SetInvalidParamWithErr("channelBookmark", err)
		return
	}
	channelBookmark.ChannelId = c.Params.ChannelId

	auditRec := c.MakeAuditRecord("createChannelBookmark", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "channelBookmark", channelBookmark)

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionAddBookmarkPublicChannel) {
			c.SetPermissionError(model.PermissionAddBookmarkPublicChannel)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionAddBookmarkPrivateChannel) {
			c.SetPermissionError(model.PermissionAddBookmarkPrivateChannel)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	newChannelBookmark, appErr := c.App.CreateChannelBookmark(c.AppContext, channelBookmark, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(newChannelBookmark)
	auditRec.AddEventObjectType("channelBookmarkWithFileInfo")
	c.LogAudit("display_name=" + newChannelBookmark.DisplayName)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newChannelBookmark); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelBookmark(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var patch *model.ChannelBookmarkPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("channelBookmarkPatch", err)
		return
	}

	originalChannelBookmark, appErr := c.App.GetBookmark(c.Params.ChannelBookmarkId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}
	patchedBookmark := originalChannelBookmark.Clone()
	auditRec := c.MakeAuditRecord("updateChannelBookmark", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "channelBookmark", patch)

	// The channel bookmark should belong to the same channel specified in the URL
	if patchedBookmark.ChannelId != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	auditRec.AddEventPriorState(originalChannelBookmark)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.update_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionEditBookmarkPublicChannel) {
			c.SetPermissionError(model.PermissionEditBookmarkPublicChannel)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionEditBookmarkPrivateChannel) {
			c.SetPermissionError(model.PermissionEditBookmarkPrivateChannel)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.update_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.update_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.update_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	patchedBookmark.Patch(patch)
	updateChannelBookmarkResponse, appErr := c.App.UpdateChannelBookmark(c.AppContext, patchedBookmark, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updateChannelBookmarkResponse)
	auditRec.AddEventObjectType("updateChannelBookmarkResponse")
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(updateChannelBookmarkResponse); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelBookmarkSortOrder(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var newSortOrder int64
	if err := json.NewDecoder(r.Body).Decode(&newSortOrder); err != nil {
		c.SetInvalidParamWithErr("channelBookmarkSortOrder", err)
		return
	}

	if newSortOrder < 0 {
		c.SetInvalidParam("channelBookmarkSortOrder")
		return
	}

	auditRec := c.MakeAuditRecord("updateChannelBookmarkSortOrder", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "id", c.Params.ChannelBookmarkId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionOrderBookmarkPublicChannel) {
			c.SetPermissionError(model.PermissionOrderBookmarkPublicChannel)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionOrderBookmarkPrivateChannel) {
			c.SetPermissionError(model.PermissionOrderBookmarkPrivateChannel)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	bookmarks, appErr := c.App.UpdateChannelBookmarkSortOrder(c.Params.ChannelBookmarkId, c.Params.ChannelId, newSortOrder, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, b := range bookmarks {
		if b.Id == c.Params.ChannelBookmarkId {
			auditRec.AddEventResultState(b)
			auditRec.AddEventObjectType("channelBookmarkWithFileInfo")
			break
		}
	}
	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteChannelBookmark(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteChannelBookmark", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "id", c.Params.ChannelBookmarkId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.delete_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	switch channel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionDeleteBookmarkPublicChannel) {
			c.SetPermissionError(model.PermissionDeleteBookmarkPublicChannel)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionDeleteBookmarkPrivateChannel) {
			c.SetPermissionError(model.PermissionDeleteBookmarkPrivateChannel)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.delete_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, errGet.Message, http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.delete_channel_bookmark.direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.delete_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	oldBookmark, obErr := c.App.GetBookmark(c.Params.ChannelBookmarkId, false)
	if obErr != nil {
		c.Err = obErr
		return
	}

	// The channel bookmark should belong to the same channel specified in the URL
	if oldBookmark.ChannelId != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}
	auditRec.AddEventPriorState(oldBookmark)

	bookmark, appErr := c.App.DeleteChannelBookmark(c.Params.ChannelBookmarkId, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(bookmark)
	c.LogAudit("bookmark=" + bookmark.DisplayName)

	if err := json.NewEncoder(w).Encode(bookmark); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func listChannelBookmarksForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("listChannelBookmarksForChannel", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
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

	if !*c.App.Config().TeamSettings.ExperimentalViewArchivedChannels {
		if channel.DeleteAt != 0 {
			c.Err = model.NewAppError("listChannelBookmarksForChannel", "api.user.view_archived_channels.list_channel_bookmarks_for_channel.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	bookmarks, appErr := c.App.GetChannelBookmarks(c.Params.ChannelId, c.Params.BookmarksSince)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
