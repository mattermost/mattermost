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
	Save(T goi18n.TranslateFunc, channel *model.Channel) StoreChannel
	SaveDirectChannel(T goi18n.TranslateFunc, channel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) StoreChannel
	Update(T goi18n.TranslateFunc, channel *model.Channel) StoreChannel
	Get(T goi18n.TranslateFunc, id string) StoreChannel
	GetFromMaster(T goi18n.TranslateFunc, id string) StoreChannel
	Delete(T goi18n.TranslateFunc, channelId string, time int64) StoreChannel
	PermanentDeleteByTeam(T goi18n.TranslateFunc, teamId string) StoreChannel
	GetByName(T goi18n.TranslateFunc, team_id string, domain string) StoreChannel
	GetChannels(T goi18n.TranslateFunc, teamId string, userId string) StoreChannel
	GetMoreChannels(T goi18n.TranslateFunc, teamId string, userId string) StoreChannel
	GetChannelCounts(T goi18n.TranslateFunc, teamId string, userId string) StoreChannel
	GetForExport(T goi18n.TranslateFunc, teamId string) StoreChannel

	SaveMember(T goi18n.TranslateFunc, member *model.ChannelMember) StoreChannel
	UpdateMember(T goi18n.TranslateFunc, member *model.ChannelMember) StoreChannel
	GetMembers(T goi18n.TranslateFunc, channelId string) StoreChannel
	GetMember(T goi18n.TranslateFunc, channelId string, userId string) StoreChannel
	GetMemberCount(T goi18n.TranslateFunc, channelId string) StoreChannel
	RemoveMember(T goi18n.TranslateFunc, channelId string, userId string) StoreChannel
	PermanentDeleteMembersByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	GetExtraMembers(T goi18n.TranslateFunc, channelId string, limit int) StoreChannel
	CheckPermissionsTo(T goi18n.TranslateFunc, teamId string, channelId string, userId string) StoreChannel
	CheckOpenChannelPermissions(T goi18n.TranslateFunc, teamId string, channelId string) StoreChannel
	CheckPermissionsToByName(T goi18n.TranslateFunc, teamId string, channelName string, userId string) StoreChannel
	UpdateLastViewedAt(T goi18n.TranslateFunc, channelId string, userId string) StoreChannel
	IncrementMentionCount(T goi18n.TranslateFunc, channelId string, userId string) StoreChannel
	AnalyticsTypeCount(T goi18n.TranslateFunc, teamId string, channelType string) StoreChannel
}

type PostStore interface {
	Save(T goi18n.TranslateFunc, post *model.Post) StoreChannel
	Update(T goi18n.TranslateFunc, post *model.Post, newMessage string, newHashtags string) StoreChannel
	Get(T goi18n.TranslateFunc, id string) StoreChannel
	Delete(T goi18n.TranslateFunc, postId string, time int64) StoreChannel
	PermanentDeleteByUser(T goi18n.TranslateFunc, userId string) StoreChannel
	GetPosts(T goi18n.TranslateFunc, channelId string, offset int, limit int) StoreChannel
	GetPostsBefore(T goi18n.TranslateFunc, channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsAfter(T goi18n.TranslateFunc, channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsSince(T goi18n.TranslateFunc, channelId string, time int64) StoreChannel
	GetEtag(T goi18n.TranslateFunc, channelId string) StoreChannel
	Search(T goi18n.TranslateFunc, teamId string, userId string, params *model.SearchParams) StoreChannel
	GetForExport(T goi18n.TranslateFunc, channelId string) StoreChannel
	AnalyticsUserCountsWithPostsByDay(T goi18n.TranslateFunc, teamId string) StoreChannel
	AnalyticsPostCountsByDay(T goi18n.TranslateFunc, teamId string) StoreChannel
	AnalyticsPostCount(T goi18n.TranslateFunc, teamId string) StoreChannel
}

type UserStore interface {
	Save(T goi18n.TranslateFunc, user *model.User) StoreChannel
	Update(T goi18n.TranslateFunc, user *model.User, allowRoleUpdate bool) StoreChannel
	UpdateLastPictureUpdate(T goi18n.TranslateFunc, userId string) StoreChannel
	UpdateLastPingAt(T goi18n.TranslateFunc, userId string, time int64) StoreChannel
	UpdateLastActivityAt(T goi18n.TranslateFunc, userId string, time int64) StoreChannel
	UpdateUserAndSessionActivity(T goi18n.TranslateFunc, userId string, sessionId string, time int64) StoreChannel
	UpdatePassword(T goi18n.TranslateFunc, userId, newPassword string) StoreChannel
	UpdateAuthData(T goi18n.TranslateFunc, userId, service, authData string) StoreChannel
	Get(T goi18n.TranslateFunc, id string) StoreChannel
	GetProfiles(T goi18n.TranslateFunc, teamId string) StoreChannel
	GetByEmail(T goi18n.TranslateFunc, teamId string, email string) StoreChannel
	GetByAuth(T goi18n.TranslateFunc, teamId string, authData string, authService string) StoreChannel
	GetByUsername(T goi18n.TranslateFunc, teamId string, username string) StoreChannel
	VerifyEmail(T goi18n.TranslateFunc, userId string) StoreChannel
	GetEtagForProfiles(T goi18n.TranslateFunc, teamId string) StoreChannel
	UpdateFailedPasswordAttempts(T goi18n.TranslateFunc, userId string, attempts int) StoreChannel
	GetForExport(T goi18n.TranslateFunc, teamId string) StoreChannel
	GetTotalUsersCount(T goi18n.TranslateFunc) StoreChannel
	GetTotalActiveUsersCount(T goi18n.TranslateFunc) StoreChannel
	GetSystemAdminProfiles(T goi18n.TranslateFunc) StoreChannel
	PermanentDelete(T goi18n.TranslateFunc, userId string) StoreChannel
}

type SessionStore interface {
	Save(T goi18n.TranslateFunc, session *model.Session) StoreChannel
	Get(T goi18n.TranslateFunc, sessionIdOrToken string) StoreChannel
	GetSessions(T goi18n.TranslateFunc, userId string) StoreChannel
	Remove(T goi18n.TranslateFunc, sessionIdOrToken string) StoreChannel
	RemoveAllSessionsForTeam(T goi18n.TranslateFunc, teamId string) StoreChannel
	PermanentDeleteSessionsByUser(T goi18n.TranslateFunc, teamId string) StoreChannel
	UpdateLastActivityAt(T goi18n.TranslateFunc, sessionId string, time int64) StoreChannel
	UpdateRoles(T goi18n.TranslateFunc, userId string, roles string) StoreChannel
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
