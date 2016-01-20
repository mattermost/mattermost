// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
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
	MarkSystemRanUnitTests()
	Close()
}

type TeamStore interface {
	Save(T goi18n.TranslateFunc, team *model.Team) StoreChannel
	Update(T goi18n.TranslateFunc, team *model.Team) StoreChannel
	UpdateDisplayName(T goi18n.TranslateFunc, name string, teamId string) StoreChannel
	Get(T goi18n.TranslateFunc, id string) StoreChannel
	GetByName(T goi18n.TranslateFunc, name string) StoreChannel
	GetTeamsForEmail(T goi18n.TranslateFunc, domain string) StoreChannel
	GetAll(T goi18n.TranslateFunc) StoreChannel
	GetAllTeamListing(T goi18n.TranslateFunc) StoreChannel
	GetByInviteId(T goi18n.TranslateFunc, inviteId string) StoreChannel
	PermanentDelete(T goi18n.TranslateFunc, teamId string) StoreChannel
}

type ChannelStore interface {
	Save(channel *model.Channel) StoreChannel
	SaveDirectChannel(channel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) StoreChannel
	Update(channel *model.Channel) StoreChannel
	Get(id string) StoreChannel
	GetFromMaster(id string) StoreChannel
	Delete(channelId string, time int64) StoreChannel
	PermanentDeleteByTeam(teamId string) StoreChannel
	GetByName(team_id string, domain string) StoreChannel
	GetChannels(teamId string, userId string) StoreChannel
	GetMoreChannels(teamId string, userId string) StoreChannel
	GetChannelCounts(teamId string, userId string) StoreChannel
	GetForExport(teamId string) StoreChannel

	SaveMember(member *model.ChannelMember) StoreChannel
	UpdateMember(member *model.ChannelMember) StoreChannel
	GetMembers(channelId string) StoreChannel
	GetMember(channelId string, userId string) StoreChannel
	GetMemberCount(channelId string) StoreChannel
	RemoveMember(channelId string, userId string) StoreChannel
	PermanentDeleteMembersByUser(userId string) StoreChannel
	GetExtraMembers(channelId string, limit int) StoreChannel
	CheckPermissionsTo(teamId string, channelId string, userId string) StoreChannel
	CheckOpenChannelPermissions(teamId string, channelId string) StoreChannel
	CheckPermissionsToByName(teamId string, channelName string, userId string) StoreChannel
	UpdateLastViewedAt(channelId string, userId string) StoreChannel
	IncrementMentionCount(channelId string, userId string) StoreChannel
	AnalyticsTypeCount(teamId string, channelType string) StoreChannel
}

type PostStore interface {
	Save(post *model.Post) StoreChannel
	Update(post *model.Post, newMessage string, newHashtags string) StoreChannel
	Get(id string) StoreChannel
	Delete(postId string, time int64) StoreChannel
	PermanentDeleteByUser(userId string) StoreChannel
	GetPosts(channelId string, offset int, limit int) StoreChannel
	GetPostsBefore(channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsAfter(channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsSince(channelId string, time int64) StoreChannel
	GetEtag(channelId string) StoreChannel
	Search(teamId string, userId string, params *model.SearchParams) StoreChannel
	GetForExport(channelId string) StoreChannel
	AnalyticsUserCountsWithPostsByDay(teamId string) StoreChannel
	AnalyticsPostCountsByDay(teamId string) StoreChannel
	AnalyticsPostCount(teamId string) StoreChannel
}

type UserStore interface {
	Save(user *model.User) StoreChannel
	Update(user *model.User, allowRoleUpdate bool) StoreChannel
	UpdateLastPictureUpdate(userId string) StoreChannel
	UpdateLastPingAt(userId string, time int64) StoreChannel
	UpdateLastActivityAt(userId string, time int64) StoreChannel
	UpdateUserAndSessionActivity(userId string, sessionId string, time int64) StoreChannel
	UpdatePassword(userId, newPassword string) StoreChannel
	UpdateAuthData(userId, service, authData string) StoreChannel
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
	GetTotalActiveUsersCount() StoreChannel
	GetSystemAdminProfiles() StoreChannel
	PermanentDelete(userId string) StoreChannel
}

type SessionStore interface {
	Save(session *model.Session) StoreChannel
	Get(sessionIdOrToken string) StoreChannel
	GetSessions(userId string) StoreChannel
	Remove(sessionIdOrToken string) StoreChannel
	RemoveAllSessionsForTeam(teamId string) StoreChannel
	PermanentDeleteSessionsByUser(teamId string) StoreChannel
	UpdateLastActivityAt(sessionId string, time int64) StoreChannel
	UpdateRoles(userId string, roles string) StoreChannel
}

type AuditStore interface {
	Save(T goi18n.TranslateFunc, audit *model.Audit) StoreChannel
	Get(T goi18n.TranslateFunc, user_id string, limit int) StoreChannel
	PermanentDeleteByUser(T goi18n.TranslateFunc, userId string) StoreChannel
}

type OAuthStore interface {
	SaveApp(T goi18n.TranslateFunc, app *model.OAuthApp) StoreChannel
	UpdateApp(T goi18n.TranslateFunc, app *model.OAuthApp) StoreChannel
	GetApp(T goi18n.TranslateFunc, id string) StoreChannel
	GetAppByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	SaveAuthData(T goi18n.TranslateFunc, authData *model.AuthData) StoreChannel
	GetAuthData(T goi18n.TranslateFunc, code string) StoreChannel
	RemoveAuthData(T goi18n.TranslateFunc, code string) StoreChannel
	PermanentDeleteAuthDataByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	SaveAccessData(T goi18n.TranslateFunc, accessData *model.AccessData) StoreChannel
	GetAccessData(T goi18n.TranslateFunc, token string) StoreChannel
	GetAccessDataByAuthCode(T goi18n.TranslateFunc, authCode string) StoreChannel
	RemoveAccessData(T goi18n.TranslateFunc, token string) StoreChannel
}

type SystemStore interface {
	Save(T goi18n.TranslateFunc, system *model.System) StoreChannel
	Update(T goi18n.TranslateFunc, system *model.System) StoreChannel
	Get(T goi18n.TranslateFunc) StoreChannel
}

type WebhookStore interface {
	SaveIncoming(T goi18n.TranslateFunc, webhook *model.IncomingWebhook) StoreChannel
	GetIncoming(T goi18n.TranslateFunc, id string) StoreChannel
	GetIncomingByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	GetIncomingByChannel(T goi18n.TranslateFunc, channelId string) StoreChannel
	DeleteIncoming(T goi18n.TranslateFunc, webhookId string, time int64) StoreChannel
	PermanentDeleteIncomingByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	SaveOutgoing(T goi18n.TranslateFunc, webhook *model.OutgoingWebhook) StoreChannel
	GetOutgoing(T goi18n.TranslateFunc, id string) StoreChannel
	GetOutgoingByCreator(T goi18n.TranslateFunc, userId string) StoreChannel
	GetOutgoingByChannel(T goi18n.TranslateFunc, channelId string) StoreChannel
	GetOutgoingByTeam(T goi18n.TranslateFunc, teamId string) StoreChannel
	DeleteOutgoing(T goi18n.TranslateFunc, webhookId string, time int64) StoreChannel
	PermanentDeleteOutgoingByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	UpdateOutgoing(T goi18n.TranslateFunc, hook *model.OutgoingWebhook) StoreChannel
}

type PreferenceStore interface {
	Save(T goi18n.TranslateFunc, preferences *model.Preferences) StoreChannel
	Get(T goi18n.TranslateFunc, userId string, category string, name string) StoreChannel
	GetCategory(T goi18n.TranslateFunc, userId string, category string) StoreChannel
	GetAll(T goi18n.TranslateFunc, userId string) StoreChannel
	PermanentDeleteByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	IsFeatureEnabled(T goi18n.TranslateFunc, feature, userId string) StoreChannel
}
