// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// bookmarkOp identifies which bookmark operation a permission check is for.
type bookmarkOp int

const (
	bookmarkOpCreate bookmarkOp = iota
	bookmarkOpEdit
	bookmarkOpOrder
	bookmarkOpDelete
)

type bookmarkOpInfo struct {
	publicPerm  *model.Permission
	privatePerm *model.Permission
	// i18nPrefix is the per-op segment in error keys, e.g. "create_channel_bookmark".
	i18nPrefix string
}

var bookmarkOps = map[bookmarkOp]bookmarkOpInfo{
	bookmarkOpCreate: {model.PermissionAddBookmarkPublicChannel, model.PermissionAddBookmarkPrivateChannel, "create_channel_bookmark"},
	bookmarkOpEdit:   {model.PermissionEditBookmarkPublicChannel, model.PermissionEditBookmarkPrivateChannel, "update_channel_bookmark"},
	bookmarkOpOrder:  {model.PermissionOrderBookmarkPublicChannel, model.PermissionOrderBookmarkPrivateChannel, "update_channel_bookmark_sort_order"},
	bookmarkOpDelete: {model.PermissionDeleteBookmarkPublicChannel, model.PermissionDeleteBookmarkPrivateChannel, "delete_channel_bookmark"},
}

// requireBookmarkPermission enforces the channel-type-specific permission policy
// for a bookmark op. Returns (isMember, ok). ok=false means c.Err was set.
func requireBookmarkPermission(c *Context, channel *model.Channel, handlerName string, op bookmarkOp) (isMember, ok bool) {
	info := bookmarkOps[op]
	keyPrefix := "api.channel.bookmark." + info.i18nPrefix
	switch channel.Type {
	case model.ChannelTypeOpen:
		hasPerm, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, info.publicPerm)
		if !hasPerm {
			c.SetPermissionError(info.publicPerm)
			return false, false
		}
		return member, true

	case model.ChannelTypePrivate:
		hasPerm, member := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, info.privatePerm)
		if !hasPerm {
			c.SetPermissionError(info.privatePerm)
			return false, false
		}
		return member, true

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Any member of DM/GMs but guests can manage channel bookmarks.
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError(handlerName, keyPrefix+".direct_or_group_channels.forbidden.app_error", nil, "", http.StatusForbidden)
			return false, false
		}
		user, gAppErr := c.App.GetUser(c.AppContext.Session().UserId)
		if gAppErr != nil {
			c.Err = gAppErr
			return false, false
		}
		if user.IsGuest() {
			c.Err = model.NewAppError(handlerName, keyPrefix+".direct_or_group_channels_by_guests.forbidden.app_error", nil, "", http.StatusForbidden)
			return false, false
		}
		return true, true

	default:
		c.Err = model.NewAppError(handlerName, keyPrefix+".forbidden.app_error", nil, "", http.StatusForbidden)
		return false, false
	}
}

func (api *API) InitChannelBookmarks() {
	if api.srv.Config().FeatureFlags.ChannelBookmarks {
		api.BaseRoutes.ChannelBookmarks.Handle("", api.APISessionRequired(createChannelBookmark)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelBookmark.Handle("", api.APISessionRequired(updateChannelBookmark)).Methods(http.MethodPatch)
		api.BaseRoutes.ChannelBookmark.Handle("/sort_order", api.APISessionRequired(updateChannelBookmarkSortOrder)).Methods(http.MethodPost)
		api.BaseRoutes.ChannelBookmark.Handle("", api.APISessionRequired(deleteChannelBookmark)).Methods(http.MethodDelete)
		api.BaseRoutes.ChannelBookmarks.Handle("", api.APISessionRequired(listChannelBookmarksForChannel)).Methods(http.MethodGet)
		api.BaseRoutes.ChannelBookmarks.Handle("/from-page", api.APISessionRequired(createBookmarkFromPage)).Methods(http.MethodPost)
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

	auditRec := c.MakeAuditRecord(model.AuditEventCreateChannelBookmark, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channelBookmark", channelBookmark)

	if _, ok := requireBookmarkPermission(c, channel, "createChannelBookmark", bookmarkOpCreate); !ok {
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
	auditRec := c.MakeAuditRecord(model.AuditEventUpdateChannelBookmark, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channelBookmark", patch)

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

	isMember, ok := requireBookmarkPermission(c, channel, "updateChannelBookmark", bookmarkOpEdit)
	if !ok {
		return
	}

	patchedBookmark.Patch(patch)
	updateChannelBookmarkResponse, appErr := c.App.UpdateChannelBookmark(c.AppContext, patchedBookmark, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
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

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateChannelBookmarkSortOrder, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", c.Params.ChannelBookmarkId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("updateChannelBookmarkSortOrder", "api.channel.bookmark.update_channel_bookmark_sort_order.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	isMember, ok := requireBookmarkPermission(c, channel, "updateChannelBookmarkSortOrder", bookmarkOpOrder)
	if !ok {
		return
	}

	bookmarks, appErr := c.App.UpdateChannelBookmarkSortOrder(c.Params.ChannelBookmarkId, c.Params.ChannelId, newSortOrder, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
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

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteChannelBookmark, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", c.Params.ChannelBookmarkId)

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("deleteChannelBookmark", "api.channel.bookmark.delete_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	isMember, ok := requireBookmarkPermission(c, channel, "deleteChannelBookmark", bookmarkOpDelete)
	if !ok {
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

	hasPermission, isMember := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	bookmarks, appErr := c.App.GetChannelBookmarks(c.Params.ChannelId, c.Params.BookmarksSince)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventListChannelBookmarksForChannel, model.AuditStatusSuccess)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	if !isMember {
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createBookmarkFromPage(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("createBookmarkFromPage", "api.channel.bookmark.channel_bookmark.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var req struct {
		PageId      string `json:"page_id"`
		DisplayName string `json:"display_name,omitempty"`
		Emoji       string `json:"emoji,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("request", err)
		return
	}

	if req.PageId == "" || !model.IsValidId(req.PageId) {
		c.SetInvalidParam("page_id")
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("createBookmarkFromPage", "api.channel.bookmark.create_channel_bookmark.deleted_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateChannelBookmark, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if _, ok := requireBookmarkPermission(c, channel, "createBookmarkFromPage", bookmarkOpCreate); !ok {
		return
	}

	page, appErr := c.App.GetPage(c.AppContext, req.PageId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Verify the caller can read the source page before exposing its title in
	// the bookmark display name.
	wiki, wErr := c.App.GetWikiByChannelId(c.AppContext, page.ChannelId)
	if wErr != nil {
		c.Err = wErr
		return
	}
	if !c.App.SessionHasPagePermission(*c.AppContext.Session(), wiki, page, model.PermissionReadPage) {
		c.SetPermissionError(model.PermissionReadPage)
		return
	}

	bookmark, appErr := c.App.CreateBookmarkFromPage(c.AppContext, page, c.Params.ChannelId, req.DisplayName, req.Emoji, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(bookmark)
	auditRec.AddEventObjectType("channelBookmarkWithFileInfo")
	c.LogAudit("display_name=" + bookmark.DisplayName)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(bookmark); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
