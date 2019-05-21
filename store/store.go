// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
)

type StoreResult struct {
	Data interface{}
	Err  *model.AppError
}

type StoreChannel chan StoreResult

func Do(f func(result *StoreResult)) StoreChannel {
	storeChannel := make(StoreChannel, 1)
	go func() {
		result := StoreResult{}
		f(&result)
		storeChannel <- result
		close(storeChannel)
	}()
	return storeChannel
}

func Must(sc StoreChannel) interface{} {
	r := <-sc
	if r.Err != nil {

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
	Bot() BotStore
	Audit() AuditStore
	ClusterDiscovery() ClusterDiscoveryStore
	Compliance() ComplianceStore
	Session() SessionStore
	OAuth() OAuthStore
	System() SystemStore
	Webhook() WebhookStore
	Command() CommandStore
	CommandWebhook() CommandWebhookStore
	Preference() PreferenceStore
	License() LicenseStore
	Token() TokenStore
	Emoji() EmojiStore
	Status() StatusStore
	FileInfo() FileInfoStore
	Reaction() ReactionStore
	Role() RoleStore
	Scheme() SchemeStore
	Job() JobStore
	UserAccessToken() UserAccessTokenStore
	ChannelMemberHistory() ChannelMemberHistoryStore
	Plugin() PluginStore
	TermsOfService() TermsOfServiceStore
	Group() GroupStore
	UserTermsOfService() UserTermsOfServiceStore
	LinkMetadata() LinkMetadataStore
	MarkSystemRanUnitTests()
	Close()
	LockToMaster()
	UnlockFromMaster()
	DropAllTables()
	TotalMasterDbConnections() int
	TotalReadDbConnections() int
	TotalSearchDbConnections() int
}

type TeamStore interface {
	Save(team *model.Team) (*model.Team, *model.AppError)
	Update(team *model.Team) (*model.Team, *model.AppError)
	UpdateDisplayName(name string, teamId string) StoreChannel
	Get(id string) (*model.Team, *model.AppError)
	GetByName(name string) StoreChannel
	SearchByName(name string) StoreChannel
	SearchAll(term string) StoreChannel
	SearchOpen(term string) StoreChannel
	SearchPrivate(term string) StoreChannel
	GetAll() StoreChannel
	GetAllPage(offset int, limit int) StoreChannel
	GetAllPrivateTeamListing() StoreChannel
	GetAllPrivateTeamPageListing(offset int, limit int) StoreChannel
	GetAllTeamListing() StoreChannel
	GetAllTeamPageListing(offset int, limit int) StoreChannel
	GetTeamsByUserId(userId string) StoreChannel
	GetByInviteId(inviteId string) StoreChannel
	PermanentDelete(teamId string) StoreChannel
	AnalyticsTeamCount() StoreChannel
	SaveMember(member *model.TeamMember, maxUsersPerTeam int) StoreChannel
	UpdateMember(member *model.TeamMember) StoreChannel
	GetMember(teamId string, userId string) StoreChannel
	GetMembers(teamId string, offset int, limit int, restrictions *model.ViewUsersRestrictions) StoreChannel
	GetMembersByIds(teamId string, userIds []string, restrictions *model.ViewUsersRestrictions) StoreChannel
	GetTotalMemberCount(teamId string) StoreChannel
	GetActiveMemberCount(teamId string) StoreChannel
	GetTeamsForUser(userId string) StoreChannel
	GetTeamsForUserWithPagination(userId string, page, perPage int) StoreChannel
	GetChannelUnreadsForAllTeams(excludeTeamId, userId string) StoreChannel
	GetChannelUnreadsForTeam(teamId, userId string) StoreChannel
	RemoveMember(teamId string, userId string) StoreChannel
	RemoveAllMembersByTeam(teamId string) StoreChannel
	RemoveAllMembersByUser(userId string) StoreChannel
	UpdateLastTeamIconUpdate(teamId string, curTime int64) StoreChannel
	GetTeamsByScheme(schemeId string, offset int, limit int) StoreChannel
	MigrateTeamMembers(fromTeamId string, fromUserId string) StoreChannel
	ResetAllTeamSchemes() StoreChannel
	ClearAllCustomRoleAssignments() StoreChannel
	AnalyticsGetTeamCountForScheme(schemeId string) StoreChannel
	GetAllForExportAfter(limit int, afterId string) StoreChannel
	GetTeamMembersForExport(userId string) StoreChannel
	UserBelongsToTeams(userId string, teamIds []string) StoreChannel
	GetUserTeamIds(userId string, allowFromCache bool) StoreChannel
	InvalidateAllTeamIdsForUser(userId string)
	ClearCaches()
}

type ChannelStore interface {
	Save(channel *model.Channel, maxChannelsPerTeam int64) StoreChannel
	CreateDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError)
	SaveDirectChannel(channel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, *model.AppError)
	Update(channel *model.Channel) (*model.Channel, *model.AppError)
	Get(id string, allowFromCache bool) (*model.Channel, *model.AppError)
	InvalidateChannel(id string)
	InvalidateChannelByName(teamId, name string)
	GetFromMaster(id string) (*model.Channel, *model.AppError)
	Delete(channelId string, time int64) *model.AppError
	Restore(channelId string, time int64) *model.AppError
	SetDeleteAt(channelId string, deleteAt int64, updateAt int64) *model.AppError
	PermanentDeleteByTeam(teamId string) StoreChannel
	PermanentDelete(channelId string) StoreChannel
	GetByName(team_id string, name string, allowFromCache bool) StoreChannel
	GetByNames(team_id string, names []string, allowFromCache bool) StoreChannel
	GetByNameIncludeDeleted(team_id string, name string, allowFromCache bool) StoreChannel
	GetDeletedByName(team_id string, name string) StoreChannel
	GetDeleted(team_id string, offset int, limit int) StoreChannel
	GetChannels(teamId string, userId string, includeDeleted bool) StoreChannel
	GetAllChannels(page, perPage int, opts model.ChannelSearchOpts) StoreChannel
	GetMoreChannels(teamId string, userId string, offset int, limit int) StoreChannel
	GetPublicChannelsForTeam(teamId string, offset int, limit int) StoreChannel
	GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) StoreChannel
	GetChannelCounts(teamId string, userId string) StoreChannel
	GetTeamChannels(teamId string) StoreChannel
	GetAll(teamId string) StoreChannel
	GetChannelsByIds(channelIds []string) StoreChannel
	GetForPost(postId string) StoreChannel
	SaveMember(member *model.ChannelMember) StoreChannel
	UpdateMember(member *model.ChannelMember) StoreChannel
	GetMembers(channelId string, offset, limit int) StoreChannel
	GetMember(channelId string, userId string) (*model.ChannelMember, *model.AppError)
	GetChannelMembersTimezones(channelId string) StoreChannel
	GetAllChannelMembersForUser(userId string, allowFromCache bool, includeDeleted bool) StoreChannel
	InvalidateAllChannelMembersForUser(userId string)
	IsUserInChannelUseCache(userId string, channelId string) bool
	GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) StoreChannel
	InvalidateCacheForChannelMembersNotifyProps(channelId string)
	GetMemberForPost(postId string, userId string) StoreChannel
	InvalidateMemberCount(channelId string)
	GetMemberCountFromCache(channelId string) int64
	GetMemberCount(channelId string, allowFromCache bool) StoreChannel
	GetPinnedPosts(channelId string) StoreChannel
	RemoveMember(channelId string, userId string) StoreChannel
	PermanentDeleteMembersByUser(userId string) StoreChannel
	PermanentDeleteMembersByChannel(channelId string) StoreChannel
	UpdateLastViewedAt(channelIds []string, userId string) StoreChannel
	IncrementMentionCount(channelId string, userId string) StoreChannel
	AnalyticsTypeCount(teamId string, channelType string) StoreChannel
	GetMembersForUser(teamId string, userId string) StoreChannel
	GetMembersForUserWithPagination(teamId, userId string, page, perPage int) StoreChannel
	AutocompleteInTeam(teamId string, term string, includeDeleted bool) StoreChannel
	AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) StoreChannel
	SearchAllChannels(term string, opts model.ChannelSearchOpts) StoreChannel
	SearchInTeam(teamId string, term string, includeDeleted bool) StoreChannel
	SearchMore(userId string, teamId string, term string) StoreChannel
	GetMembersByIds(channelId string, userIds []string) StoreChannel
	AnalyticsDeletedTypeCount(teamId string, channelType string) StoreChannel
	GetChannelUnread(channelId, userId string) (*model.ChannelUnread, *model.AppError)
	ClearCaches()
	GetChannelsByScheme(schemeId string, offset int, limit int) StoreChannel
	MigrateChannelMembers(fromChannelId string, fromUserId string) StoreChannel
	ResetAllChannelSchemes() StoreChannel
	ClearAllCustomRoleAssignments() StoreChannel
	MigratePublicChannels() error
	GetAllChannelsForExportAfter(limit int, afterId string) StoreChannel
	GetAllDirectChannelsForExportAfter(limit int, afterId string) StoreChannel
	GetChannelMembersForExport(userId string, teamId string) StoreChannel
	RemoveAllDeactivatedMembers(channelId string) StoreChannel
	GetChannelsBatchForIndexing(startTime, endTime int64, limit int) StoreChannel
	UserBelongsToChannels(userId string, channelIds []string) StoreChannel
}

type ChannelMemberHistoryStore interface {
	LogJoinEvent(userId string, channelId string, joinTime int64) StoreChannel
	LogLeaveEvent(userId string, channelId string, leaveTime int64) StoreChannel
	GetUsersInChannelDuring(startTime int64, endTime int64, channelId string) StoreChannel
	PermanentDeleteBatch(endTime int64, limit int64) StoreChannel
}

type PostStore interface {
	Save(post *model.Post) StoreChannel
	Update(newPost *model.Post, oldPost *model.Post) StoreChannel
	Get(id string) (*model.PostList, *model.AppError)
	GetSingle(id string) StoreChannel
	Delete(postId string, time int64, deleteByID string) *model.AppError
	PermanentDeleteByUser(userId string) StoreChannel
	PermanentDeleteByChannel(channelId string) StoreChannel
	GetPosts(channelId string, offset int, limit int, allowFromCache bool) StoreChannel
	GetFlaggedPosts(userId string, offset int, limit int) StoreChannel
	GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) StoreChannel
	GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) StoreChannel
	GetPostsBefore(channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsAfter(channelId string, postId string, numPosts int, offset int) StoreChannel
	GetPostsSince(channelId string, time int64, allowFromCache bool) StoreChannel
	GetEtag(channelId string, allowFromCache bool) StoreChannel
	Search(teamId string, userId string, params *model.SearchParams) StoreChannel
	AnalyticsUserCountsWithPostsByDay(teamId string) StoreChannel
	AnalyticsPostCountsByDay(teamId string) StoreChannel
	AnalyticsPostCount(teamId string, mustHaveFile bool, mustHaveHashtag bool) StoreChannel
	ClearCaches()
	InvalidateLastPostTimeCache(channelId string)
	GetPostsCreatedAt(channelId string, time int64) StoreChannel
	Overwrite(post *model.Post) (*model.Post, *model.AppError)
	GetPostsByIds(postIds []string) StoreChannel
	GetPostsBatchForIndexing(startTime int64, endTime int64, limit int) StoreChannel
	PermanentDeleteBatch(endTime int64, limit int64) StoreChannel
	GetOldest() StoreChannel
	GetMaxPostSize() int
	GetParentsForExportAfter(limit int, afterId string) StoreChannel
	GetRepliesForExport(parentId string) StoreChannel
	GetDirectPostParentsForExportAfter(limit int, afterId string) StoreChannel
}

type UserStore interface {
	Save(user *model.User) StoreChannel
	Update(user *model.User, allowRoleUpdate bool) StoreChannel
	UpdateLastPictureUpdate(userId string) StoreChannel
	ResetLastPictureUpdate(userId string) StoreChannel
	UpdateUpdateAt(userId string) StoreChannel
	UpdatePassword(userId, newPassword string) StoreChannel
	UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) StoreChannel
	UpdateMfaSecret(userId, secret string) StoreChannel
	UpdateMfaActive(userId string, active bool) StoreChannel
	Get(id string) (*model.User, *model.AppError)
	GetAll() StoreChannel
	ClearCaches()
	InvalidateProfilesInChannelCacheByUser(userId string)
	InvalidateProfilesInChannelCache(channelId string)
	GetProfilesInChannel(channelId string, offset int, limit int) StoreChannel
	GetProfilesInChannelByStatus(channelId string, offset int, limit int) StoreChannel
	GetAllProfilesInChannel(channelId string, allowFromCache bool) StoreChannel
	GetProfilesNotInChannel(teamId string, channelId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	GetProfilesWithoutTeam(offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	GetProfilesByUsernames(usernames []string, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	GetAllProfiles(options *model.UserGetOptions) StoreChannel
	GetProfiles(options *model.UserGetOptions) StoreChannel
	GetProfileByIds(userId []string, allowFromCache bool, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	InvalidatProfileCacheForUser(userId string)
	GetByEmail(email string) StoreChannel
	GetByAuth(authData *string, authService string) StoreChannel
	GetAllUsingAuthService(authService string) StoreChannel
	GetByUsername(username string) StoreChannel
	GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail bool) StoreChannel
	VerifyEmail(userId, email string) StoreChannel
	GetEtagForAllProfiles() StoreChannel
	GetEtagForProfiles(teamId string) StoreChannel
	UpdateFailedPasswordAttempts(userId string, attempts int) StoreChannel
	GetSystemAdminProfiles() StoreChannel
	PermanentDelete(userId string) StoreChannel
	AnalyticsActiveCount(time int64) StoreChannel
	GetUnreadCount(userId string) StoreChannel
	GetUnreadCountForChannel(userId string, channelId string) StoreChannel
	GetAnyUnreadPostCountForChannel(userId string, channelId string) StoreChannel
	GetRecentlyActiveUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	GetNewUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	Search(teamId string, term string, options *model.UserSearchOptions) StoreChannel
	SearchNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) StoreChannel
	SearchInChannel(channelId string, term string, options *model.UserSearchOptions) StoreChannel
	SearchNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) StoreChannel
	SearchWithoutTeam(term string, options *model.UserSearchOptions) StoreChannel
	AnalyticsGetInactiveUsersCount() StoreChannel
	AnalyticsGetSystemAdminCount() StoreChannel
	GetProfilesNotInTeam(teamId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) StoreChannel
	GetEtagForProfilesNotInTeam(teamId string) StoreChannel
	ClearAllCustomRoleAssignments() StoreChannel
	InferSystemInstallDate() StoreChannel
	GetAllAfter(limit int, afterId string) StoreChannel
	GetUsersBatchForIndexing(startTime, endTime int64, limit int) StoreChannel
	Count(options model.UserCountOptions) StoreChannel
	GetTeamGroupUsers(teamID string) StoreChannel
	GetChannelGroupUsers(channelID string) StoreChannel
}

type BotStore interface {
	Get(userId string, includeDeleted bool) StoreChannel
	GetAll(options *model.BotGetOptions) StoreChannel
	Save(bot *model.Bot) StoreChannel
	Update(bot *model.Bot) StoreChannel
	PermanentDelete(userId string) StoreChannel
}

type SessionStore interface {
	Save(session *model.Session) StoreChannel
	Get(sessionIdOrToken string) StoreChannel
	GetSessions(userId string) StoreChannel
	GetSessionsWithActiveDeviceIds(userId string) StoreChannel
	Remove(sessionIdOrToken string) StoreChannel
	RemoveAllSessions() StoreChannel
	PermanentDeleteSessionsByUser(teamId string) StoreChannel
	UpdateLastActivityAt(sessionId string, time int64) StoreChannel
	UpdateRoles(userId string, roles string) StoreChannel
	UpdateDeviceId(id string, deviceId string, expiresAt int64) StoreChannel
	AnalyticsSessionCount() StoreChannel
	Cleanup(expiryTime int64, batchSize int64)
}

type AuditStore interface {
	Save(audit *model.Audit) *model.AppError
	Get(user_id string, offset int, limit int) (model.Audits, *model.AppError)
	PermanentDeleteByUser(userId string) *model.AppError
	PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError)
}

type ClusterDiscoveryStore interface {
	Save(discovery *model.ClusterDiscovery) *model.AppError
	Delete(discovery *model.ClusterDiscovery) (bool, *model.AppError)
	Exists(discovery *model.ClusterDiscovery) (bool, *model.AppError)
	GetAll(discoveryType, clusterName string) ([]*model.ClusterDiscovery, *model.AppError)
	SetLastPingAt(discovery *model.ClusterDiscovery) *model.AppError
	Cleanup() *model.AppError
}

type ComplianceStore interface {
	Save(compliance *model.Compliance) (*model.Compliance, *model.AppError)
	Update(compliance *model.Compliance) (*model.Compliance, *model.AppError)
	Get(id string) (*model.Compliance, *model.AppError)
	GetAll(offset, limit int) (model.Compliances, *model.AppError)
	ComplianceExport(compliance *model.Compliance) ([]*model.CompliancePost, *model.AppError)
	MessageExport(after int64, limit int) ([]*model.MessageExport, *model.AppError)
}

type OAuthStore interface {
	SaveApp(app *model.OAuthApp) StoreChannel
	UpdateApp(app *model.OAuthApp) StoreChannel
	GetApp(id string) StoreChannel
	GetAppByUser(userId string, offset, limit int) StoreChannel
	GetApps(offset, limit int) StoreChannel
	GetAuthorizedApps(userId string, offset, limit int) StoreChannel
	DeleteApp(id string) StoreChannel
	SaveAuthData(authData *model.AuthData) StoreChannel
	GetAuthData(code string) StoreChannel
	RemoveAuthData(code string) StoreChannel
	PermanentDeleteAuthDataByUser(userId string) StoreChannel
	SaveAccessData(accessData *model.AccessData) StoreChannel
	UpdateAccessData(accessData *model.AccessData) StoreChannel
	GetAccessData(token string) StoreChannel
	GetAccessDataByUserForApp(userId, clientId string) StoreChannel
	GetAccessDataByRefreshToken(token string) StoreChannel
	GetPreviousAccessData(userId, clientId string) StoreChannel
	RemoveAccessData(token string) StoreChannel
}

type SystemStore interface {
	Save(system *model.System) *model.AppError
	SaveOrUpdate(system *model.System) *model.AppError
	Update(system *model.System) *model.AppError
	Get() (model.StringMap, *model.AppError)
	GetByName(name string) (*model.System, *model.AppError)
	PermanentDeleteByName(name string) (*model.System, *model.AppError)
}

type WebhookStore interface {
	SaveIncoming(webhook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError)
	GetIncoming(id string, allowFromCache bool) (*model.IncomingWebhook, *model.AppError)
	GetIncomingList(offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	GetIncomingByTeam(teamId string, offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	UpdateIncoming(webhook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError)
	GetIncomingByChannel(channelId string) ([]*model.IncomingWebhook, *model.AppError)
	DeleteIncoming(webhookId string, time int64) *model.AppError
	PermanentDeleteIncomingByChannel(channelId string) *model.AppError
	PermanentDeleteIncomingByUser(userId string) *model.AppError

	SaveOutgoing(webhook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError)
	GetOutgoing(id string) (*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByChannel(channelId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingList(offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByTeam(teamId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	DeleteOutgoing(webhookId string, time int64) *model.AppError
	PermanentDeleteOutgoingByChannel(channelId string) *model.AppError
	PermanentDeleteOutgoingByUser(userId string) *model.AppError
	UpdateOutgoing(hook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError)

	AnalyticsIncomingCount(teamId string) (int64, *model.AppError)
	AnalyticsOutgoingCount(teamId string) (int64, *model.AppError)
	InvalidateWebhookCache(webhook string)
	ClearCaches()
}

type CommandStore interface {
	Save(webhook *model.Command) (*model.Command, *model.AppError)
	GetByTrigger(teamId string, trigger string) (*model.Command, *model.AppError)
	Get(id string) (*model.Command, *model.AppError)
	GetByTeam(teamId string) ([]*model.Command, *model.AppError)
	Delete(commandId string, time int64) *model.AppError
	PermanentDeleteByTeam(teamId string) *model.AppError
	PermanentDeleteByUser(userId string) *model.AppError
	Update(hook *model.Command) (*model.Command, *model.AppError)
	AnalyticsCommandCount(teamId string) (int64, *model.AppError)
}

type CommandWebhookStore interface {
	Save(webhook *model.CommandWebhook) StoreChannel
	Get(id string) StoreChannel
	TryUse(id string, limit int) StoreChannel
	Cleanup()
}

type PreferenceStore interface {
	Save(preferences *model.Preferences) StoreChannel
	GetCategory(userId string, category string) (model.Preferences, *model.AppError)
	Get(userId string, category string, name string) (*model.Preference, *model.AppError)
	GetAll(userId string) StoreChannel
	Delete(userId, category, name string) StoreChannel
	DeleteCategory(userId string, category string) StoreChannel
	DeleteCategoryAndName(category string, name string) StoreChannel
	PermanentDeleteByUser(userId string) *model.AppError
	IsFeatureEnabled(feature, userId string) StoreChannel
	CleanupFlagsBatch(limit int64) StoreChannel
}

type LicenseStore interface {
	Save(license *model.LicenseRecord) (*model.LicenseRecord, *model.AppError)
	Get(id string) (*model.LicenseRecord, *model.AppError)
}

type TokenStore interface {
	Save(recovery *model.Token) StoreChannel
	Delete(token string) StoreChannel
	GetByToken(token string) StoreChannel
	Cleanup()
	RemoveAllTokensByType(tokenType string) StoreChannel
}

type EmojiStore interface {
	Save(emoji *model.Emoji) StoreChannel
	Get(id string, allowFromCache bool) (*model.Emoji, *model.AppError)
	GetByName(name string) StoreChannel
	GetMultipleByName(names []string) StoreChannel
	GetList(offset, limit int, sort string) StoreChannel
	Delete(id string, time int64) StoreChannel
	Search(name string, prefixOnly bool, limit int) StoreChannel
}

type StatusStore interface {
	SaveOrUpdate(status *model.Status) StoreChannel
	Get(userId string) StoreChannel
	GetByIds(userIds []string) StoreChannel
	GetOnlineAway() StoreChannel
	GetOnline() StoreChannel
	GetAllFromTeam(teamId string) StoreChannel
	ResetAll() StoreChannel
	GetTotalActiveUsersCount() StoreChannel
	UpdateLastActivityAt(userId string, lastActivityAt int64) StoreChannel
}

type FileInfoStore interface {
	Save(info *model.FileInfo) (*model.FileInfo, *model.AppError)
	Get(id string) (*model.FileInfo, *model.AppError)
	GetByPath(path string) (*model.FileInfo, *model.AppError)
	GetForPost(postId string, readFromMaster bool, allowFromCache bool) ([]*model.FileInfo, *model.AppError)
	GetForUser(userId string) ([]*model.FileInfo, *model.AppError)
	InvalidateFileInfosForPostCache(postId string)
	AttachToPost(fileId string, postId string, creatorId string) *model.AppError
	DeleteForPost(postId string) (string, *model.AppError)
	PermanentDelete(fileId string) *model.AppError
	PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError)
	PermanentDeleteByUser(userId string) (int64, *model.AppError)
	ClearCaches()
}

type ReactionStore interface {
	Save(reaction *model.Reaction) (*model.Reaction, *model.AppError)
	Delete(reaction *model.Reaction) (*model.Reaction, *model.AppError)
	GetForPost(postId string, allowFromCache bool) ([]*model.Reaction, *model.AppError)
	DeleteAllWithEmojiName(emojiName string) *model.AppError
	PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError)
	BulkGetForPosts(postIds []string) ([]*model.Reaction, *model.AppError)
}

type JobStore interface {
	Save(job *model.Job) StoreChannel
	UpdateOptimistically(job *model.Job, currentStatus string) StoreChannel
	UpdateStatus(id string, status string) StoreChannel
	UpdateStatusOptimistically(id string, currentStatus string, newStatus string) StoreChannel
	Get(id string) StoreChannel
	GetAllPage(offset int, limit int) StoreChannel
	GetAllByType(jobType string) StoreChannel
	GetAllByTypePage(jobType string, offset int, limit int) StoreChannel
	GetAllByStatus(status string) StoreChannel
	GetNewestJobByStatusAndType(status string, jobType string) StoreChannel
	GetCountByStatusAndType(status string, jobType string) StoreChannel
	Delete(id string) StoreChannel
}

type UserAccessTokenStore interface {
	Save(token *model.UserAccessToken) StoreChannel
	Delete(tokenId string) StoreChannel
	DeleteAllForUser(userId string) StoreChannel
	Get(tokenId string) StoreChannel
	GetAll(offset int, limit int) StoreChannel
	GetByToken(tokenString string) StoreChannel
	GetByUser(userId string, page, perPage int) StoreChannel
	Search(term string) StoreChannel
	UpdateTokenEnable(tokenId string) StoreChannel
	UpdateTokenDisable(tokenId string) StoreChannel
}

type PluginStore interface {
	SaveOrUpdate(keyVal *model.PluginKeyValue) StoreChannel
	CompareAndSet(keyVal *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError)
	Get(pluginId, key string) StoreChannel
	Delete(pluginId, key string) StoreChannel
	DeleteAllForPlugin(PluginId string) StoreChannel
	DeleteAllExpired() StoreChannel
	List(pluginId string, page, perPage int) StoreChannel
}

type RoleStore interface {
	Save(role *model.Role) (*model.Role, *model.AppError)
	Get(roleId string) (*model.Role, *model.AppError)
	GetAll() ([]*model.Role, *model.AppError)
	GetByName(name string) (*model.Role, *model.AppError)
	GetByNames(names []string) ([]*model.Role, *model.AppError)
	Delete(roldId string) (*model.Role, *model.AppError)
	PermanentDeleteAll() *model.AppError
}

type SchemeStore interface {
	Save(scheme *model.Scheme) StoreChannel
	Get(schemeId string) StoreChannel
	GetByName(schemeName string) StoreChannel
	GetAllPage(scope string, offset int, limit int) StoreChannel
	Delete(schemeId string) StoreChannel
	PermanentDeleteAll() StoreChannel
}

type TermsOfServiceStore interface {
	Save(termsOfService *model.TermsOfService) StoreChannel
	GetLatest(allowFromCache bool) StoreChannel
	Get(id string, allowFromCache bool) StoreChannel
}

type UserTermsOfServiceStore interface {
	GetByUser(userId string) StoreChannel
	Save(userTermsOfService *model.UserTermsOfService) StoreChannel
	Delete(userId, termsOfServiceId string) StoreChannel
}

type GroupStore interface {
	Create(group *model.Group) StoreChannel
	Get(groupID string) StoreChannel
	GetByRemoteID(remoteID string, groupSource model.GroupSource) StoreChannel
	GetAllBySource(groupSource model.GroupSource) StoreChannel
	Update(group *model.Group) StoreChannel
	Delete(groupID string) StoreChannel

	GetMemberUsers(groupID string) StoreChannel
	GetMemberUsersPage(groupID string, offset int, limit int) StoreChannel
	GetMemberCount(groupID string) StoreChannel
	CreateOrRestoreMember(groupID string, userID string) StoreChannel
	DeleteMember(groupID string, userID string) StoreChannel

	CreateGroupSyncable(groupSyncable *model.GroupSyncable) StoreChannel
	GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) StoreChannel
	GetAllGroupSyncablesByGroupId(groupID string, syncableType model.GroupSyncableType) StoreChannel
	UpdateGroupSyncable(groupSyncable *model.GroupSyncable) StoreChannel
	DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) StoreChannel

	TeamMembersToAdd(since int64) StoreChannel
	ChannelMembersToAdd(since int64) StoreChannel

	TeamMembersToRemove() StoreChannel
	ChannelMembersToRemove() StoreChannel

	GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) StoreChannel
	CountGroupsByChannel(channelId string, opts model.GroupSearchOpts) StoreChannel

	GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) StoreChannel
	CountGroupsByTeam(teamId string, opts model.GroupSearchOpts) StoreChannel

	GetGroups(page, perPage int, opts model.GroupSearchOpts) StoreChannel
}

type LinkMetadataStore interface {
	Save(linkMetadata *model.LinkMetadata) StoreChannel
	Get(url string, timestamp int64) StoreChannel
}
