// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func (api *API) InitDrafts() {
	api.BaseRoutes.Drafts.Handle("", api.APISessionRequired(upsertDraft)).Methods("POST")

	api.BaseRoutes.TeamForUser.Handle("/drafts", api.APISessionRequired(getDrafts)).Methods("GET")

	api.BaseRoutes.ChannelForUser.Handle("/drafts/{thread_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteDraft)).Methods("DELETE")
	api.BaseRoutes.ChannelForUser.Handle("/drafts", api.APISessionRequired(deleteDraft)).Methods("DELETE")
}

func upsertDraft(c *Context, w http.ResponseWriter, r *http.Request) {

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("upsertDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	var draft model.Draft
	if jsonErr := json.NewDecoder(r.Body).Decode(&draft); jsonErr != nil {
		c.SetInvalidParam("draft")
		return
	}

	draft.DeleteAt = 0
	draft.UserId = c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)

	hasPermission := false

	if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), draft.ChannelId, model.PermissionCreatePost) {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, draft.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	dt, err := c.App.UpsertDraft(c.AppContext, &draft, connectionID)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)

	if err := json.NewEncoder(w).Encode(dt); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getDrafts(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("getDrafts", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	hasPermission := false

	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		hasPermission = true
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	drafts, err := c.App.GetDraftsForUser(c.AppContext.Session().UserId, c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(drafts); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteDraft(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.AllowSyncedDrafts {
		c.Err = model.NewAppError("deleteDraft", "api.drafts.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	rootID := ""

	connectionID := r.Header.Get(model.ConnectionId)

	if c.Params.ThreadId != "" {
		rootID = c.Params.ThreadId
	}

	userID := c.AppContext.Session().UserId
	channelID := c.Params.ChannelId

	draft, err := c.App.GetDraft(userID, channelID, rootID)
	if err != nil {
		switch {
		case err.StatusCode == http.StatusNotFound:
			// If the draft doesn't exist in the server, we don't need to delete.
			ReturnStatusOK(w)
		default:
			c.Err = err
		}
		return
	}

	if c.AppContext.Session().UserId != draft.UserId {
		c.SetPermissionError(model.PermissionDeletePost)
		return
	}

	if _, err := c.App.DeleteDraft(userID, channelID, rootID, connectionID); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
