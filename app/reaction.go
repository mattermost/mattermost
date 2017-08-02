// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func SaveReactionForPost(reaction *model.Reaction) (*model.Reaction, *model.AppError) {
	post, err := GetSinglePost(reaction.PostId)
	if err != nil {
		return nil, err
	}

	if result := <-Srv.Store.Reaction().Save(reaction); result.Err != nil {
		return nil, result.Err
	} else {
		reaction = result.Data.(*model.Reaction)

		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_ADDED, reaction, post)

		return reaction, nil
	}
}

func GetReactionsForPost(postId string) ([]*model.Reaction, *model.AppError) {
	if result := <-Srv.Store.Reaction().GetForPost(postId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Reaction), nil
	}
}

func DeleteReactionForPost(reaction *model.Reaction) *model.AppError {
	post, err := GetSinglePost(reaction.PostId)
	if err != nil {
		return err
	}

	if result := <-Srv.Store.Reaction().Delete(reaction); result.Err != nil {
		return result.Err
	} else {
		go sendReactionEvent(model.WEBSOCKET_EVENT_REACTION_REMOVED, reaction, post)
	}

	return nil
}

func sendReactionEvent(event string, reaction *model.Reaction, post *model.Post) {
	// send out that a reaction has been added/removed
	message := model.NewWebSocketEvent(event, "", post.ChannelId, "", nil)
	message.Add("reaction", reaction.ToJson())
	Publish(message)

	// The post is always modified since the UpdateAt always changes
	InvalidateCacheForChannelPosts(post.ChannelId)
	post.HasReactions = true
	post.UpdateAt = model.GetMillis()
	umessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", post.ChannelId, "", nil)
	umessage.Add("post", post.ToJson())
	Publish(umessage)
}
