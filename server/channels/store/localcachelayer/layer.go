// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"runtime"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	ReactionCacheSize = 20000
	ReactionCacheSec  = 30 * 60

	RoleCacheSize = 20000
	RoleCacheSec  = 30 * 60

	SchemeCacheSize = 20000
	SchemeCacheSec  = 30 * 60

	FileInfoCacheSize = 25000
	FileInfoCacheSec  = 30 * 60

	ChannelGuestCountCacheSize = model.ChannelCacheSize
	ChannelGuestCountCacheSec  = 30 * 60

	WebhookCacheSize = 25000
	WebhookCacheSec  = 15 * 60

	EmojiCacheSize = 5000
	EmojiCacheSec  = 30 * 60

	ChannelPinnedPostsCountsCacheSize = model.ChannelCacheSize
	ChannelPinnedPostsCountsCacheSec  = 30 * 60

	ChannelMembersCountsCacheSize = model.ChannelCacheSize
	ChannelMembersCountsCacheSec  = 30 * 60

	LastPostsCacheSize  = 20000
	LastPostsCacheSec   = 30 * 60
	PostsUsageCacheSize = 1
	PostsUsageCacheSec  = 30 * 60

	TermsOfServiceCacheSize = 20000
	TermsOfServiceCacheSec  = 30 * 60
	LastPostTimeCacheSize   = 25000
	LastPostTimeCacheSec    = 15 * 60

	UserProfileByIDCacheSize = 20000
	UserProfileByIDSec       = 30 * 60

	ProfilesInChannelCacheSize = model.ChannelCacheSize
	ProfilesInChannelCacheSec  = 15 * 60

	TeamCacheSize = 20000
	TeamCacheSec  = 30 * 60

	ChannelCacheSec = 15 * 60 // 15 mins
)

var clearCacheMessageData = []byte("")

type LocalCacheStore struct {
	store.Store
	metrics einterfaces.MetricsInterface
	cluster einterfaces.ClusterInterface

	reaction      LocalCacheReactionStore
	reactionCache cache.Cache[[]*model.Reaction]

	fileInfo      LocalCacheFileInfoStore
	fileInfoCache cache.Cache[[]*model.FileInfo]

	role                 LocalCacheRoleStore
	roleCache            cache.Cache[*model.Role]
	rolePermissionsCache cache.Cache[map[string]*model.RolePermissions]

	scheme      LocalCacheSchemeStore
	schemeCache cache.Cache[*model.Scheme]

	emoji              *LocalCacheEmojiStore
	emojiCacheById     cache.Cache[*model.Emoji]
	emojiIdCacheByName cache.Cache[string]

	channel                      LocalCacheChannelStore
	channelMemberCountsCache     cache.Cache[int64]
	channelGuestCountCache       cache.Cache[int64]
	channelPinnedPostCountsCache cache.Cache[int64]
	channelByIdCache             cache.Cache[*model.Channel]

	webhook      LocalCacheWebhookStore
	webhookCache cache.Cache[*model.IncomingWebhook]

	post               LocalCachePostStore
	postLastPostsCache cache.Cache[*model.PostList]
	lastPostTimeCache  cache.Cache[int64]
	postsUsageCache    cache.Cache[int64]

	user                   *LocalCacheUserStore
	userProfileByIdsCache  cache.Cache[*model.User]
	profilesInChannelCache cache.Cache[map[string]*model.User]

	team                       LocalCacheTeamStore
	teamAllTeamIdsForUserCache cache.Cache[[]string]

	termsOfService      LocalCacheTermsOfServiceStore
	termsOfServiceCache cache.Cache[*model.TermsOfService]
}

func NewLocalCacheLayer(baseStore store.Store, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface) (localCacheStore LocalCacheStore, err error) {
	localCacheStore = LocalCacheStore{
		Store:   baseStore,
		cluster: cluster,
		metrics: metrics,
	}
	// Reactions
	if localCacheStore.reactionCache, err = cache.NewCache[[]*model.Reaction](&cache.CacheOptions{
		Size:                   ReactionCacheSize,
		Name:                   "Reaction",
		DefaultExpiry:          ReactionCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForReactions,
	}); err != nil {
		return localCacheStore, err
	}
	localCacheStore.reaction = LocalCacheReactionStore{ReactionStore: baseStore.Reaction(), rootStore: &localCacheStore}

	// Roles
	if localCacheStore.roleCache, err = cache.NewCache[*model.Role](&cache.CacheOptions{
		Size:                   RoleCacheSize,
		Name:                   "Role",
		DefaultExpiry:          RoleCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForRoles,
		Striped:                true,
		StripedBuckets:         maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	if localCacheStore.rolePermissionsCache, err = cache.NewCache[map[string]*model.RolePermissions](&cache.CacheOptions{
		Size:                   RoleCacheSize,
		Name:                   "RolePermission",
		DefaultExpiry:          RoleCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForRolePermissions,
	}); err != nil {
		return
	}
	localCacheStore.role = LocalCacheRoleStore{RoleStore: baseStore.Role(), rootStore: &localCacheStore}

	// Schemes
	if localCacheStore.schemeCache, err = cache.NewCache[*model.Scheme](&cache.CacheOptions{
		Size:                   SchemeCacheSize,
		Name:                   "Scheme",
		DefaultExpiry:          SchemeCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForSchemes,
	}); err != nil {
		return
	}
	localCacheStore.scheme = LocalCacheSchemeStore{SchemeStore: baseStore.Scheme(), rootStore: &localCacheStore}

	// FileInfo
	if localCacheStore.fileInfoCache, err = cache.NewCache[[]*model.FileInfo](&cache.CacheOptions{
		Size:                   FileInfoCacheSize,
		Name:                   "FileInfo",
		DefaultExpiry:          FileInfoCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForFileInfos,
	}); err != nil {
		return
	}
	localCacheStore.fileInfo = LocalCacheFileInfoStore{FileInfoStore: baseStore.FileInfo(), rootStore: &localCacheStore}

	// Webhooks
	if localCacheStore.webhookCache, err = cache.NewCache[*model.IncomingWebhook](&cache.CacheOptions{
		Size:                   WebhookCacheSize,
		Name:                   "Webhook",
		DefaultExpiry:          WebhookCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForWebhooks,
	}); err != nil {
		return
	}
	localCacheStore.webhook = LocalCacheWebhookStore{WebhookStore: baseStore.Webhook(), rootStore: &localCacheStore}

	// Emojis
	if localCacheStore.emojiCacheById, err = cache.NewCache[*model.Emoji](&cache.CacheOptions{
		Size:                   EmojiCacheSize,
		Name:                   "EmojiById",
		DefaultExpiry:          EmojiCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForEmojisById,
	}); err != nil {
		return
	}
	if localCacheStore.emojiIdCacheByName, err = cache.NewCache[string](&cache.CacheOptions{
		Size:                   EmojiCacheSize,
		Name:                   "EmojiByName",
		DefaultExpiry:          EmojiCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForEmojisIdByName,
	}); err != nil {
		return
	}
	localCacheStore.emoji = &LocalCacheEmojiStore{
		EmojiStore:               baseStore.Emoji(),
		rootStore:                &localCacheStore,
		emojiByIdInvalidations:   make(map[string]bool),
		emojiByNameInvalidations: make(map[string]bool),
	}

	// Channels
	if localCacheStore.channelPinnedPostCountsCache, err = cache.NewCache[int64](&cache.CacheOptions{
		Size:                   ChannelPinnedPostsCountsCacheSize,
		Name:                   "ChannelPinnedPostsCounts",
		DefaultExpiry:          ChannelPinnedPostsCountsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelPinnedpostsCounts,
	}); err != nil {
		return
	}
	if localCacheStore.channelMemberCountsCache, err = cache.NewCache[int64](&cache.CacheOptions{
		Size:                   ChannelMembersCountsCacheSize,
		Name:                   "ChannelMemberCounts",
		DefaultExpiry:          ChannelMembersCountsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelMemberCounts,
	}); err != nil {
		return
	}
	if localCacheStore.channelGuestCountCache, err = cache.NewCache[int64](&cache.CacheOptions{
		Size:                   ChannelGuestCountCacheSize,
		Name:                   "ChannelGuestsCount",
		DefaultExpiry:          ChannelGuestCountCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelGuestCount,
	}); err != nil {
		return
	}
	if localCacheStore.channelByIdCache, err = cache.NewCache[*model.Channel](&cache.CacheOptions{
		Size:                   model.ChannelCacheSize,
		Name:                   "channelById",
		DefaultExpiry:          ChannelCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannel,
	}); err != nil {
		return
	}
	localCacheStore.channel = LocalCacheChannelStore{ChannelStore: baseStore.Channel(), rootStore: &localCacheStore}

	// Posts
	if localCacheStore.postLastPostsCache, err = cache.NewCache[*model.PostList](&cache.CacheOptions{
		Size:                   LastPostsCacheSize,
		Name:                   "LastPost",
		DefaultExpiry:          LastPostsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForLastPosts,
	}); err != nil {
		return
	}
	if localCacheStore.lastPostTimeCache, err = cache.NewCache[int64](&cache.CacheOptions{
		Size:                   LastPostTimeCacheSize,
		Name:                   "LastPostTime",
		DefaultExpiry:          LastPostTimeCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForLastPostTime,
	}); err != nil {
		return
	}
	if localCacheStore.postsUsageCache, err = cache.NewCache[int64](&cache.CacheOptions{
		Size:                   PostsUsageCacheSize,
		Name:                   "PostsUsage",
		DefaultExpiry:          PostsUsageCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForPostsUsage,
	}); err != nil {
		return
	}
	localCacheStore.post = LocalCachePostStore{PostStore: baseStore.Post(), rootStore: &localCacheStore}

	// TOS
	if localCacheStore.termsOfServiceCache, err = cache.NewCache[*model.TermsOfService](&cache.CacheOptions{
		Size:                   TermsOfServiceCacheSize,
		Name:                   "TermsOfService",
		DefaultExpiry:          TermsOfServiceCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForTermsOfService,
	}); err != nil {
		return
	}
	localCacheStore.termsOfService = LocalCacheTermsOfServiceStore{TermsOfServiceStore: baseStore.TermsOfService(), rootStore: &localCacheStore}

	// Users
	if localCacheStore.userProfileByIdsCache, err = cache.NewCache[*model.User](&cache.CacheOptions{
		Size:                   UserProfileByIDCacheSize,
		Name:                   "UserProfileByIds",
		DefaultExpiry:          UserProfileByIDSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForProfileByIds,
		Striped:                true,
		StripedBuckets:         maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	if localCacheStore.profilesInChannelCache, err = cache.NewCache[map[string]*model.User](&cache.CacheOptions{
		Size:                   ProfilesInChannelCacheSize,
		Name:                   "ProfilesInChannel",
		DefaultExpiry:          ProfilesInChannelCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForProfileInChannel,
	}); err != nil {
		return
	}
	localCacheStore.user = &LocalCacheUserStore{
		UserStore:                     baseStore.User(),
		rootStore:                     &localCacheStore,
		userProfileByIdsInvalidations: make(map[string]bool),
	}

	// Teams
	if localCacheStore.teamAllTeamIdsForUserCache, err = cache.NewCache[[]string](&cache.CacheOptions{
		Size:                   TeamCacheSize,
		Name:                   "Team",
		DefaultExpiry:          TeamCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForTeams,
	}); err != nil {
		return
	}
	localCacheStore.team = LocalCacheTeamStore{TeamStore: baseStore.Team(), rootStore: &localCacheStore}

	if cluster != nil {
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForReactions, localCacheStore.reaction.handleClusterInvalidateReaction)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForRoles, localCacheStore.role.handleClusterInvalidateRole)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForRolePermissions, localCacheStore.role.handleClusterInvalidateRolePermissions)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForSchemes, localCacheStore.scheme.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForFileInfos, localCacheStore.fileInfo.handleClusterInvalidateFileInfo)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForLastPostTime, localCacheStore.post.handleClusterInvalidateLastPostTime)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForPostsUsage, localCacheStore.post.handleClusterInvalidatePostsUsage)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForWebhooks, localCacheStore.webhook.handleClusterInvalidateWebhook)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForEmojisById, localCacheStore.emoji.handleClusterInvalidateEmojiById)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForEmojisIdByName, localCacheStore.emoji.handleClusterInvalidateEmojiIdByName)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelPinnedpostsCounts, localCacheStore.channel.handleClusterInvalidateChannelPinnedPostCount)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelMemberCounts, localCacheStore.channel.handleClusterInvalidateChannelMemberCounts)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelGuestCount, localCacheStore.channel.handleClusterInvalidateChannelGuestCounts)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannel, localCacheStore.channel.handleClusterInvalidateChannelById)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForLastPosts, localCacheStore.post.handleClusterInvalidateLastPosts)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForTermsOfService, localCacheStore.termsOfService.handleClusterInvalidateTermsOfService)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForProfileByIds, localCacheStore.user.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForProfileInChannel, localCacheStore.user.handleClusterInvalidateProfilesInChannel)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForTeams, localCacheStore.team.handleClusterInvalidateTeam)
	}
	return
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (s LocalCacheStore) Reaction() store.ReactionStore {
	return s.reaction
}

func (s LocalCacheStore) Role() store.RoleStore {
	return s.role
}

func (s LocalCacheStore) Scheme() store.SchemeStore {
	return s.scheme
}

func (s LocalCacheStore) FileInfo() store.FileInfoStore {
	return s.fileInfo
}

func (s LocalCacheStore) Webhook() store.WebhookStore {
	return s.webhook
}

func (s LocalCacheStore) Emoji() store.EmojiStore {
	return s.emoji
}

func (s LocalCacheStore) Channel() store.ChannelStore {
	return s.channel
}

func (s LocalCacheStore) Post() store.PostStore {
	return s.post
}

func (s LocalCacheStore) TermsOfService() store.TermsOfServiceStore {
	return s.termsOfService
}

func (s LocalCacheStore) User() store.UserStore {
	return s.user
}

func (s LocalCacheStore) Team() store.TeamStore {
	return s.team
}

func (s LocalCacheStore) DropAllTables() {
	s.Invalidate()
	s.Store.DropAllTables()
}

func doInvalidateCacheCluster[T any](cluster einterfaces.ClusterInterface, cache cache.Cache[T], key string) {
	cache.Remove(key)
	if cluster != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(key),
		}
		cluster.SendClusterMessage(msg)
	}
}

func doStandardAddToCache[T any](cache cache.Cache[T], key string, value T) {
	cache.SetWithDefaultExpiry(key, value)
}

func doStandardReadCache[T any](metrics einterfaces.MetricsInterface, cache cache.Cache[T], key string, value *T) error {
	err := cache.Get(key, value)
	if err == nil {
		if metrics != nil {
			metrics.IncrementMemCacheHitCounter(cache.Name())
		}
		return nil
	}
	if metrics != nil {
		metrics.IncrementMemCacheMissCounter(cache.Name())
	}
	return err
}

func doClearCacheCluster[T any](cluster einterfaces.ClusterInterface, cache cache.Cache[T]) {
	cache.Purge()
	if cluster != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.ClusterSendBestEffort,
			Data:     clearCacheMessageData,
		}
		cluster.SendClusterMessage(msg)
	}
}

func (s *LocalCacheStore) Invalidate() {
	doClearCacheCluster(s.cluster, s.reactionCache)
	doClearCacheCluster(s.cluster, s.schemeCache)
	doClearCacheCluster(s.cluster, s.roleCache)
	doClearCacheCluster(s.cluster, s.fileInfoCache)
	doClearCacheCluster(s.cluster, s.webhookCache)
	doClearCacheCluster(s.cluster, s.emojiCacheById)
	doClearCacheCluster(s.cluster, s.emojiIdCacheByName)
	doClearCacheCluster(s.cluster, s.channelMemberCountsCache)
	doClearCacheCluster(s.cluster, s.channelPinnedPostCountsCache)
	doClearCacheCluster(s.cluster, s.channelGuestCountCache)
	doClearCacheCluster(s.cluster, s.channelByIdCache)
	doClearCacheCluster(s.cluster, s.postLastPostsCache)
	doClearCacheCluster(s.cluster, s.termsOfServiceCache)
	doClearCacheCluster(s.cluster, s.lastPostTimeCache)
	doClearCacheCluster(s.cluster, s.userProfileByIdsCache)
	doClearCacheCluster(s.cluster, s.profilesInChannelCache)
	doClearCacheCluster(s.cluster, s.teamAllTeamIdsForUserCache)
	doClearCacheCluster(s.cluster, s.rolePermissionsCache)
}
