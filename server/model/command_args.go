// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
)

type CommandArgs struct {
	UserId          string             `json:"user_id"`
	ChannelId       string             `json:"channel_id"`
	TeamId          string             `json:"team_id"`
	RootId          string             `json:"root_id"`
	ParentId        string             `json:"parent_id"`
	TriggerId       string             `json:"trigger_id,omitempty"`
	Command         string             `json:"command"`
	SiteURL         string             `json:"-"`
	T               i18n.TranslateFunc `json:"-"`
	UserMentions    UserMentionMap     `json:"-"`
	ChannelMentions ChannelMentionMap  `json:"-"`

	// DO NOT USE Session field is deprecated. MM-26398
	Session Session `json:"-"`
}

func (o *CommandArgs) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"user_id":    o.UserId,
		"channel_id": o.ChannelId,
		"team_id":    o.TeamId,
		"root_id":    o.RootId,
		"parent_id":  o.ParentId,
		"trigger_id": o.TriggerId,
		"command":    o.Command,
		"site_url":   o.SiteURL,
	}
}

// AddUserMention adds or overrides an entry in UserMentions with name username
// and identifier userId
func (o *CommandArgs) AddUserMention(username, userId string) {
	if o.UserMentions == nil {
		o.UserMentions = make(UserMentionMap)
	}

	o.UserMentions[username] = userId
}

// AddChannelMention adds or overrides an entry in ChannelMentions with name
// channelName and identifier channelId
func (o *CommandArgs) AddChannelMention(channelName, channelId string) {
	if o.ChannelMentions == nil {
		o.ChannelMentions = make(ChannelMentionMap)
	}

	o.ChannelMentions[channelName] = channelId
}
