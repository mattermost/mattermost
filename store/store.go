// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
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
	Preference() PreferenceStore
	MarkSystemRanUnitTests(T goi18n.TranslateFunc)
	Close()
}

type TeamStore interface {
	Save(team *model.Team, T goi18n.TranslateFunc) StoreChannel
	Update(team *model.Team, T goi18n.TranslateFunc) StoreChannel
	UpdateDisplayName(name string, teamId string, T goi18n.TranslateFunc) StoreChannel
	Get(id string, T goi18n.TranslateFunc) StoreChannel
	GetByName(name string, T goi18n.TranslateFunc) StoreChannel
	GetTeamsForEmail(domain string, T goi18n.TranslateFunc) StoreChannel
	GetAll(T goi18n.TranslateFunc) StoreChannel
	GetAllTeamListing(T goi18n.TranslateFunc) StoreChannel
	GetByInviteId(inviteId string, T goi18n.TranslateFunc) StoreChannel
	PermanentDelete(teamId string, T goi18n.TranslateFunc) StoreChannel
}

type ChannelStore interface {
	Save(channel *model.Channel, T goi18n.TranslateFunc) StoreChannel
	SaveDirectChannel(channel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember, T goi18n.TranslateFunc) StoreChannel
	Update(channel *model.Channel, T goi18n.TranslateFunc) StoreChannel
	Get(id string, T goi18n.TranslateFunc) StoreChannel
	GetFromMaster(id string, T goi18n.TranslateFunc) StoreChannel
	Delete(channelId string, time int64, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteByTeam(teamId string, T goi18n.TranslateFunc) StoreChannel
	GetByName(team_id string, domain string, T goi18n.TranslateFunc) StoreChannel
	GetChannels(teamId string, userId string, T goi18n.TranslateFunc) StoreChannel
	GetMoreChannels(teamId string, userId string, T goi18n.TranslateFunc) StoreChannel
	GetChannelCounts(teamId string, userId string, T goi18n.TranslateFunc) StoreChannel
	GetForExport(teamId string, T goi18n.TranslateFunc) StoreChannel

	SaveMember(member *model.ChannelMember, T goi18n.TranslateFunc) StoreChannel
	UpdateMember(member *model.ChannelMember, T goi18n.TranslateFunc) StoreChannel
	GetMembers(channelId string, T goi18n.TranslateFunc) StoreChannel
	GetMember(channelId string, userId string, T goi18n.TranslateFunc) StoreChannel
	GetMemberCount(channelId string, T goi18n.TranslateFunc) StoreChannel
	RemoveMember(channelId string, userId string, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteMembersByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	GetExtraMembers(channelId string, limit int, T goi18n.TranslateFunc) StoreChannel
	CheckPermissionsTo(teamId string, channelId string, userId string, T goi18n.TranslateFunc) StoreChannel
	CheckOpenChannelPermissions(teamId string, channelId string, T goi18n.TranslateFunc) StoreChannel
	CheckPermissionsToByName(teamId string, channelName string, userId string, T goi18n.TranslateFunc) StoreChannel
	UpdateLastViewedAt(channelId string, userId string, T goi18n.TranslateFunc) StoreChannel
	IncrementMentionCount(channelId string, userId string, T goi18n.TranslateFunc) StoreChannel
	AnalyticsTypeCount(teamId string, channelType string, T goi18n.TranslateFunc) StoreChannel

	GetTotalChannelsByType(teamType string, teamId string, T goi18n.TranslateFunc) StoreChannel
}

type PostStore interface {
	Save(post *model.Post, T goi18n.TranslateFunc) StoreChannel
	Update(post *model.Post, newMessage string, newHashtags string, T goi18n.TranslateFunc) StoreChannel
	Get(id string, T goi18n.TranslateFunc) StoreChannel
	Delete(postId string, time int64, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	GetPosts(channelId string, offset int, limit int, T goi18n.TranslateFunc) StoreChannel
	GetPostsBefore(channelId string, postId string, numPosts int, offset int, T goi18n.TranslateFunc) StoreChannel
	GetPostsAfter(channelId string, postId string, numPosts int, offset int, T goi18n.TranslateFunc) StoreChannel
	GetPostsSince(channelId string, time int64, T goi18n.TranslateFunc) StoreChannel
	GetEtag(channelId string) StoreChannel
	Search(teamId string, userId string, params *model.SearchParams, T goi18n.TranslateFunc) StoreChannel
	GetForExport(channelId string, T goi18n.TranslateFunc) StoreChannel
	AnalyticsUserCountsWithPostsByDay(teamId string, T goi18n.TranslateFunc) StoreChannel
	AnalyticsPostCountsByDay(teamId string, T goi18n.TranslateFunc) StoreChannel
	AnalyticsPostCount(teamId string, T goi18n.TranslateFunc) StoreChannel
}

type UserStore interface {
	Save(user *model.User, T goi18n.TranslateFunc) StoreChannel
	Update(user *model.User, allowRoleUpdate bool, T goi18n.TranslateFunc) StoreChannel
	UpdateLastPictureUpdate(userId string, T goi18n.TranslateFunc) StoreChannel
	UpdateLastPingAt(userId string, time int64, T goi18n.TranslateFunc) StoreChannel
	UpdateLastActivityAt(userId string, time int64, T goi18n.TranslateFunc) StoreChannel
	UpdateUserAndSessionActivity(userId string, sessionId string, time int64, T goi18n.TranslateFunc) StoreChannel
	UpdatePassword(userId, newPassword string, T goi18n.TranslateFunc) StoreChannel
	Get(id string, T goi18n.TranslateFunc) StoreChannel
	GetProfiles(teamId string, T goi18n.TranslateFunc) StoreChannel
	GetByEmail(teamId string, email string, T goi18n.TranslateFunc) StoreChannel
	GetByAuth(teamId string, authData string, authService string, T goi18n.TranslateFunc) StoreChannel
	GetByUsername(teamId string, username string, T goi18n.TranslateFunc) StoreChannel
	VerifyEmail(userId string, T goi18n.TranslateFunc) StoreChannel
	GetEtagForProfiles(teamId string) StoreChannel
	UpdateFailedPasswordAttempts(userId string, attempts int, T goi18n.TranslateFunc) StoreChannel
	GetForExport(teamId string, T goi18n.TranslateFunc) StoreChannel
	GetTotalUsersCount(T goi18n.TranslateFunc) StoreChannel
	GetTotalActiveUsersCount(T goi18n.TranslateFunc) StoreChannel
	GetSystemAdminProfiles(T goi18n.TranslateFunc) StoreChannel
	PermanentDelete(userId string, T goi18n.TranslateFunc) StoreChannel
	GetUserStatusByEmails(emails []string, T goi18n.TranslateFunc) StoreChannel
}

type SessionStore interface {
	Save(session *model.Session, T goi18n.TranslateFunc) StoreChannel
	Get(sessionIdOrToken string, T goi18n.TranslateFunc) StoreChannel
	GetSessions(userId string, T goi18n.TranslateFunc) StoreChannel
	Remove(sessionIdOrToken string, T goi18n.TranslateFunc) StoreChannel
	RemoveAllSessionsForTeam(teamId string, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteSessionsByUser(teamId string, T goi18n.TranslateFunc) StoreChannel
	UpdateLastActivityAt(sessionId string, time int64, T goi18n.TranslateFunc) StoreChannel
	UpdateRoles(userId string, roles string, T goi18n.TranslateFunc) StoreChannel
}

type AuditStore interface {
	Save(audit *model.Audit, T goi18n.TranslateFunc) StoreChannel
	Get(user_id string, limit int, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteByUser(userId string, T goi18n.TranslateFunc) StoreChannel
}

type OAuthStore interface {
	SaveApp(app *model.OAuthApp, T goi18n.TranslateFunc) StoreChannel
	UpdateApp(app *model.OAuthApp, T goi18n.TranslateFunc) StoreChannel
	GetApp(id string, T goi18n.TranslateFunc) StoreChannel
	GetAppByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	SaveAuthData(authData *model.AuthData, T goi18n.TranslateFunc) StoreChannel
	GetAuthData(code string, T goi18n.TranslateFunc) StoreChannel
	RemoveAuthData(code string, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteAuthDataByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	SaveAccessData(accessData *model.AccessData, T goi18n.TranslateFunc) StoreChannel
	GetAccessData(token string, T goi18n.TranslateFunc) StoreChannel
	GetAccessDataByAuthCode(authCode string, T goi18n.TranslateFunc) StoreChannel
	RemoveAccessData(token string, T goi18n.TranslateFunc) StoreChannel
}

type SystemStore interface {
	Save(system *model.System, T goi18n.TranslateFunc) StoreChannel
	Update(system *model.System, T goi18n.TranslateFunc) StoreChannel
	Get(T goi18n.TranslateFunc) StoreChannel
}

type WebhookStore interface {
	SaveIncoming(webhook *model.IncomingWebhook, T goi18n.TranslateFunc) StoreChannel
	GetIncoming(id string, T goi18n.TranslateFunc) StoreChannel
	GetIncomingByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	GetIncomingByChannel(channelId string, T goi18n.TranslateFunc) StoreChannel
	DeleteIncoming(webhookId string, time int64, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteIncomingByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	SaveOutgoing(webhook *model.OutgoingWebhook, T goi18n.TranslateFunc) StoreChannel
	GetOutgoing(id string, T goi18n.TranslateFunc) StoreChannel
	GetOutgoingByCreator(userId string, T goi18n.TranslateFunc) StoreChannel
	GetOutgoingByChannel(channelId string, T goi18n.TranslateFunc) StoreChannel
	GetOutgoingByTeam(teamId string, T goi18n.TranslateFunc) StoreChannel
	DeleteOutgoing(webhookId string, time int64, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteOutgoingByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	UpdateOutgoing(hook *model.OutgoingWebhook, T goi18n.TranslateFunc) StoreChannel
}

type PreferenceStore interface {
	Save(preferences *model.Preferences, T goi18n.TranslateFunc) StoreChannel
	Get(userId string, category string, name string, T goi18n.TranslateFunc) StoreChannel
	GetCategory(userId string, category string, T goi18n.TranslateFunc) StoreChannel
	GetAll(userId string, T goi18n.TranslateFunc) StoreChannel
	PermanentDeleteByUser(userId string, T goi18n.TranslateFunc) StoreChannel
	IsFeatureEnabled(feature, userId string) StoreChannel
}
