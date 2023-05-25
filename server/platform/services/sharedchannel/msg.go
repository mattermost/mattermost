// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// syncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type syncMsg struct {
	Id        string                 `json:"id"`
	ChannelId string                 `json:"channel_id"`
	Users     map[string]*model.User `json:"users,omitempty"`
	Posts     []*model.Post          `json:"posts,omitempty"`
	Reactions []*model.Reaction      `json:"reactions,omitempty"`
}

func newSyncMsg(channelID string) *syncMsg {
	return &syncMsg{
		Id:        model.NewId(),
		ChannelId: channelID,
	}
}

func (sm *syncMsg) ToJSON() ([]byte, error) {
	b, err := json.Marshal(sm)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (sm *syncMsg) String() string {
	json, err := sm.ToJSON()
	if err != nil {
		return ""
	}
	return string(json)
}
