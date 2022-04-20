// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitReaction() {
	api.BaseRoutes.Reactions.Handle("", api.APISessionRequired(saveReaction)).Methods("POST")
	api.BaseRoutes.Post.Handle("/reactions", api.APISessionRequired(getReactions)).Methods("GET")
	api.BaseRoutes.ReactionByNameForPostForUser.Handle("", api.APISessionRequired(deleteReaction)).Methods("DELETE")
	api.BaseRoutes.Posts.Handle("/ids/reactions", api.APISessionRequired(getBulkReactions)).Methods("POST")

	api.BaseRoutes.Team.Handle("/top/reactions", api.APISessionRequired(getTopReactionsForTeamSince)).Methods("GET")
	api.BaseRoutes.Users.Handle("/me/top/reactions", api.APISessionRequired(getTopReactionsForUserSince)).Methods("GET")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	var reaction model.Reaction
	if jsonErr := json.NewDecoder(r.Body).Decode(&reaction); jsonErr != nil {
		c.SetInvalidParam("reaction")
		return
	}

	if !model.IsValidId(reaction.UserId) || !model.IsValidId(reaction.PostId) || reaction.EmojiName == "" || len(reaction.EmojiName) > model.EmojiNameMaxLength {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.invalid.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if reaction.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), reaction.PostId, model.PermissionAddReaction) {
		c.SetPermissionError(model.PermissionAddReaction)
		return
	}

	re, err := c.App.SaveReactionForPost(c.AppContext, &reaction)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(re); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	reactions, err := c.App.GetReactionsForPost(c.Params.PostId)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(reactions)
	if jsonErr != nil {
		c.Err = model.NewAppError("getReactions", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	c.RequireEmojiName()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionRemoveReaction) {
		c.SetPermissionError(model.PermissionRemoveReaction)
		return
	}

	if c.Params.UserId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveOthersReactions) {
		c.SetPermissionError(model.PermissionRemoveOthersReactions)
		return
	}

	reaction := &model.Reaction{
		UserId:    c.Params.UserId,
		PostId:    c.Params.PostId,
		EmojiName: c.Params.EmojiName,
	}

	err := c.App.DeleteReactionForPost(c.AppContext, reaction)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getBulkReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	postIds := model.ArrayFromJSON(r.Body)
	for _, postId := range postIds {
		if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), postId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}
	reactions, err := c.App.GetBulkReactionsForPosts(postIds)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(reactions)
	if jsonErr != nil {
		c.Err = model.NewAppError("getBulkReactions", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func getTopReactionsForTeamSince(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireTimeRange()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	if (!team.AllowOpenInvite || team.Type != model.TeamOpen) && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), team.Id, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	topReactionList, err := c.App.GetTopReactionsForTeamSince(c.Params.TeamId, c.AppContext.Session().UserId, &model.InsightsOpts{
		StartUnixMilli: c.Params.TimeRange,
		Page:           c.Params.Page,
		PerPage:        c.Params.PerPage,
	})
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(topReactionList)
	if jsonErr != nil {
		c.Err = model.NewAppError("getTopReactionsForTeamSince", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(js)
}

func getTopReactionsForUserSince(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTimeRange()
	if c.Err != nil {
		return
	}

	c.Params.TeamId = r.URL.Query().Get("team_id")

	// TeamId is an optional parameter
	if c.Params.TeamId != "" {
		if !model.IsValidId(c.Params.TeamId) {
			c.SetInvalidURLParam("team_id")
			return
		}

		team, teamErr := c.App.GetTeam(c.Params.TeamId)
		if teamErr != nil {
			c.Err = teamErr
			return
		}

		if (!team.AllowOpenInvite || team.Type != model.TeamOpen) && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), team.Id, model.PermissionViewTeam) {
			c.SetPermissionError(model.PermissionViewTeam)
			return
		}
	}

	topReactionList, err := c.App.GetTopReactionsForUserSince(c.AppContext.Session().UserId, c.Params.TeamId, &model.InsightsOpts{
		StartUnixMilli: c.Params.TimeRange,
		Page:           c.Params.Page,
		PerPage:        c.Params.PerPage,
	})
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(topReactionList)
	if jsonErr != nil {
		c.Err = model.NewAppError("getTopReactionsForUserSince", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(js)
}
