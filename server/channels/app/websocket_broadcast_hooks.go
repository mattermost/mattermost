// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	pUtils "github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

const AddMentionsAndFollowers = "add_mentions_and_followers"

func (s *Server) RegisterBroadcastHooks() {
	broadcastHooks := map[string]*platform.BroadcastHook{
		AddMentionsAndFollowers: makeAddMentionsAndFollowersHook(),
	}

	s.platform.HubsUseBroadcastHooks(broadcastHooks)
}

func makeAddMentionsAndFollowersHook() *platform.BroadcastHook {
	return &platform.BroadcastHook{
		HasChanges: func(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) bool {
			if msg.EventType() != model.WebsocketEventPosted {
				return false
			}

			mentions, _ := args["mentions"].(model.StringArray)
			followers, _ := args["followers"].(model.StringArray)

			// This hook will only modify the event if the current user was mentioned or is following the post
			return pUtils.Contains[string](mentions, webConn.UserId) ||
				pUtils.Contains[string](followers, webConn.UserId)
		},
		Process: func(msg *model.WebSocketEvent, webConn *platform.WebConn, args map[string]any) *model.WebSocketEvent {
			mentions, _ := args["mentions"].(model.StringArray)
			hasMention := false
			if len(mentions) > 0 {
				hasMention = pUtils.Contains(mentions, webConn.UserId)
			}

			followers, _ := args["followers"].(model.StringArray)
			isFollower := false
			if len(followers) > 0 {
				isFollower = pUtils.Contains(followers, webConn.UserId)
			}

			if hasMention || isFollower {
				// Note that the client expects these fields to be stringified
				if hasMention {
					msg.AddWithCopy("mentions", model.ArrayToJSON([]string{webConn.UserId}))
				}
				if isFollower {
					msg.AddWithCopy("followers", model.ArrayToJSON([]string{webConn.UserId}))
				}
			}

			return msg
		},
	}
}
