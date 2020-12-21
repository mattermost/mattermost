// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/v5/model"
)

// msgCache caches the work of converting a change in the Posts table to a remote cluster message.
// Maps Post id to syncMsg.
type msgCache map[string]syncMsg

// syncMsg represents a change in content (post add/edit/delete, reaction add/remove).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type syncMsg struct {
	Post      *model.Post       `json:"post"`
	Reactions []*model.Reaction `json:"reactions"`
}

// postsToMsg takes a slice of posts and converts to a `RemoteClusterMsg` which can be
// sent to a remote cluster
func (scs *Service) postsToMsg(posts []*model.Post, cache msgCache) (model.RemoteClusterMsg, error) {

	syncMessages := make([]syncMsg, 0, len(posts))

	for _, p := range posts {
		if sm, ok := cache[p.Id]; ok {
			syncMessages = append(syncMessages, sm)
			continue
		}

		reactions, err := scs.server.GetStore().Reaction().GetForPost(p.Id, true)
		if err != nil {
			return model.RemoteClusterMsg{}, err
		}
		sm := syncMsg{
			Post:      p,
			Reactions: reactions,
		}
		syncMessages = append(syncMessages, sm)
		cache[p.Id] = sm
	}

	json, err := json.Marshal(syncMessages)
	if err != nil {
		return model.RemoteClusterMsg{}, err
	}

	msg := model.NewRemoteClusterMsg(TopicSync, json)
	return msg, nil
}
