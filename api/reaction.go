// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitReaction() {
	api.BaseRoutes.NeedPost.Handle("/reactions/save", api.ApiUserRequired(saveReaction)).Methods("POST")
	api.BaseRoutes.NeedPost.Handle("/reactions/delete", api.ApiUserRequired(deleteReaction)).Methods("POST")
	api.BaseRoutes.NeedPost.Handle("/reactions", api.ApiUserRequired(listReactions)).Methods("GET")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("saveReaction", "reaction")
		return
	}

	if reaction.UserId != c.Session.UserId {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "", http.StatusForbidden)
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("saveReaction", "channelId")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("saveReaction", "postId")
		return
	}

	var post *model.Post

	if result := <-c.App.Srv.Store.Post().Get(reaction.PostId); result.Err != nil {
		c.Err = result.Err
		return
	} else if post = result.Data.(*model.PostList).Posts[postId]; post.ChannelId != channelId {
		c.Err = model.NewAppError("saveReaction", "api.reaction.save_reaction.mismatched_channel_id.app_error",
			nil, "channelId="+channelId+", post.ChannelId="+post.ChannelId+", postId="+postId, http.StatusBadRequest)
		return
	}

	if reaction, err := c.App.SaveReactionForPost(reaction); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(reaction.ToJson()))
		return
	}
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("deleteReaction", "reaction")
		return
	}

	if reaction.UserId != c.Session.UserId {
		c.Err = model.NewAppError("deleteReaction", "api.reaction.delete_reaction.user_id.app_error", nil, "", http.StatusForbidden)
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deleteReaction", "channelId")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("deleteReaction", "postId")
		return
	}

	err := c.App.DeleteReactionForPost(reaction)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func listReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deletePost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("listReactions", "postId")
		return
	}

	pchan := c.App.Srv.Store.Post().Get(postId)

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if post := result.Data.(*model.PostList).Posts[postId]; post.ChannelId != channelId {
		c.Err = model.NewAppError("listReactions", "api.reaction.list_reactions.mismatched_channel_id.app_error",
			nil, "channelId="+channelId+", post.ChannelId="+post.ChannelId+", postId="+postId, http.StatusBadRequest)
		return
	}

	if result := <-c.App.Srv.Store.Reaction().GetForPost(postId, true); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		reactions := result.Data.([]*model.Reaction)

		w.Write([]byte(model.ReactionsToJson(reactions)))
	}
}
