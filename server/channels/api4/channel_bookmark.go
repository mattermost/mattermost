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
	api.BaseRoutes.ChannelBookmarks.Handle("", api.APISessionRequired(createChannelBookmark)).Methods("POST")
	api.BaseRoutes.ChannelBookmark.Handle("", api.APISessionRequired(updateChannelBookmark)).Methods("PATCH")
}

func createChannelBookmark(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusForbidden)
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
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.update_direct_or_group_channels.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.update_direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.create_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
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

	newChannelBookmark, appErr := c.App.CreateChannelBookmark(c.AppContext, channelBookmark, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(newChannelBookmark)
	auditRec.AddEventObjectType("channelBookmark")
	c.LogAudit("display_name=" + newChannelBookmark.DisplayName)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(newChannelBookmark); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelBookmark(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("updateChannelBookmark", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusForbidden)
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

	// The channel bookmark belong to the same channel specified in the URL
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
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.update_channel_bookmark.direct_or_group_channels.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return
		}

		if user.IsGuest() {
			c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.update_channel_bookmark.update_direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("createChannelBookmark", "api.channel.bookmark.update_channel_bookmark.forbidden.app_error", nil, "", http.StatusForbidden)
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
