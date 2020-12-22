// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"runtime"
	"time"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/cache"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	REACTION_CACHE_SIZE = 20000
	REACTION_CACHE_SEC  = 30 * 60

	ROLE_CACHE_SIZE = 20000
	ROLE_CACHE_SEC  = 30 * 60

	SCHEME_CACHE_SIZE = 20000
	SCHEME_CACHE_SEC  = 30 * 60

	FILE_INFO_CACHE_SIZE = 25000
	FILE_INFO_CACHE_SEC  = 30 * 60

	CHANNEL_GUEST_COUNT_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	CHANNEL_GUEST_COUNT_CACHE_SEC  = 30 * 60

	WEBHOOK_CACHE_SIZE = 25000
	WEBHOOK_CACHE_SEC  = 15 * 60

	EMOJI_CACHE_SIZE = 5000
	EMOJI_CACHE_SEC  = 30 * 60

	CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SEC  = 30 * 60

	CHANNEL_MEMBERS_COUNTS_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	CHANNEL_MEMBERS_COUNTS_CACHE_SEC  = 30 * 60

	LAST_POSTS_CACHE_SIZE = 20000
	LAST_POSTS_CACHE_SEC  = 30 * 60

	TERMS_OF_SERVICE_CACHE_SIZE = 20000
	TERMS_OF_SERVICE_CACHE_SEC  = 30 * 60
	LAST_POST_TIME_CACHE_SIZE   = 25000
	LAST_POST_TIME_CACHE_SEC    = 15 * 60

	USER_PROFILE_BY_ID_CACHE_SIZE = 20000
	USER_PROFILE_BY_ID_SEC        = 30 * 60

	PROFILES_IN_CHANNEL_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	PROFILES_IN_CHANNEL_CACHE_SEC  = 15 * 60

	TEAM_CACHE_SIZE = 20000
	TEAM_CACHE_SEC  = 30 * 60

	CLEAR_CACHE_MESSAGE_DATA = ""

	CHANNEL_CACHE_SEC = 15 * 60 // 15 mins
)

type LocalCacheStore struct {
	store.Store
	metrics einterfaces.MetricsInterface
	cluster einterfaces.ClusterInterface

	reaction      LocalCacheReactionStore
	reactionCache cache.Cache

	fileInfo      LocalCacheFileInfoStore
	fileInfoCache cache.Cache

	role                 LocalCacheRoleStore
	roleCache            cache.Cache
	rolePermissionsCache cache.Cache

	scheme      LocalCacheSchemeStore
	schemeCache cache.Cache

	emoji              LocalCacheEmojiStore
	emojiCacheById     cache.Cache
	emojiIdCacheByName cache.Cache

	channel                      LocalCacheChannelStore
	channelMemberCountsCache     cache.Cache
	channelGuestCountCache       cache.Cache
	channelPinnedPostCountsCache cache.Cache
	channelByIdCache             cache.Cache

	webhook      LocalCacheWebhookStore
	webhookCache cache.Cache

	post               LocalCachePostStore
	postLastPostsCache cache.Cache
	lastPostTimeCache  cache.Cache

	user                   LocalCacheUserStore
	userProfileByIdsCache  cache.Cache
	profilesInChannelCache cache.Cache

	team                       LocalCacheTeamStore
	teamAllTeamIdsForUserCache cache.Cache

	termsOfService      LocalCacheTermsOfServiceStore
	termsOfServiceCache cache.Cache
}

func NewLocalCacheLayer(baseStore store.Store, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface, cacheProvider cache.Provider) (localCacheStore LocalCacheStore, err error) {
	localCacheStore = LocalCacheStore{
		Store:   baseStore,
		cluster: cluster,
		metrics: metrics,
	}
	// Reactions
	if localCacheStore.reactionCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   REACTION_CACHE_SIZE,
		Name:                   "Reaction",
		DefaultExpiry:          REACTION_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS,
	}); err != nil {
		return
	}
	localCacheStore.reaction = LocalCacheReactionStore{ReactionStore: baseStore.Reaction(), rootStore: &localCacheStore}

	// Roles
	if localCacheStore.roleCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ROLE_CACHE_SIZE,
		Name:                   "Role",
		DefaultExpiry:          ROLE_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES,
		Striped:                true,
		StripedBuckets:         maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	if localCacheStore.rolePermissionsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ROLE_CACHE_SIZE,
		Name:                   "RolePermission",
		DefaultExpiry:          ROLE_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLE_PERMISSIONS,
	}); err != nil {
		return
	}
	localCacheStore.role = LocalCacheRoleStore{RoleStore: baseStore.Role(), rootStore: &localCacheStore}

	// Schemes
	if localCacheStore.schemeCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   SCHEME_CACHE_SIZE,
		Name:                   "Scheme",
		DefaultExpiry:          SCHEME_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES,
	}); err != nil {
		return
	}
	localCacheStore.scheme = LocalCacheSchemeStore{SchemeStore: baseStore.Scheme(), rootStore: &localCacheStore}

	// FileInfo
	if localCacheStore.fileInfoCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   FILE_INFO_CACHE_SIZE,
		Name:                   "FileInfo",
		DefaultExpiry:          FILE_INFO_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_FILE_INFOS,
	}); err != nil {
		return
	}
	localCacheStore.fileInfo = LocalCacheFileInfoStore{FileInfoStore: baseStore.FileInfo(), rootStore: &localCacheStore}

	// Webhooks
	if localCacheStore.webhookCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   WEBHOOK_CACHE_SIZE,
		Name:                   "Webhook",
		DefaultExpiry:          WEBHOOK_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS,
	}); err != nil {
		return
	}
	localCacheStore.webhook = LocalCacheWebhookStore{WebhookStore: baseStore.Webhook(), rootStore: &localCacheStore}

	// Emojis
	if localCacheStore.emojiCacheById, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   EMOJI_CACHE_SIZE,
		Name:                   "EmojiById",
		DefaultExpiry:          EMOJI_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID,
	}); err != nil {
		return
	}
	if localCacheStore.emojiIdCacheByName, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   EMOJI_CACHE_SIZE,
		Name:                   "EmojiByName",
		DefaultExpiry:          EMOJI_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME,
	}); err != nil {
		return
	}
	localCacheStore.emoji = LocalCacheEmojiStore{EmojiStore: baseStore.Emoji(), rootStore: &localCacheStore}

	// Channels
	if localCacheStore.channelPinnedPostCountsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SIZE,
		Name:                   "ChannelPinnedPostsCounts",
		DefaultExpiry:          CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_PINNEDPOSTS_COUNTS,
	}); err != nil {
		return
	}
	if localCacheStore.channelMemberCountsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   CHANNEL_MEMBERS_COUNTS_CACHE_SIZE,
		Name:                   "ChannelMemberCounts",
		DefaultExpiry:          CHANNEL_MEMBERS_COUNTS_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS,
	}); err != nil {
		return
	}
	if localCacheStore.channelGuestCountCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   CHANNEL_GUEST_COUNT_CACHE_SIZE,
		Name:                   "ChannelGuestsCount",
		DefaultExpiry:          CHANNEL_GUEST_COUNT_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_GUEST_COUNT,
	}); err != nil {
		return
	}
	if localCacheStore.channelByIdCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   model.CHANNEL_CACHE_SIZE,
		Name:                   "channelById",
		DefaultExpiry:          CHANNEL_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL,
	}); err != nil {
		return
	}
	localCacheStore.channel = LocalCacheChannelStore{ChannelStore: baseStore.Channel(), rootStore: &localCacheStore}

	// Posts
	if localCacheStore.postLastPostsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   LAST_POSTS_CACHE_SIZE,
		Name:                   "LastPost",
		DefaultExpiry:          LAST_POSTS_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS,
	}); err != nil {
		return
	}
	if localCacheStore.lastPostTimeCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   LAST_POST_TIME_CACHE_SIZE,
		Name:                   "LastPostTime",
		DefaultExpiry:          LAST_POST_TIME_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POST_TIME,
	}); err != nil {
		return
	}
	localCacheStore.post = LocalCachePostStore{PostStore: baseStore.Post(), rootStore: &localCacheStore}

	// TOS
	if localCacheStore.termsOfServiceCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   TERMS_OF_SERVICE_CACHE_SIZE,
		Name:                   "TermsOfService",
		DefaultExpiry:          TERMS_OF_SERVICE_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TERMS_OF_SERVICE,
	}); err != nil {
		return
	}
	localCacheStore.termsOfService = LocalCacheTermsOfServiceStore{TermsOfServiceStore: baseStore.TermsOfService(), rootStore: &localCacheStore}

	// Users
	if localCacheStore.userProfileByIdsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   USER_PROFILE_BY_ID_CACHE_SIZE,
		Name:                   "UserProfileByIds",
		DefaultExpiry:          USER_PROFILE_BY_ID_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS,
		Striped:                true,
		StripedBuckets:         maxInt(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	if localCacheStore.profilesInChannelCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   PROFILES_IN_CHANNEL_CACHE_SIZE,
		Name:                   "ProfilesInChannel",
		DefaultExpiry:          PROFILES_IN_CHANNEL_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_IN_CHANNEL,
	}); err != nil {
		return
	}
	localCacheStore.user = LocalCacheUserStore{UserStore: baseStore.User(), rootStore: &localCacheStore}

	// Teams
	if localCacheStore.teamAllTeamIdsForUserCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   TEAM_CACHE_SIZE,
		Name:                   "Team",
		DefaultExpiry:          TEAM_CACHE_SEC * time.Second,
		InvalidateClusterEvent: model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TEAMS,
	}); err != nil {
		return
	}
	localCacheStore.team = LocalCacheTeamStore{TeamStore: baseStore.Team(), rootStore: &localCacheStore}

	if cluster != nil {
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS, localCacheStore.reaction.handleClusterInvalidateReaction)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES, localCacheStore.role.handleClusterInvalidateRole)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLE_PERMISSIONS, localCacheStore.role.handleClusterInvalidateRolePermissions)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES, localCacheStore.scheme.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_FILE_INFOS, localCacheStore.fileInfo.handleClusterInvalidateFileInfo)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POST_TIME, localCacheStore.post.handleClusterInvalidateLastPostTime)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS, localCacheStore.webhook.handleClusterInvalidateWebhook)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID, localCacheStore.emoji.handleClusterInvalidateEmojiById)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME, localCacheStore.emoji.handleClusterInvalidateEmojiIdByName)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_PINNEDPOSTS_COUNTS, localCacheStore.channel.handleClusterInvalidateChannelPinnedPostCount)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS, localCacheStore.channel.handleClusterInvalidateChannelMemberCounts)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_GUEST_COUNT, localCacheStore.channel.handleClusterInvalidateChannelGuestCounts)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL, localCacheStore.channel.handleClusterInvalidateChannelById)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS, localCacheStore.post.handleClusterInvalidateLastPosts)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TERMS_OF_SERVICE, localCacheStore.termsOfService.handleClusterInvalidateTermsOfService)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS, localCacheStore.user.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_IN_CHANNEL, localCacheStore.user.handleClusterInvalidateProfilesInChannel)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TEAMS, localCacheStore.team.handleClusterInvalidateTeam)
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

func (s *LocalCacheStore) doInvalidateCacheCluster(cache cache.Cache, key string) {
	cache.Remove(key)
	if s.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     key,
		}
		s.cluster.SendClusterMessage(msg)
	}
}

func (s *LocalCacheStore) doStandardAddToCache(cache cache.Cache, key string, value interface{}) {
	cache.SetWithDefaultExpiry(key, value)
}

func (s *LocalCacheStore) doStandardReadCache(cache cache.Cache, key string, value interface{}) error {
	err := cache.Get(key, value)
	if err == nil {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter(cache.Name())
		}
		return nil
	}
	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter(cache.Name())
	}
	return err
}

func (s *LocalCacheStore) doClearCacheCluster(cache cache.Cache) {
	cache.Purge()
	if s.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     CLEAR_CACHE_MESSAGE_DATA,
		}
		s.cluster.SendClusterMessage(msg)
	}
}

func (s *LocalCacheStore) Invalidate() {
	s.doClearCacheCluster(s.reactionCache)
	s.doClearCacheCluster(s.schemeCache)
	s.doClearCacheCluster(s.roleCache)
	s.doClearCacheCluster(s.fileInfoCache)
	s.doClearCacheCluster(s.webhookCache)
	s.doClearCacheCluster(s.emojiCacheById)
	s.doClearCacheCluster(s.emojiIdCacheByName)
	s.doClearCacheCluster(s.channelMemberCountsCache)
	s.doClearCacheCluster(s.channelPinnedPostCountsCache)
	s.doClearCacheCluster(s.channelGuestCountCache)
	s.doClearCacheCluster(s.channelByIdCache)
	s.doClearCacheCluster(s.postLastPostsCache)
	s.doClearCacheCluster(s.termsOfServiceCache)
	s.doClearCacheCluster(s.lastPostTimeCache)
	s.doClearCacheCluster(s.userProfileByIdsCache)
	s.doClearCacheCluster(s.profilesInChannelCache)
	s.doClearCacheCluster(s.teamAllTeamIdsForUserCache)
	s.doClearCacheCluster(s.rolePermissionsCache)
}
