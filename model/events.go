// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostCreatedEvent struct {
	PostId  string `json:"post_id"`
	Message string `json:"message"`
}

type UserCreatedEvent struct {
	UserId   string `json:"user_id"`
	UserName string `json:"user_name"`
}

type ChannelCreatedEvent struct {
	ChannelId string `json:"channel_id"`
	TeamId    string `json:"team_id"`
}

type UserHasJoinedChannelEvent struct {
	UserId    string `json:"user_id"`
	ChannelId string `json:"channel_id"`
}

type UserHasJoinedTeamEvent struct {
	UserId string `json:"user_id"`
	TeamId string `json:"team_id"`
}
