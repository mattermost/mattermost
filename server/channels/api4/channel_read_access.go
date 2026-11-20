// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "github.com/mattermost/mattermost/server/public/model"

// sessionCanReadChannel reports whether the session may read the channel, without
// recording a denial. A read denial does not refuse a write; the write's own gates
// decide that. But a write endpoint whose response echoes the channel's content checks
// this before sending it, so the write cannot be used to read what the read gates
// withhold.
func sessionCanReadChannel(c *Context, channelID string) bool {
	return c.App.HasChannelReadAccessByID(c.AppContext, c.AppContext.Session().UserId, channelID)
}

// channelWithoutContent is what a write endpoint returns about a channel to a session
// that may not read it: enough to identify the channel, none of its content.
func channelWithoutContent(channel *model.Channel) *model.Channel {
	return &model.Channel{
		Id:       channel.Id,
		TeamId:   channel.TeamId,
		Type:     channel.Type,
		CreateAt: channel.CreateAt,
		UpdateAt: channel.UpdateAt,
		DeleteAt: channel.DeleteAt,
	}
}

// postWithoutContent is what a write endpoint returns about a post to a session that
// may not read its channel: enough to identify the post, none of its content.
func postWithoutContent(post *model.Post) *model.Post {
	return &model.Post{
		Id:        post.Id,
		ChannelId: post.ChannelId,
		RootId:    post.RootId,
		CreateAt:  post.CreateAt,
		UpdateAt:  post.UpdateAt,
		EditAt:    post.EditAt,
		DeleteAt:  post.DeleteAt,
	}
}
