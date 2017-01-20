// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

func InitReaction() {
	l4g.Debug(utils.T("api.reaction.init.debug"))

	BaseRoutes.NeedPost.Handle("/reactions/save", ApiUserRequired(saveReaction)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/reactions/delete", ApiUserRequired(deleteReaction)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/reactions", ApiUserRequired(listReactions)).Methods("GET")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("saveReaction", "reaction")
		return
	}

	if reaction.UserId != c.Session.UserId {
		c.Err = model.NewLocAppError("saveReaction", "api.reaction.save_reaction.user_id.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("saveReaction", "channelId")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("saveReaction", "postId")
		return
	}

	pchan := app.Srv.Store.Post().Get(reaction.PostId)

	var postHadReactions bool
	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if post := result.Data.(*model.PostList).Posts[postId]; post.ChannelId != channelId {
		c.Err = model.NewLocAppError("saveReaction", "api.reaction.save_reaction.mismatched_channel_id.app_error",
			nil, "channelId="+channelId+", post.ChannelId="+post.ChannelId+", postId="+postId)
		c.Err.StatusCode = http.StatusBadRequest
		return
	} else {
		postHadReactions = post.HasReactions
	}

	if result := <-app.Srv.Store.Reaction().Save(reaction); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_ADDED, channelId, reaction, postHadReactions)

		reaction := result.Data.(*model.Reaction)

		w.Write([]byte(reaction.ToJson()))
	}
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("deleteReaction", "reaction")
		return
	}

	if reaction.UserId != c.Session.UserId {
		c.Err = model.NewLocAppError("deleteReaction", "api.reaction.delete_reaction.user_id.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deleteReaction", "channelId")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("deleteReaction", "postId")
		return
	}

	pchan := app.Srv.Store.Post().Get(reaction.PostId)

	var postHadReactions bool
	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if post := result.Data.(*model.PostList).Posts[postId]; post.ChannelId != channelId {
		c.Err = model.NewLocAppError("deleteReaction", "api.reaction.delete_reaction.mismatched_channel_id.app_error",
			nil, "channelId="+channelId+", post.ChannelId="+post.ChannelId+", postId="+postId)
		c.Err.StatusCode = http.StatusBadRequest
		return
	} else {
		postHadReactions = post.HasReactions
	}

	if result := <-app.Srv.Store.Reaction().Delete(reaction); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_REMOVED, channelId, reaction, postHadReactions)

		ReturnStatusOK(w)
	}
}

func sendReactionEvent(event string, channelId string, reaction *model.Reaction, postHadReactions bool) {
	// send out that a reaction has been added/removed
	go func() {
		message := model.NewWebSocketEvent(event, "", channelId, "", nil)
		message.Add("reaction", reaction.ToJson())

		app.Publish(message)
	}()

	// send out that a post was updated if post.HasReactions has changed
	go func() {
		var post *model.Post
		if result := <-app.Srv.Store.Post().Get(reaction.PostId); result.Err != nil {
			l4g.Warn(utils.T("api.reaction.send_reaction_event.post.app_error"))
			return
		} else {
			post = result.Data.(*model.PostList).Posts[reaction.PostId]
		}

		if post.HasReactions != postHadReactions {
			message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", channelId, "", nil)
			message.Add("post", post.ToJson())

			app.Publish(message)
		}
	}()
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

	pchan := app.Srv.Store.Post().Get(postId)

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if post := result.Data.(*model.PostList).Posts[postId]; post.ChannelId != channelId {
		c.Err = model.NewLocAppError("listReactions", "api.reaction.list_reactions.mismatched_channel_id.app_error",
			nil, "channelId="+channelId+", post.ChannelId="+post.ChannelId+", postId="+postId)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if result := <-app.Srv.Store.Reaction().GetForPost(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		reactions := result.Data.([]*model.Reaction)

		w.Write([]byte(model.ReactionsToJson(reactions)))
	}
}
