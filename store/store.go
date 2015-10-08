// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"time"
)

type StoreResult struct {
	Data interface{}
	Err  *model.AppError
}

type StoreChannel chan StoreResult

func Must(sc StoreChannel) interface{} {
	r := <-sc
	if r.Err != nil {
		l4g.Close()
		time.Sleep(time.Second)
		panic(r.Err)
	}

	return r.Data
}

type Store interface {
	Team() TeamStore
	Channel() ChannelStore
	Post() PostStore
	User() UserStore
	Audit() AuditStore
	Session() SessionStore
	OAuth() OAuthStore
	System() SystemStore
	Webhook() WebhookStore
	Close()
}

type TeamStore interface {
	Save(team *model.Team) StoreChannel
	Update(team *model.Team) StoreChannel
	UpdateDisplayName(name string, teamId string) StoreChannel
	Get(id string) StoreChannel
	GetByName(name string) StoreChannel
	GetTeamsForEmail(domain string) StoreChannel
	GetAll() StoreChannel
}

type ChannelStore interface {
	Save(channel *model.Channel) StoreChannel
	Update(channel *model.Channel) StoreChannel
	Get(id string) StoreChannel
	Delete(channelId string, time int64) StoreChannel
	GetByName(team_id string, domain string) StoreChannel
	GetChannels(teamId string, userId string) StoreChannel
	GetMoreChannels(teamId string, userId string) StoreChannel
	GetChannelCounts(teamId string, userId string) StoreChannel
	GetForExport(teamId string) StoreChannel

	SaveMember(member *model.ChannelMember) StoreChannel
	UpdateMember(member *model.ChannelMember) StoreChannel
	GetMembers(channelId string) StoreChannel
	GetMember(channelId string, userId string) StoreChannel
	RemoveMember(channelId string, userId string) StoreChannel
	GetExtraMembers(channelId string, limit int) StoreChannel
	CheckPermissionsTo(teamId string, channelId string, userId string) StoreChannel
	CheckOpenChannelPermissions(teamId string, channelId string) StoreChannel
	CheckPermissionsToByName(teamId string, channelName string, userId string) StoreChannel
	UpdateLastViewedAt(channelId string, userId string) StoreChannel
	IncrementMentionCount(channelId string, userId string) StoreChannel
}

type PostStore interface {
	Save(post *model.Post) StoreChannel
	Update(post *model.Post, newMessage string, newHashtags string) StoreChannel
	Get(id string) StoreChannel
	Delete(postId string, time int64) StoreChannel
	GetPosts(channelId string, offset int, limit int) StoreChannel
	GetPostsSince(channelId string, time int64) StoreChannel
	GetEtag(channelId string) StoreChannel
	Search(teamId string, userId string, terms string, isHashtagSearch bool) StoreChannel
	GetForExport(channelId string) StoreChannel
}

type UserStore interface {
	Save(user *model.User) StoreChannel
	Update(user *model.User, allowRoleUpdate bool) StoreChannel
	UpdateLastPictureUpdate(userId string) StoreChannel
	UpdateLastPingAt(userId string, time int64) StoreChannel
	UpdateLastActivityAt(userId string, time int64) StoreChannel
	UpdateUserAndSessionActivity(userId string, sessionId string, time int64) StoreChannel
	UpdatePassword(userId, newPassword string) StoreChannel
	Get(id string) StoreChannel
	GetProfiles(teamId string) StoreChannel
	GetByEmail(teamId string, email string) StoreChannel
	GetByAuth(teamId string, authData string, authService string) StoreChannel
	GetByUsername(teamId string, username string) StoreChannel
	VerifyEmail(userId string) StoreChannel
	GetEtagForProfiles(teamId string) StoreChannel
	UpdateFailedPasswordAttempts(userId string, attempts int) StoreChannel
	GetForExport(teamId string) StoreChannel
	GetTotalUsersCount() StoreChannel
	GetSystemAdminProfiles() StoreChannel
}

type SessionStore interface {
	Save(session *model.Session) StoreChannel
	Get(sessionIdOrToken string) StoreChannel
	GetSessions(userId string) StoreChannel
	Remove(sessionIdOrToken string) StoreChannel
	RemoveAllSessionsForTeam(teamId string) StoreChannel
	UpdateLastActivityAt(sessionId string, time int64) StoreChannel
	UpdateRoles(userId string, roles string) StoreChannel
}

type AuditStore interface {
	Save(audit *model.Audit) StoreChannel
	Get(user_id string, limit int) StoreChannel
}

type OAuthStore interface {
	SaveApp(app *model.OAuthApp) StoreChannel
	UpdateApp(app *model.OAuthApp) StoreChannel
	GetApp(id string) StoreChannel
	GetAppByUser(userId string) StoreChannel
	SaveAuthData(authData *model.AuthData) StoreChannel
	GetAuthData(code string) StoreChannel
	RemoveAuthData(code string) StoreChannel
	SaveAccessData(accessData *model.AccessData) StoreChannel
	GetAccessData(token string) StoreChannel
	GetAccessDataByAuthCode(authCode string) StoreChannel
	RemoveAccessData(token string) StoreChannel
}

type SystemStore interface {
	Save(system *model.System) StoreChannel
	Update(system *model.System) StoreChannel
	Get() StoreChannel
}

type WebhookStore interface {
	SaveIncoming(webhook *model.IncomingWebhook) StoreChannel
	GetIncoming(id string) StoreChannel
	GetIncomingByUser(userId string) StoreChannel
	DeleteIncoming(webhookId string, time int64) StoreChannel
}
