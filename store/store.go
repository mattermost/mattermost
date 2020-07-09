//go:generate go run layer_generators/main.go

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"context"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
)

type StoreResult struct {
	Data interface{}
	Err  *model.AppError

	// NErr a temporary field used by the new code for the AppError migration. This will later become Err when the entire store is migrated.
	NErr error
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
	RecycleDBConnections(d time.Duration)
	GetCurrentSchemaVersion() string
	GetDbVersion() (string, error)
	TotalMasterDbConnections() int
	TotalReadDbConnections() int
	TotalSearchDbConnections() int
	CheckIntegrity() <-chan IntegrityCheckResult
	SetContext(context context.Context)
	Context() context.Context
}

type TeamStore interface {
	Save(team *model.Team) (*model.Team, *model.AppError)
	Update(team *model.Team) (*model.Team, *model.AppError)
	Get(id string) (*model.Team, *model.AppError)
	GetByName(name string) (*model.Team, *model.AppError)
	GetByNames(name []string) ([]*model.Team, *model.AppError)
	SearchAll(term string) ([]*model.Team, *model.AppError)
	SearchAllPaged(term string, page int, perPage int) ([]*model.Team, int64, *model.AppError)
	SearchOpen(term string) ([]*model.Team, *model.AppError)
	SearchPrivate(term string) ([]*model.Team, *model.AppError)
	GetAll() ([]*model.Team, *model.AppError)
	GetAllPage(offset int, limit int) ([]*model.Team, *model.AppError)
	GetAllPrivateTeamListing() ([]*model.Team, *model.AppError)
	GetAllPrivateTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError)
	GetAllPublicTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError)
	GetAllTeamListing() ([]*model.Team, *model.AppError)
	GetAllTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError)
	GetTeamsByUserId(userId string) ([]*model.Team, *model.AppError)
	GetByInviteId(inviteId string) (*model.Team, *model.AppError)
	PermanentDelete(teamId string) *model.AppError
	AnalyticsTeamCount(includeDeleted bool) (int64, *model.AppError)
	AnalyticsPublicTeamCount() (int64, *model.AppError)
	AnalyticsPrivateTeamCount() (int64, *model.AppError)
	SaveMultipleMembers(members []*model.TeamMember, maxUsersPerTeam int) ([]*model.TeamMember, *model.AppError)
	SaveMember(member *model.TeamMember, maxUsersPerTeam int) (*model.TeamMember, *model.AppError)
	UpdateMember(member *model.TeamMember) (*model.TeamMember, *model.AppError)
	UpdateMultipleMembers(members []*model.TeamMember) ([]*model.TeamMember, *model.AppError)
	GetMember(teamId string, userId string) (*model.TeamMember, *model.AppError)
	GetMembers(teamId string, offset int, limit int, teamMembersGetOptions *model.TeamMembersGetOptions) ([]*model.TeamMember, *model.AppError)
	GetMembersByIds(teamId string, userIds []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError)
	GetTotalMemberCount(teamId string, restrictions *model.ViewUsersRestrictions) (int64, *model.AppError)
	GetActiveMemberCount(teamId string, restrictions *model.ViewUsersRestrictions) (int64, *model.AppError)
	GetTeamsForUser(userId string) ([]*model.TeamMember, *model.AppError)
	GetTeamsForUserWithPagination(userId string, page, perPage int) ([]*model.TeamMember, *model.AppError)
	GetChannelUnreadsForAllTeams(excludeTeamId, userId string) ([]*model.ChannelUnread, *model.AppError)
	GetChannelUnreadsForTeam(teamId, userId string) ([]*model.ChannelUnread, *model.AppError)
	RemoveMember(teamId string, userId string) *model.AppError
	RemoveMembers(teamId string, userIds []string) *model.AppError
	RemoveAllMembersByTeam(teamId string) *model.AppError
	RemoveAllMembersByUser(userId string) *model.AppError
	UpdateLastTeamIconUpdate(teamId string, curTime int64) *model.AppError
	GetTeamsByScheme(schemeId string, offset int, limit int) ([]*model.Team, *model.AppError)
	MigrateTeamMembers(fromTeamId string, fromUserId string) (map[string]string, *model.AppError)
	ResetAllTeamSchemes() *model.AppError
	ClearAllCustomRoleAssignments() *model.AppError
	AnalyticsGetTeamCountForScheme(schemeId string) (int64, *model.AppError)
	GetAllForExportAfter(limit int, afterId string) ([]*model.TeamForExport, *model.AppError)
	GetTeamMembersForExport(userId string) ([]*model.TeamMemberForExport, *model.AppError)
	UserBelongsToTeams(userId string, teamIds []string) (bool, *model.AppError)
	GetUserTeamIds(userId string, allowFromCache bool) ([]string, *model.AppError)
	InvalidateAllTeamIdsForUser(userId string)
	ClearCaches()

	// UpdateMembersRole sets all of the given team members to admins and all of the other members of the team to
	// non-admin members.
	UpdateMembersRole(teamID string, userIDs []string) *model.AppError

	// GroupSyncedTeamCount returns the count of non-deleted group-constrained teams.
	GroupSyncedTeamCount() (int64, *model.AppError)
}

type ChannelStore interface {
	Save(channel *model.Channel, maxChannelsPerTeam int64) (*model.Channel, error)
	CreateDirectChannel(userId *model.User, otherUserId *model.User) (*model.Channel, error)
	SaveDirectChannel(channel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, error)
	Update(channel *model.Channel) (*model.Channel, error)
	UpdateSidebarChannelCategoryOnMove(channel *model.Channel, newTeamId string) *model.AppError
	ClearSidebarOnTeamLeave(userId, teamId string) *model.AppError
	Get(id string, allowFromCache bool) (*model.Channel, error)
	InvalidateChannel(id string)
	InvalidateChannelByName(teamId, name string)
	GetFromMaster(id string) (*model.Channel, error)
	Delete(channelId string, time int64) error
	Restore(channelId string, time int64) error
	SetDeleteAt(channelId string, deleteAt int64, updateAt int64) error
	PermanentDelete(channelId string) error
	PermanentDeleteByTeam(teamId string) error
	GetByName(team_id string, name string, allowFromCache bool) (*model.Channel, error)
	GetByNames(team_id string, names []string, allowFromCache bool) ([]*model.Channel, error)
	GetByNameIncludeDeleted(team_id string, name string, allowFromCache bool) (*model.Channel, error)
	GetDeletedByName(team_id string, name string) (*model.Channel, error)
	GetDeleted(team_id string, offset int, limit int, userId string) (*model.ChannelList, error)
	GetChannels(teamId string, userId string, includeDeleted bool) (*model.ChannelList, error)
	GetAllChannels(page, perPage int, opts ChannelSearchOpts) (*model.ChannelListWithTeamData, error)
	GetAllChannelsCount(opts ChannelSearchOpts) (int64, error)
	GetMoreChannels(teamId string, userId string, offset int, limit int) (*model.ChannelList, error)
	GetPrivateChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError)
	GetPublicChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError)
	GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (*model.ChannelList, *model.AppError)
	GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, *model.AppError)
	GetTeamChannels(teamId string) (*model.ChannelList, *model.AppError)
	GetAll(teamId string) ([]*model.Channel, *model.AppError)
	GetChannelsByIds(channelIds []string, includeDeleted bool) ([]*model.Channel, *model.AppError)
	GetForPost(postId string) (*model.Channel, *model.AppError)
	SaveMultipleMembers(members []*model.ChannelMember) ([]*model.ChannelMember, *model.AppError)
	SaveMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError)
	UpdateMember(member *model.ChannelMember) (*model.ChannelMember, *model.AppError)
	UpdateMultipleMembers(members []*model.ChannelMember) ([]*model.ChannelMember, *model.AppError)
	GetMembers(channelId string, offset, limit int) (*model.ChannelMembers, *model.AppError)
	GetMember(channelId string, userId string) (*model.ChannelMember, *model.AppError)
	GetChannelMembersTimezones(channelId string) ([]model.StringMap, *model.AppError)
	GetAllChannelMembersForUser(userId string, allowFromCache bool, includeDeleted bool) (map[string]string, *model.AppError)
	InvalidateAllChannelMembersForUser(userId string)
	IsUserInChannelUseCache(userId string, channelId string) bool
	GetAllChannelMembersNotifyPropsForChannel(channelId string, allowFromCache bool) (map[string]model.StringMap, *model.AppError)
	InvalidateCacheForChannelMembersNotifyProps(channelId string)
	GetMemberForPost(postId string, userId string) (*model.ChannelMember, *model.AppError)
	InvalidateMemberCount(channelId string)
	GetMemberCountFromCache(channelId string) int64
	GetMemberCount(channelId string, allowFromCache bool) (int64, *model.AppError)
	GetMemberCountsByGroup(channelID string, includeTimezones bool) ([]*model.ChannelMemberCountByGroup, *model.AppError)
	InvalidatePinnedPostCount(channelId string)
	GetPinnedPostCount(channelId string, allowFromCache bool) (int64, *model.AppError)
	InvalidateGuestCount(channelId string)
	GetGuestCount(channelId string, allowFromCache bool) (int64, *model.AppError)
	GetPinnedPosts(channelId string) (*model.PostList, *model.AppError)
	RemoveMember(channelId string, userId string) *model.AppError
	RemoveMembers(channelId string, userIds []string) *model.AppError
	PermanentDeleteMembersByUser(userId string) *model.AppError
	PermanentDeleteMembersByChannel(channelId string) *model.AppError
	UpdateLastViewedAt(channelIds []string, userId string) (map[string]int64, *model.AppError)
	UpdateLastViewedAtPost(unreadPost *model.Post, userID string, mentionCount int) (*model.ChannelUnreadAt, *model.AppError)
	CountPostsAfter(channelId string, timestamp int64, userId string) (int, *model.AppError)
	IncrementMentionCount(channelId string, userId string) *model.AppError
	AnalyticsTypeCount(teamId string, channelType string) (int64, *model.AppError)
	GetMembersForUser(teamId string, userId string) (*model.ChannelMembers, *model.AppError)
	GetMembersForUserWithPagination(teamId, userId string, page, perPage int) (*model.ChannelMembers, *model.AppError)
	AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError)
	AutocompleteInTeamForSearch(teamId string, userId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError)
	SearchAllChannels(term string, opts ChannelSearchOpts) (*model.ChannelListWithTeamData, int64, *model.AppError)
	SearchInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError)
	SearchArchivedInTeam(teamId string, term string, userId string) (*model.ChannelList, *model.AppError)
	SearchForUserInTeam(userId string, teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError)
	SearchMore(userId string, teamId string, term string) (*model.ChannelList, *model.AppError)
	SearchGroupChannels(userId, term string) (*model.ChannelList, *model.AppError)
	GetMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError)
	AnalyticsDeletedTypeCount(teamId string, channelType string) (int64, *model.AppError)
	GetChannelUnread(channelId, userId string) (*model.ChannelUnread, *model.AppError)
	ClearCaches()
	GetChannelsByScheme(schemeId string, offset int, limit int) (model.ChannelList, *model.AppError)
	MigrateChannelMembers(fromChannelId string, fromUserId string) (map[string]string, *model.AppError)
	ResetAllChannelSchemes() *model.AppError
	ClearAllCustomRoleAssignments() *model.AppError
	MigratePublicChannels() error
	MigrateSidebarCategories(fromTeamId, fromUserId string) (map[string]interface{}, error)
	CreateInitialSidebarCategories(userId, teamId string) error
	MigrateFavoritesToSidebarChannels(lastUserId string, runningOrder int64) (map[string]interface{}, error)
	GetSidebarCategories(userId, teamId string) (*model.OrderedSidebarCategories, *model.AppError)
	GetSidebarCategory(categoryId string) (*model.SidebarCategoryWithChannels, *model.AppError)
	GetSidebarCategoryOrder(userId, teamId string) ([]string, *model.AppError)
	CreateSidebarCategory(userId, teamId string, newCategory *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, *model.AppError)
	UpdateSidebarCategoryOrder(userId, teamId string, categoryOrder []string) *model.AppError
	UpdateSidebarCategories(userId, teamId string, categories []*model.SidebarCategoryWithChannels) ([]*model.SidebarCategoryWithChannels, *model.AppError)
	UpdateSidebarChannelsByPreferences(preferences *model.Preferences) *model.AppError
	DeleteSidebarCategory(categoryId string) *model.AppError
	GetAllChannelsForExportAfter(limit int, afterId string) ([]*model.ChannelForExport, *model.AppError)
	GetAllDirectChannelsForExportAfter(limit int, afterId string) ([]*model.DirectChannelForExport, *model.AppError)
	GetChannelMembersForExport(userId string, teamId string) ([]*model.ChannelMemberForExport, *model.AppError)
	RemoveAllDeactivatedMembers(channelId string) *model.AppError
	GetChannelsBatchForIndexing(startTime, endTime int64, limit int) ([]*model.Channel, *model.AppError)
	UserBelongsToChannels(userId string, channelIds []string) (bool, *model.AppError)

	// UpdateMembersRole sets all of the given team members to admins and all of the other members of the team to
	// non-admin members.
	UpdateMembersRole(channelID string, userIDs []string) *model.AppError

	// GroupSyncedChannelCount returns the count of non-deleted group-constrained channels.
	GroupSyncedChannelCount() (int64, *model.AppError)
}

type ChannelMemberHistoryStore interface {
	LogJoinEvent(userId string, channelId string, joinTime int64) error
	LogLeaveEvent(userId string, channelId string, leaveTime int64) error
	GetUsersInChannelDuring(startTime int64, endTime int64, channelId string) ([]*model.ChannelMemberHistoryResult, error)
	PermanentDeleteBatch(endTime int64, limit int64) (int64, error)
}

type PostStore interface {
	SaveMultiple(posts []*model.Post) ([]*model.Post, int, *model.AppError)
	Save(post *model.Post) (*model.Post, *model.AppError)
	Update(newPost *model.Post, oldPost *model.Post) (*model.Post, *model.AppError)
	Get(id string, skipFetchThreads bool) (*model.PostList, *model.AppError)
	GetSingle(id string) (*model.Post, *model.AppError)
	Delete(postId string, time int64, deleteByID string) *model.AppError
	PermanentDeleteByUser(userId string) *model.AppError
	PermanentDeleteByChannel(channelId string) *model.AppError
	GetPosts(options model.GetPostsOptions, allowFromCache bool) (*model.PostList, *model.AppError)
	GetFlaggedPosts(userId string, offset int, limit int) (*model.PostList, *model.AppError)
	// @openTracingParams userId, teamId, offset, limit
	GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) (*model.PostList, *model.AppError)
	GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) (*model.PostList, *model.AppError)
	GetPostsBefore(options model.GetPostsOptions) (*model.PostList, *model.AppError)
	GetPostsAfter(options model.GetPostsOptions) (*model.PostList, *model.AppError)
	GetPostsSince(options model.GetPostsSinceOptions, allowFromCache bool) (*model.PostList, *model.AppError)
	GetPostAfterTime(channelId string, time int64) (*model.Post, *model.AppError)
	GetPostIdAfterTime(channelId string, time int64) (string, *model.AppError)
	GetPostIdBeforeTime(channelId string, time int64) (string, *model.AppError)
	GetEtag(channelId string, allowFromCache bool) string
	Search(teamId string, userId string, params *model.SearchParams) (*model.PostList, *model.AppError)
	AnalyticsUserCountsWithPostsByDay(teamId string) (model.AnalyticsRows, *model.AppError)
	AnalyticsPostCountsByDay(options *model.AnalyticsPostCountsOptions) (model.AnalyticsRows, *model.AppError)
	AnalyticsPostCount(teamId string, mustHaveFile bool, mustHaveHashtag bool) (int64, *model.AppError)
	ClearCaches()
	InvalidateLastPostTimeCache(channelId string)
	GetPostsCreatedAt(channelId string, time int64) ([]*model.Post, *model.AppError)
	Overwrite(post *model.Post) (*model.Post, *model.AppError)
	OverwriteMultiple(posts []*model.Post) ([]*model.Post, int, *model.AppError)
	GetPostsByIds(postIds []string) ([]*model.Post, *model.AppError)
	GetPostsBatchForIndexing(startTime int64, endTime int64, limit int) ([]*model.PostForIndexing, *model.AppError)
	PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError)
	GetOldest() (*model.Post, *model.AppError)
	GetMaxPostSize() int
	GetParentsForExportAfter(limit int, afterId string) ([]*model.PostForExport, *model.AppError)
	GetRepliesForExport(parentId string) ([]*model.ReplyForExport, *model.AppError)
	GetDirectPostParentsForExportAfter(limit int, afterId string) ([]*model.DirectPostForExport, *model.AppError)
	SearchPostsInTeamForUser(paramsList []*model.SearchParams, userId, teamId string, isOrSearch, includeDeletedChannels bool, page, perPage int) (*model.PostSearchResults, *model.AppError)
	GetOldestEntityCreationTime() (int64, *model.AppError)
}

type UserStore interface {
	Save(user *model.User) (*model.User, *model.AppError)
	Update(user *model.User, allowRoleUpdate bool) (*model.UserUpdate, *model.AppError)
	UpdateLastPictureUpdate(userId string) *model.AppError
	ResetLastPictureUpdate(userId string) *model.AppError
	UpdatePassword(userId, newPassword string) *model.AppError
	UpdateUpdateAt(userId string) (int64, *model.AppError)
	UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) (string, *model.AppError)
	UpdateMfaSecret(userId, secret string) *model.AppError
	UpdateMfaActive(userId string, active bool) *model.AppError
	Get(id string) (*model.User, *model.AppError)
	GetAll() ([]*model.User, *model.AppError)
	ClearCaches()
	InvalidateProfilesInChannelCacheByUser(userId string)
	InvalidateProfilesInChannelCache(channelId string)
	GetProfilesInChannel(channelId string, offset int, limit int) ([]*model.User, *model.AppError)
	GetProfilesInChannelByStatus(channelId string, offset int, limit int) ([]*model.User, *model.AppError)
	GetAllProfilesInChannel(channelId string, allowFromCache bool) (map[string]*model.User, *model.AppError)
	GetProfilesNotInChannel(teamId string, channelId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError)
	GetProfilesWithoutTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError)
	GetProfilesByUsernames(usernames []string, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError)
	GetAllProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError)
	GetProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError)
	GetProfileByIds(userIds []string, options *UserGetByIdsOpts, allowFromCache bool) ([]*model.User, *model.AppError)
	GetProfileByGroupChannelIdsForUser(userId string, channelIds []string) (map[string][]*model.User, *model.AppError)
	InvalidateProfileCacheForUser(userId string)
	GetByEmail(email string) (*model.User, *model.AppError)
	GetByAuth(authData *string, authService string) (*model.User, *model.AppError)
	GetAllUsingAuthService(authService string) ([]*model.User, *model.AppError)
	GetAllNotInAuthService(authServices []string) ([]*model.User, *model.AppError)
	GetByUsername(username string) (*model.User, *model.AppError)
	GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail bool) (*model.User, *model.AppError)
	VerifyEmail(userId, email string) (string, *model.AppError)
	GetEtagForAllProfiles() string
	GetEtagForProfiles(teamId string) string
	UpdateFailedPasswordAttempts(userId string, attempts int) *model.AppError
	GetSystemAdminProfiles() (map[string]*model.User, *model.AppError)
	PermanentDelete(userId string) *model.AppError
	AnalyticsActiveCount(time int64, options model.UserCountOptions) (int64, *model.AppError)
	GetUnreadCount(userId string) (int64, *model.AppError)
	GetUnreadCountForChannel(userId string, channelId string) (int64, *model.AppError)
	GetAnyUnreadPostCountForChannel(userId string, channelId string) (int64, *model.AppError)
	GetRecentlyActiveUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError)
	GetNewUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError)
	Search(teamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	SearchNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	SearchInChannel(channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	SearchNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	SearchWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	SearchInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError)
	AnalyticsGetInactiveUsersCount() (int64, *model.AppError)
	AnalyticsGetSystemAdminCount() (int64, *model.AppError)
	AnalyticsGetGuestCount() (int64, *model.AppError)
	GetProfilesNotInTeam(teamId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError)
	GetEtagForProfilesNotInTeam(teamId string) string
	ClearAllCustomRoleAssignments() *model.AppError
	InferSystemInstallDate() (int64, *model.AppError)
	GetAllAfter(limit int, afterId string) ([]*model.User, *model.AppError)
	GetUsersBatchForIndexing(startTime, endTime int64, limit int) ([]*model.UserForIndexing, *model.AppError)
	Count(options model.UserCountOptions) (int64, *model.AppError)
	GetTeamGroupUsers(teamID string) ([]*model.User, *model.AppError)
	GetChannelGroupUsers(channelID string) ([]*model.User, *model.AppError)
	PromoteGuestToUser(userID string) *model.AppError
	DemoteUserToGuest(userID string) *model.AppError
	DeactivateGuests() ([]string, *model.AppError)
	AutocompleteUsersInChannel(teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError)
	GetKnownUsers(userID string) ([]string, *model.AppError)
}

type BotStore interface {
	Get(userId string, includeDeleted bool) (*model.Bot, error)
	GetAll(options *model.BotGetOptions) ([]*model.Bot, error)
	Save(bot *model.Bot) (*model.Bot, error)
	Update(bot *model.Bot) (*model.Bot, error)
	PermanentDelete(userId string) error
}

type SessionStore interface {
	Get(sessionIdOrToken string) (*model.Session, *model.AppError)
	Save(session *model.Session) (*model.Session, *model.AppError)
	GetSessions(userId string) ([]*model.Session, *model.AppError)
	GetSessionsWithActiveDeviceIds(userId string) ([]*model.Session, *model.AppError)
	GetSessionsExpired(thresholdMillis int64, mobileOnly bool, unnotifiedOnly bool) ([]*model.Session, *model.AppError)
	UpdateExpiredNotify(sessionid string, notified bool) *model.AppError
	Remove(sessionIdOrToken string) *model.AppError
	RemoveAllSessions() *model.AppError
	PermanentDeleteSessionsByUser(teamId string) *model.AppError
	UpdateExpiresAt(sessionId string, time int64) *model.AppError
	UpdateLastActivityAt(sessionId string, time int64) *model.AppError
	UpdateRoles(userId string, roles string) (string, *model.AppError)
	UpdateDeviceId(id string, deviceId string, expiresAt int64) (string, *model.AppError)
	UpdateProps(session *model.Session) *model.AppError
	AnalyticsSessionCount() (int64, *model.AppError)
	Cleanup(expiryTime int64, batchSize int64)
}

type AuditStore interface {
	Save(audit *model.Audit) error
	Get(user_id string, offset int, limit int) (model.Audits, error)
	PermanentDeleteByUser(userId string) error
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
	SaveApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError)
	UpdateApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError)
	GetApp(id string) (*model.OAuthApp, *model.AppError)
	GetAppByUser(userId string, offset, limit int) ([]*model.OAuthApp, *model.AppError)
	GetApps(offset, limit int) ([]*model.OAuthApp, *model.AppError)
	GetAuthorizedApps(userId string, offset, limit int) ([]*model.OAuthApp, *model.AppError)
	DeleteApp(id string) *model.AppError
	SaveAuthData(authData *model.AuthData) (*model.AuthData, *model.AppError)
	GetAuthData(code string) (*model.AuthData, *model.AppError)
	RemoveAuthData(code string) *model.AppError
	PermanentDeleteAuthDataByUser(userId string) *model.AppError
	SaveAccessData(accessData *model.AccessData) (*model.AccessData, *model.AppError)
	UpdateAccessData(accessData *model.AccessData) (*model.AccessData, *model.AppError)
	GetAccessData(token string) (*model.AccessData, *model.AppError)
	GetAccessDataByUserForApp(userId, clientId string) ([]*model.AccessData, *model.AppError)
	GetAccessDataByRefreshToken(token string) (*model.AccessData, *model.AppError)
	GetPreviousAccessData(userId, clientId string) (*model.AccessData, *model.AppError)
	RemoveAccessData(token string) *model.AppError
	RemoveAllAccessData() *model.AppError
}

type SystemStore interface {
	Save(system *model.System) *model.AppError
	SaveOrUpdate(system *model.System) *model.AppError
	Update(system *model.System) *model.AppError
	Get() (model.StringMap, *model.AppError)
	GetByName(name string) (*model.System, *model.AppError)
	PermanentDeleteByName(name string) (*model.System, *model.AppError)
	InsertIfExists(system *model.System) (*model.System, *model.AppError)
}

type WebhookStore interface {
	SaveIncoming(webhook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError)
	GetIncoming(id string, allowFromCache bool) (*model.IncomingWebhook, *model.AppError)
	GetIncomingList(offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	GetIncomingListByUser(userId string, offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	GetIncomingByTeam(teamId string, offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	GetIncomingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.IncomingWebhook, *model.AppError)
	UpdateIncoming(webhook *model.IncomingWebhook) (*model.IncomingWebhook, *model.AppError)
	GetIncomingByChannel(channelId string) ([]*model.IncomingWebhook, *model.AppError)
	DeleteIncoming(webhookId string, time int64) *model.AppError
	PermanentDeleteIncomingByChannel(channelId string) *model.AppError
	PermanentDeleteIncomingByUser(userId string) *model.AppError

	SaveOutgoing(webhook *model.OutgoingWebhook) (*model.OutgoingWebhook, *model.AppError)
	GetOutgoing(id string) (*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByChannel(channelId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByChannelByUser(channelId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingList(offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingListByUser(userId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByTeam(teamId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
	GetOutgoingByTeamByUser(teamId string, userId string, offset, limit int) ([]*model.OutgoingWebhook, *model.AppError)
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
	Save(webhook *model.CommandWebhook) (*model.CommandWebhook, *model.AppError)
	Get(id string) (*model.CommandWebhook, *model.AppError)
	TryUse(id string, limit int) *model.AppError
	Cleanup()
}

type PreferenceStore interface {
	Save(preferences *model.Preferences) *model.AppError
	GetCategory(userId string, category string) (model.Preferences, *model.AppError)
	Get(userId string, category string, name string) (*model.Preference, *model.AppError)
	GetAll(userId string) (model.Preferences, *model.AppError)
	Delete(userId, category, name string) *model.AppError
	DeleteCategory(userId string, category string) *model.AppError
	DeleteCategoryAndName(category string, name string) *model.AppError
	PermanentDeleteByUser(userId string) *model.AppError
	CleanupFlagsBatch(limit int64) (int64, *model.AppError)
}

type LicenseStore interface {
	Save(license *model.LicenseRecord) (*model.LicenseRecord, error)
	Get(id string) (*model.LicenseRecord, error)
}

type TokenStore interface {
	Save(recovery *model.Token) *model.AppError
	Delete(token string) *model.AppError
	GetByToken(token string) (*model.Token, *model.AppError)
	Cleanup()
	RemoveAllTokensByType(tokenType string) *model.AppError
}

type EmojiStore interface {
	Save(emoji *model.Emoji) (*model.Emoji, error)
	Get(id string, allowFromCache bool) (*model.Emoji, error)
	GetByName(name string, allowFromCache bool) (*model.Emoji, error)
	GetMultipleByName(names []string) ([]*model.Emoji, error)
	GetList(offset, limit int, sort string) ([]*model.Emoji, error)
	Delete(emoji *model.Emoji, time int64) error
	Search(name string, prefixOnly bool, limit int) ([]*model.Emoji, error)
}

type StatusStore interface {
	SaveOrUpdate(status *model.Status) *model.AppError
	Get(userId string) (*model.Status, *model.AppError)
	GetByIds(userIds []string) ([]*model.Status, *model.AppError)
	ResetAll() *model.AppError
	GetTotalActiveUsersCount() (int64, *model.AppError)
	UpdateLastActivityAt(userId string, lastActivityAt int64) *model.AppError
}

type FileInfoStore interface {
	Save(info *model.FileInfo) (*model.FileInfo, *model.AppError)
	Get(id string) (*model.FileInfo, *model.AppError)
	GetByPath(path string) (*model.FileInfo, *model.AppError)
	GetForPost(postId string, readFromMaster, includeDeleted, allowFromCache bool) ([]*model.FileInfo, *model.AppError)
	GetForUser(userId string) ([]*model.FileInfo, *model.AppError)
	GetWithOptions(page, perPage int, opt *model.GetFileInfosOptions) ([]*model.FileInfo, *model.AppError)
	InvalidateFileInfosForPostCache(postId string, deleted bool)
	AttachToPost(fileId string, postId string, creatorId string) *model.AppError
	DeleteForPost(postId string) (string, *model.AppError)
	PermanentDelete(fileId string) *model.AppError
	PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError)
	PermanentDeleteByUser(userId string) (int64, *model.AppError)
	ClearCaches()
}

type ReactionStore interface {
	Save(reaction *model.Reaction) (*model.Reaction, error)
	Delete(reaction *model.Reaction) (*model.Reaction, error)
	GetForPost(postId string, allowFromCache bool) ([]*model.Reaction, error)
	DeleteAllWithEmojiName(emojiName string) error
	PermanentDeleteBatch(endTime int64, limit int64) (int64, error)
	BulkGetForPosts(postIds []string) ([]*model.Reaction, error)
}

type JobStore interface {
	Save(job *model.Job) (*model.Job, *model.AppError)
	UpdateOptimistically(job *model.Job, currentStatus string) (bool, *model.AppError)
	UpdateStatus(id string, status string) (*model.Job, *model.AppError)
	UpdateStatusOptimistically(id string, currentStatus string, newStatus string) (bool, *model.AppError)
	Get(id string) (*model.Job, *model.AppError)
	GetAllPage(offset int, limit int) ([]*model.Job, *model.AppError)
	GetAllByType(jobType string) ([]*model.Job, *model.AppError)
	GetAllByTypePage(jobType string, offset int, limit int) ([]*model.Job, *model.AppError)
	GetAllByStatus(status string) ([]*model.Job, *model.AppError)
	GetNewestJobByStatusAndType(status string, jobType string) (*model.Job, *model.AppError)
	GetCountByStatusAndType(status string, jobType string) (int64, *model.AppError)
	Delete(id string) (string, *model.AppError)
}

type UserAccessTokenStore interface {
	Save(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError)
	DeleteAllForUser(userId string) *model.AppError
	Delete(tokenId string) *model.AppError
	Get(tokenId string) (*model.UserAccessToken, *model.AppError)
	GetAll(offset int, limit int) ([]*model.UserAccessToken, *model.AppError)
	GetByToken(tokenString string) (*model.UserAccessToken, *model.AppError)
	GetByUser(userId string, page, perPage int) ([]*model.UserAccessToken, *model.AppError)
	Search(term string) ([]*model.UserAccessToken, *model.AppError)
	UpdateTokenEnable(tokenId string) *model.AppError
	UpdateTokenDisable(tokenId string) *model.AppError
}

type PluginStore interface {
	SaveOrUpdate(keyVal *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError)
	CompareAndSet(keyVal *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError)
	CompareAndDelete(keyVal *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError)
	SetWithOptions(pluginId string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError)
	Get(pluginId, key string) (*model.PluginKeyValue, *model.AppError)
	Delete(pluginId, key string) *model.AppError
	DeleteAllForPlugin(PluginId string) *model.AppError
	DeleteAllExpired() *model.AppError
	List(pluginId string, page, perPage int) ([]string, *model.AppError)
}

type RoleStore interface {
	Save(role *model.Role) (*model.Role, *model.AppError)
	Get(roleId string) (*model.Role, *model.AppError)
	GetAll() ([]*model.Role, *model.AppError)
	GetByName(name string) (*model.Role, *model.AppError)
	GetByNames(names []string) ([]*model.Role, *model.AppError)
	Delete(roleId string) (*model.Role, *model.AppError)
	PermanentDeleteAll() *model.AppError

	// HigherScopedPermissions retrieves the higher-scoped permissions of a list of role names. The higher-scope
	// (either team scheme or system scheme) is determined based on whether the team has a scheme or not.
	ChannelHigherScopedPermissions(roleNames []string) (map[string]*model.RolePermissions, *model.AppError)

	// AllChannelSchemeRoles returns all of the roles associated to channel schemes.
	AllChannelSchemeRoles() ([]*model.Role, *model.AppError)

	// ChannelRolesUnderTeamRole returns all of the non-deleted roles that are affected by updates to the
	// given role.
	ChannelRolesUnderTeamRole(roleName string) ([]*model.Role, *model.AppError)
}

type SchemeStore interface {
	Save(scheme *model.Scheme) (*model.Scheme, error)
	Get(schemeId string) (*model.Scheme, error)
	GetByName(schemeName string) (*model.Scheme, error)
	GetAllPage(scope string, offset int, limit int) ([]*model.Scheme, error)
	Delete(schemeId string) (*model.Scheme, error)
	PermanentDeleteAll() error
	CountByScope(scope string) (int64, error)
	CountWithoutPermission(scope, permissionID string, roleScope model.RoleScope, roleType model.RoleType) (int64, error)
}

type TermsOfServiceStore interface {
	Save(termsOfService *model.TermsOfService) (*model.TermsOfService, error)
	GetLatest(allowFromCache bool) (*model.TermsOfService, error)
	Get(id string, allowFromCache bool) (*model.TermsOfService, error)
}

type UserTermsOfServiceStore interface {
	GetByUser(userId string) (*model.UserTermsOfService, error)
	Save(userTermsOfService *model.UserTermsOfService) (*model.UserTermsOfService, error)
	Delete(userId, termsOfServiceId string) error
}

type GroupStore interface {
	Create(group *model.Group) (*model.Group, *model.AppError)
	Get(groupID string) (*model.Group, *model.AppError)
	GetByName(name string, opts model.GroupSearchOpts) (*model.Group, *model.AppError)
	GetByIDs(groupIDs []string) ([]*model.Group, *model.AppError)
	GetByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError)
	GetAllBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError)
	GetByUser(userId string) ([]*model.Group, *model.AppError)
	Update(group *model.Group) (*model.Group, *model.AppError)
	Delete(groupID string) (*model.Group, *model.AppError)

	GetMemberUsers(groupID string) ([]*model.User, *model.AppError)
	GetMemberUsersPage(groupID string, page int, perPage int) ([]*model.User, *model.AppError)
	GetMemberCount(groupID string) (int64, *model.AppError)

	GetMemberUsersInTeam(groupID string, teamID string) ([]*model.User, *model.AppError)
	GetMemberUsersNotInChannel(groupID string, channelID string) ([]*model.User, *model.AppError)

	UpsertMember(groupID string, userID string) (*model.GroupMember, *model.AppError)
	DeleteMember(groupID string, userID string) (*model.GroupMember, *model.AppError)
	PermanentDeleteMembersByUser(userId string) *model.AppError

	CreateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError)
	GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError)
	GetAllGroupSyncablesByGroupId(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, *model.AppError)
	UpdateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError)
	DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError)

	// TeamMembersToAdd returns a slice of UserTeamIDPair that need newly created memberships
	// based on the groups configurations. The returned list can be optionally scoped to a single given team.
	//
	// Typically since will be the last successful group sync time.
	TeamMembersToAdd(since int64, teamID *string) ([]*model.UserTeamIDPair, *model.AppError)

	// ChannelMembersToAdd returns a slice of UserChannelIDPair that need newly created memberships
	// based on the groups configurations. The returned list can be optionally scoped to a single given channel.
	//
	// Typically since will be the last successful group sync time.
	ChannelMembersToAdd(since int64, channelID *string) ([]*model.UserChannelIDPair, *model.AppError)

	// TeamMembersToRemove returns all team members that should be removed based on group constraints.
	TeamMembersToRemove(teamID *string) ([]*model.TeamMember, *model.AppError)

	// ChannelMembersToRemove returns all channel members that should be removed based on group constraints.
	ChannelMembersToRemove(channelID *string) ([]*model.ChannelMember, *model.AppError)

	GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, *model.AppError)
	CountGroupsByChannel(channelId string, opts model.GroupSearchOpts) (int64, *model.AppError)

	GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, *model.AppError)
	GetGroupsAssociatedToChannelsByTeam(teamId string, opts model.GroupSearchOpts) (map[string][]*model.GroupWithSchemeAdmin, *model.AppError)
	CountGroupsByTeam(teamId string, opts model.GroupSearchOpts) (int64, *model.AppError)

	GetGroups(page, perPage int, opts model.GroupSearchOpts) ([]*model.Group, *model.AppError)

	TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, *model.AppError)
	CountTeamMembersMinusGroupMembers(teamID string, groupIDs []string) (int64, *model.AppError)
	ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, *model.AppError)
	CountChannelMembersMinusGroupMembers(channelID string, groupIDs []string) (int64, *model.AppError)

	// AdminRoleGroupsForSyncableMember returns the IDs of all of the groups that the user is a member of that are
	// configured as SchemeAdmin: true for the given syncable.
	AdminRoleGroupsForSyncableMember(userID, syncableID string, syncableType model.GroupSyncableType) ([]string, *model.AppError)

	// PermittedSyncableAdmins returns the IDs of all of the user who are permitted by the group syncable to have
	// the admin role for the given syncable.
	PermittedSyncableAdmins(syncableID string, syncableType model.GroupSyncableType) ([]string, *model.AppError)

	// GroupCount returns the total count of records in the UserGroups table.
	GroupCount() (int64, *model.AppError)

	// GroupTeamCount returns the total count of records in the GroupTeams table.
	GroupTeamCount() (int64, *model.AppError)

	// GroupChannelCount returns the total count of records in the GroupChannels table.
	GroupChannelCount() (int64, *model.AppError)

	// GroupMemberCount returns the total count of records in the GroupMembers table.
	GroupMemberCount() (int64, *model.AppError)

	// DistinctGroupMemberCount returns the count of records in the GroupMembers table with distinct UserId values.
	DistinctGroupMemberCount() (int64, *model.AppError)

	// GroupCountWithAllowReference returns the count of records in the Groups table with AllowReference set to true.
	GroupCountWithAllowReference() (int64, *model.AppError)
}

type LinkMetadataStore interface {
	Save(linkMetadata *model.LinkMetadata) (*model.LinkMetadata, error)
	Get(url string, timestamp int64) (*model.LinkMetadata, error)
}

// ChannelSearchOpts contains options for searching channels.
//
// NotAssociatedToGroup will exclude channels that have associated, active GroupChannels records.
// IncludeDeleted will include channel records where DeleteAt != 0.
// ExcludeChannelNames will exclude channels from the results by name.
// Paginate whether to paginate the results.
// Page page requested, if results are paginated.
// PerPage number of results per page, if paginated.
//
type ChannelSearchOpts struct {
	NotAssociatedToGroup string
	IncludeDeleted       bool
	ExcludeChannelNames  []string
	Page                 *int
	PerPage              *int
}

func (c *ChannelSearchOpts) IsPaginated() bool {
	return c.Page != nil && c.PerPage != nil
}

type UserGetByIdsOpts struct {
	// IsAdmin tracks whether or not the request is being made by an administrator. Does nothing when provided by a client.
	IsAdmin bool

	// Restrict to search in a list of teams and channels. Does nothing when provided by a client.
	ViewRestrictions *model.ViewUsersRestrictions

	// Since filters the users based on their UpdateAt timestamp.
	Since int64
}

type OrphanedRecord struct {
	ParentId *string
	ChildId  *string
}

type RelationalIntegrityCheckData struct {
	ParentName   string
	ChildName    string
	ParentIdAttr string
	ChildIdAttr  string
	Records      []OrphanedRecord
}

type IntegrityCheckResult struct {
	Data interface{}
	Err  error
}

const mySQLDeadlockCode = uint16(1213)

// WithDeadlockRetry retries a given f if it throws a deadlock error.
// It breaks after a threshold and propagates the error upwards.
// TODO: This can be a separate retry layer in itself where transaction retries
// are automatically applied.
func WithDeadlockRetry(f func() error) error {
	var err error
	for i := 0; i < 3; i++ {
		err = f()
		if err == nil {
			// No error, return nil.
			return nil
		}
		// XXX: Possibly add check for postgres deadlocks later.
		// But deadlocks are very rarely seen in postgres.
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == mySQLDeadlockCode {
			mlog.Warn("A deadlock happened. Retrying.", mlog.Err(err))
			// This is a deadlock, retry.
			continue
		}
		// Some other error, return as-is.
		return err
	}
	return errors.Wrap(err, "giving up after 3 consecutive deadlocks")
}
