// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitReaction() {
	api.BaseRoutes.Reactions.Handle("", api.ApiSessionRequired(saveReaction)).Methods("POST")
	api.BaseRoutes.Post.Handle("/reactions", api.ApiSessionRequired(getReactions)).Methods("GET")
	api.BaseRoutes.ReactionByNameForPostForUser.Handle("", api.ApiSessionRequired(deleteReaction)).Methods("DELETE")
	api.BaseRoutes.Posts.Handle("/ids/reactions", api.ApiSessionRequired(getBulkReactions)).Methods("POST")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("reaction")
		return
	}

	if !model.IsValidId(reaction.UserId) || !model.IsValidId(reaction.PostId) || reaction.EmojiName == "" || len(reaction.EmojiName) > model.EMOJI_NAME_MAX_LENGTH {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.invalid.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if reaction.UserId != c.App.Session().UserId {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.App.Session(), reaction.PostId, model.PERMISSION_ADD_REACTION) {
		c.SetPermissionError(model.PERMISSION_ADD_REACTION)
		return
	}

	reaction, err := c.App.SaveReactionForPost(reaction)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(reaction.ToJson()))
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.App.Session(), c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	reactions, err := c.App.GetReactionsForPost(c.Params.PostId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ReactionsToJson(reactions)))
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

	if !c.App.SessionHasPermissionToChannelByPost(*c.App.Session(), c.Params.PostId, model.PERMISSION_REMOVE_REACTION) {
		c.SetPermissionError(model.PERMISSION_REMOVE_REACTION)
		return
	}

	if c.Params.UserId != c.App.Session().UserId && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_REMOVE_OTHERS_REACTIONS) {
		c.SetPermissionError(model.PERMISSION_REMOVE_OTHERS_REACTIONS)
		return
	}

	reaction := &model.Reaction{
		UserId:    c.Params.UserId,
		PostId:    c.Params.PostId,
		EmojiName: c.Params.EmojiName,
	}

	err := c.App.DeleteReactionForPost(reaction)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getBulkReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	postIds := model.ArrayFromJson(r.Body)
	for _, postId := range postIds {
		if !c.App.SessionHasPermissionToChannelByPost(*c.App.Session(), postId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}
	reactions, err := c.App.GetBulkReactionsForPosts(postIds)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.MapPostIdToReactionsToJson(reactions)))
}
