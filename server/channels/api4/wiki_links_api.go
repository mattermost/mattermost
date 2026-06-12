// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitWikiLinks() {
	api.BaseRoutes.WikiLinks.Handle("", api.APISessionRequired(linkWikiToChannel)).Methods(http.MethodPost)
	api.BaseRoutes.WikiLinks.Handle("", api.APISessionRequired(getWikiLinksForChannel)).Methods(http.MethodGet)
	api.BaseRoutes.WikiLink.Handle("", api.APISessionRequired(unlinkWikiFromChannel)).Methods(http.MethodDelete)
	api.BaseRoutes.Wiki.Handle("/links", api.APISessionRequired(getWikiLinksByWiki)).Methods(http.MethodGet)
}

// checkWikiLinkBookmarkPermission checks that the session has the appropriate bookmark permission
// on the channel for wiki link/unlink operations. Wiki link/unlink use bookmark permissions as
// the authorization gate to avoid proliferating new permissions.
func checkWikiLinkBookmarkPermission(c *Context, channel *model.Channel, publicPerm, privatePerm *model.Permission, caller string) bool {
	session := c.AppContext.Session()
	switch channel.Type {
	case model.ChannelTypeOpen:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, publicPerm); !ok {
			c.SetPermissionError(publicPerm)
			return false
		}
	case model.ChannelTypePrivate:
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, privatePerm); !ok {
			c.SetPermissionError(privatePerm)
			return false
		}
	default:
		c.Err = model.NewAppError(caller, "api.wiki_link.invalid_source_channel_type", nil, "", http.StatusBadRequest)
		return false
	}
	return true
}

// checkWikiSameTeam verifies that the wiki belongs to the same team as the channel and that
// the session has team visibility. Always returns 404 to prevent enumeration.
func checkWikiSameTeam(c *Context, wiki *model.Wiki, channel *model.Channel, caller string) bool {
	session := c.AppContext.Session()
	if !c.App.SessionHasPermissionToTeam(*session, wiki.TeamId, model.PermissionViewTeam) || wiki.TeamId != channel.TeamId {
		c.Err = model.NewAppError(caller, "api.wiki_link.cross_team_not_allowed", nil, "", http.StatusNotFound)
		return false
	}
	return true
}

func resolveAndAuthorizeWikiLink(c *Context, channelId, wikiId string, publicPerm, privatePerm *model.Permission, caller string) (*model.Channel, *model.Wiki, bool) {
	channel, appErr := c.App.GetChannel(c.AppContext, channelId)
	if appErr != nil {
		c.Err = appErr
		return nil, nil, false
	}

	if !checkWikiLinkBookmarkPermission(c, channel, publicPerm, privatePerm, caller) {
		return nil, nil, false
	}

	wiki, appErr := c.App.GetWiki(c.AppContext, wikiId)
	if appErr != nil {
		c.Err = appErr
		return nil, nil, false
	}

	if !checkWikiSameTeam(c, wiki, channel, caller) {
		return nil, nil, false
	}

	backingChannel, appErr := c.App.GetWikiBackingChannel(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return nil, nil, false
	}
	if !c.CheckWikiModifyPermission(backingChannel) {
		// Return 404 to prevent confirming wiki existence to unauthorized callers.
		c.Err = model.NewAppError(caller, "api.wiki_link.not_found", nil, "", http.StatusNotFound)
		return nil, nil, false
	}

	return channel, wiki, true
}

func linkWikiToChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	auditRec := c.MakeAuditRecord(model.AuditEventLinkWikiToChannel, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("channel_id", c.Params.ChannelId)

	var req struct {
		WikiId string `json:"wiki_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if !model.IsValidId(req.WikiId) {
		c.SetInvalidParam("wiki_id")
		return
	}
	auditRec.AddMeta("wiki_id", req.WikiId)

	_, wiki, ok := resolveAndAuthorizeWikiLink(c, c.Params.ChannelId, req.WikiId, model.PermissionAddBookmarkPublicChannel, model.PermissionAddBookmarkPrivateChannel, "linkWikiToChannel")
	if !ok {
		return
	}

	link, appErr := c.App.LinkWikiToChannelWithWiki(c.AppContext, wiki, c.Params.ChannelId, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(link)
	auditRec.AddEventObjectType("wiki_link")
	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(link); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getWikiLinksForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if hasPermission, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	links, appErr := c.App.GetWikiLinksForChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(links); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getWikiLinksByWiki returns all WikiLinks pointing to the wiki's backing channel.
// The client uses this to populate linksByChannel for ALL source channels that link
// to the wiki, so that permission checks (canEdit) and sidebar resolution work
// after a fresh page load on a deep wiki URL — without depending on a ?from= URL
// parameter that may or may not be present.
//
// Auth: same as getWiki — user must have read access to the wiki. The links payload
// itself is not sensitive once the user can read the wiki.
func getWikiLinksByWiki(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	wiki, _, ok := c.GetWikiForRead()
	if !ok {
		return
	}

	// Team-only wikis (no backing channel) have no links.
	if wiki.ChannelId == "" {
		if err := json.NewEncoder(w).Encode([]*model.WikiLink{}); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	links, appErr := c.App.GetWikiLinksByDestination(c.AppContext, wiki.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Collect source channel IDs so we can batch-fetch and filter by read access.
	sourceIds := make([]string, 0, len(links))
	for _, link := range links {
		sourceIds = append(sourceIds, link.SourceId)
	}

	var readable map[string]bool
	if len(sourceIds) > 0 {
		channels, appErr := c.App.GetChannels(c.AppContext, sourceIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
		readable = make(map[string]bool, len(channels))
		session := *c.AppContext.Session()
		for _, ch := range channels {
			if has, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, session, ch); has {
				readable[ch.Id] = true
			}
		}
	}

	// Filter links and stamp WikiId; only expose source channels the caller can read.
	filtered := make([]*model.WikiLink, 0, len(links))
	for _, link := range links {
		if readable[link.SourceId] {
			link.WikiId = wiki.Id
			filtered = append(filtered, link)
		}
	}

	if err := json.NewEncoder(w).Encode(filtered); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unlinkWikiFromChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	c.RequireWikiId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUnlinkWikiFromChannel, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddMeta("channel_id", c.Params.ChannelId)
	auditRec.AddMeta("wiki_id", c.Params.WikiId)

	_, wiki, ok := resolveAndAuthorizeWikiLink(c, c.Params.ChannelId, c.Params.WikiId, model.PermissionDeleteBookmarkPublicChannel, model.PermissionDeleteBookmarkPrivateChannel, "unlinkWikiFromChannel")
	if !ok {
		return
	}

	auditRec.AddEventPriorState(wiki)

	if appErr := c.App.UnlinkWikiFromChannel(c.AppContext, c.Params.ChannelId, wiki.ChannelId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventObjectType("wiki_link")
	auditRec.Success()

	ReturnStatusOK(w)
}
