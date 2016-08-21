// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

func InitReaction() {
	l4g.Debug(utils.T("api.reaction.init.debug"))

	BaseRoutes.NeedPost.Handle("/save_reaction", ApiUserRequired(saveReaction)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/delete_reaction", ApiUserRequired(deleteReaction)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/list_reactions", ApiUserRequired(listReactions)).Methods("GET")
}

func saveReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("saveReaction", "reaction")
		return
	}

	channelId := mux.Vars(r)["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("saveReaction", "postId")
		return
	}

	postId := mux.Vars(r)["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("saveReaction", "postId")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsToNoTeam(channelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(reaction.PostId)

	if !c.HasPermissionsToUser(reaction.UserId, "saveReaction") {
		return
	}

	if !c.HasPermissionsToChannel(cchan, "saveReaction") {
		return
	}

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

	if result := <-Srv.Store.Reaction().Save(reaction); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_ADDED, c.TeamId, channelId, reaction, postHadReactions)

		ReturnStatusOK(w)
	}
}

func deleteReaction(c *Context, w http.ResponseWriter, r *http.Request) {
	reaction := model.ReactionFromJson(r.Body)
	if reaction == nil {
		c.SetInvalidParam("deleteReaction", "reaction")
		return
	}

	channelId := mux.Vars(r)["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("saveReaction", "postId")
		return
	}

	postId := mux.Vars(r)["post_id"]
	if len(postId) != 26 || postId != reaction.PostId {
		c.SetInvalidParam("deleteReaction", "postId")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsToNoTeam(channelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(reaction.PostId)

	if !c.HasPermissionsToUser(reaction.UserId, "deleteReaction") {
		return
	}

	if !c.HasPermissionsToChannel(cchan, "deleteReaction") {
		return
	}

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

	if result := <-Srv.Store.Reaction().Delete(reaction); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_REMOVED, c.TeamId, channelId, reaction, postHadReactions)

		ReturnStatusOK(w)
	}
}

func sendReactionEvent(event string, teamId string, channelId string, reaction *model.Reaction, postHadReactions bool) {
	// send out that a reaction has been added/removed
	go func() {
		message := model.NewWebSocketEvent(teamId, channelId, reaction.UserId, event)
		message.Add("reaction", reaction.ToJson())

		Publish(message)
	}()

	// send out that a post was updated if post.HasReactions has changed
	go func() {
		var post *model.Post
		if result := <-Srv.Store.Post().Get(reaction.PostId); result.Err != nil {
			l4g.Warn(utils.T("api.reaction.send_reaction_event.post.app_error"))
			return
		} else {
			post = result.Data.(*model.PostList).Posts[reaction.PostId]
		}

		if post.HasReactions != postHadReactions {
			message := model.NewWebSocketEvent(teamId, channelId, reaction.UserId, model.WEBSOCKET_EVENT_POST_EDITED)
			message.Add("post", post.ToJson())

			Publish(message)
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

	cchan := Srv.Store.Channel().CheckPermissionsToNoTeam(channelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(postId)

	if !c.HasPermissionsToChannel(cchan, "listReactions") {
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

	if result := <-Srv.Store.Reaction().List(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		reactions := result.Data.([]*model.Reaction)

		w.Write([]byte(model.ReactionsToJson(reactions)))
	}
}
