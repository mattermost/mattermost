// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type StoreResult struct {
	Data interface{}
	Err  *model.AppError
}

type StoreChannel chan StoreResult

type Store interface {
	Team() TeamStore
	Channel() ChannelStore
	Post() PostStore
	User() UserStore
	Audit() AuditStore
	Session() SessionStore
	Close()
}

type TeamStore interface {
	Save(team *model.Team) StoreChannel
	Update(team *model.Team) StoreChannel
	UpdateName(name string, teamId string) StoreChannel
	Get(id string) StoreChannel
	GetByDomain(domain string) StoreChannel
	GetTeamsForEmail(domain string) StoreChannel
}

type ChannelStore interface {
	Save(channel *model.Channel) StoreChannel
	Update(channel *model.Channel) StoreChannel
	Get(id string) StoreChannel
	Delete(channelId string, time int64) StoreChannel
	GetByName(team_id string, domain string) StoreChannel
	GetChannels(teamId string, userId string) StoreChannel
	GetMoreChannels(teamId string, userId string) StoreChannel

	SaveMember(member *model.ChannelMember) StoreChannel
	GetMembers(channelId string) StoreChannel
	GetMember(channelId string, userId string) StoreChannel
	RemoveMember(channelId string, userId string) StoreChannel
	GetExtraMembers(channelId string, limit int) StoreChannel
	CheckPermissionsTo(teamId string, channelId string, userId string) StoreChannel
	CheckOpenChannelPermissions(teamId string, channelId string) StoreChannel
	CheckPermissionsToByName(teamId string, channelName string, userId string) StoreChannel
	UpdateLastViewedAt(channelId string, userId string) StoreChannel
	IncrementMentionCount(channelId string, userId string) StoreChannel
	UpdateNotifyLevel(channelId string, userId string, notifyLevel string) StoreChannel
}

type PostStore interface {
	Save(post *model.Post) StoreChannel
	Update(post *model.Post, newMessage string, newHashtags string) StoreChannel
	Get(id string) StoreChannel
	Delete(postId string, time int64) StoreChannel
	GetPosts(channelId string, offset int, limit int) StoreChannel
	GetEtag(channelId string) StoreChannel
	Search(teamId string, userId string, terms string, isHashtagSearch bool) StoreChannel
}

type UserStore interface {
	Save(user *model.User) StoreChannel
	Update(user *model.User, allowRoleUpdate bool) StoreChannel
	UpdateLastPingAt(userId string, time int64) StoreChannel
	UpdateLastActivityAt(userId string, time int64) StoreChannel
	UpdateUserAndSessionActivity(userId string, sessionId string, time int64) StoreChannel
	UpdatePassword(userId, newPassword string) StoreChannel
	Get(id string) StoreChannel
	GetProfiles(teamId string) StoreChannel
	GetByEmail(teamId string, email string) StoreChannel
	GetByUsername(teamId string, username string) StoreChannel
	VerifyEmail(userId string) StoreChannel
	GetEtagForProfiles(teamId string) StoreChannel
}

type SessionStore interface {
	Save(session *model.Session) StoreChannel
	Get(id string) StoreChannel
	GetSessions(userId string) StoreChannel
	Remove(sessionIdOrAlt string) StoreChannel
	UpdateLastActivityAt(sessionId string, time int64) StoreChannel
}

type AuditStore interface {
	Save(audit *model.Audit) StoreChannel
	Get(user_id string, limit int) StoreChannel
}
