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

func (api *API) InitReaction() {
	api.BaseRoutes.Reactions.Handle("", api.APISessionRequired(saveReaction)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("/reactions", api.APISessionRequired(getReactions)).Methods(http.MethodGet)
	api.BaseRoutes.ReactionByNameForPostForUser.Handle("", api.APISessionRequired(deleteReaction)).Methods(http.MethodDelete)
	api.BaseRoutes.Posts.Handle("/ids/reactions", api.APISessionRequired(getBulkReactions)).Methods(http.MethodPost)
	api.BaseRoutes.TeamForUser.Handle("/activity/reactions", api.APISessionRequired(getReceivedReactions)).Methods(http.MethodGet)
	api.BaseRoutes.TeamForUser.Handle("/activity/broadcast_mentions", api.APISessionRequired(getBroadcastMentions)).Methods(http.MethodGet)
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	var reaction model.Reaction
	if jsonErr := json.NewDecoder(r.Body).Decode(&reaction); jsonErr != nil {
		c.SetInvalidParamWithErr("reaction", jsonErr)
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
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), c.Params.PostId); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	reactions, appErr := c.App.GetReactionsForPost(c.Params.PostId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(reactions)
	if err != nil {
		c.Err = model.NewAppError("getReactions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequirePostId().RequireEmojiName()
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

func getReceivedReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	limit := 30
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil {
			limit = parsed
		}
	}

	reactions, appErr := c.App.GetReceivedReactions(c.AppContext, c.Params.UserId, c.Params.TeamId, limit)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(reactions)
	if err != nil {
		c.Err = model.NewAppError("getReceivedReactions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}

func getBroadcastMentions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	limit := 30
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil {
			limit = parsed
		}
	}

	posts, appErr := c.App.GetBroadcastMentions(c.Params.UserId, c.Params.TeamId, limit)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(posts)
	if err != nil {
		c.Err = model.NewAppError("getBroadcastMentions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}

func getBulkReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	postIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getBulkReactions", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	for _, postId := range postIds {
		if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), postId); !ok {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	}
	reactions, appErr := c.App.GetBulkReactionsForPosts(postIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(reactions)
	if err != nil {
		c.Err = model.NewAppError("getBulkReactions", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing js response", mlog.Err(err))
	}
}
