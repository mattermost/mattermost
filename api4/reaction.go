// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitReaction() {
	l4g.Debug(utils.T("api.reaction.init.debug"))

	BaseRoutes.Reactions.Handle("", ApiSessionRequired(saveReaction)).Methods("POST")
	BaseRoutes.Post.Handle("/reactions", ApiSessionRequired(getReactions)).Methods("GET")
	BaseRoutes.ReactionByNameForPostForUser.Handle("", ApiSessionRequired(deleteReaction)).Methods("DELETE")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("reaction")
		return
	}

	if len(reaction.UserId) != 26 || len(reaction.PostId) != 26 || len(reaction.EmojiName) == 0 || len(reaction.EmojiName) > 64 {
		c.Err = model.NewLocAppError("saveReaction", "api.reaction.save_reaction.invalid.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if reaction.UserId != c.Session.UserId {
		c.Err = model.NewLocAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, reaction.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if reaction, err := app.SaveReactionForPost(reaction); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(reaction.ToJson()))
		return
	}
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if reactions, err := app.GetReactionsForPost(c.Params.PostId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.ReactionsToJson(reactions)))
		return
	}
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

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if c.Params.UserId != c.Session.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	reaction := &model.Reaction{
		UserId:    c.Params.UserId,
		PostId:    c.Params.PostId,
		EmojiName: c.Params.EmojiName,
	}

	err := app.DeleteReactionForPost(reaction)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
