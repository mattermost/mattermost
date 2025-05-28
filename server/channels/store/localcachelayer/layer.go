// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"runtime"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

	ChannelPinnedPostsCountsCacheSize     = model.ChannelCacheSize
	ChannelPinnedPostsCountsCacheSec      = 30 * 60
	AllChannelMembersForUserCacheSize     = model.SessionCacheSize
	AllChannelMembersForUserCacheDuration = 15 * time.Minute

	AllChannelMembersNotifyPropsForChannelCacheSize     = model.SessionCacheSize
	AllChannelMembersNotifyPropsForChannelCacheDuration = 30 * time.Minute

	ChannelCacheDuration = 15 * time.Minute

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
	cacheType string
	metrics   einterfaces.MetricsInterface
	cluster   einterfaces.ClusterInterface
	logger    mlog.LoggerIFace

	reaction      LocalCacheReactionStore
	reactionCache cache.Cache

	fileInfo      LocalCacheFileInfoStore
	fileInfoCache cache.Cache

	role                 LocalCacheRoleStore
	roleCache            cache.Cache
	rolePermissionsCache cache.Cache

	scheme      LocalCacheSchemeStore
	schemeCache cache.Cache

	emoji              *LocalCacheEmojiStore
	emojiCacheById     cache.Cache
	emojiIdCacheByName cache.Cache

	channel                        LocalCacheChannelStore
	channelMemberCountsCache       cache.Cache
	channelGuestCountCache         cache.Cache
	channelPinnedPostCountsCache   cache.Cache
	channelByIdCache               cache.Cache
	channelMembersForUserCache     cache.Cache
	channelMembersNotifyPropsCache cache.Cache
	channelByNameCache             cache.Cache

	webhook      LocalCacheWebhookStore
	webhookCache cache.Cache

	post               LocalCachePostStore
	postLastPostsCache cache.Cache
	lastPostTimeCache  cache.Cache
	postsUsageCache    cache.Cache

	user                   *LocalCacheUserStore
	allUserCache           cache.Cache
	userProfileByIdsCache  cache.Cache
	profilesInChannelCache cache.Cache

	team                       LocalCacheTeamStore
	teamAllTeamIdsForUserCache cache.Cache

	termsOfService      LocalCacheTermsOfServiceStore
	termsOfServiceCache cache.Cache
}

func NewLocalCacheLayer(baseStore store.Store, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface, cacheProvider cache.Provider, logger mlog.LoggerIFace) (localCacheStore LocalCacheStore, err error) {
	localCacheStore = LocalCacheStore{
		Store:     baseStore,
		cluster:   cluster,
		metrics:   metrics,
		cacheType: cacheProvider.Type(),
		logger:    logger,
	}
	// Reactions
	if localCacheStore.reactionCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ReactionCacheSize,
		Name:                   "Reaction",
		DefaultExpiry:          ReactionCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForReactions,
	}); err != nil {
		return
	}
	localCacheStore.reaction = LocalCacheReactionStore{ReactionStore: baseStore.Reaction(), rootStore: &localCacheStore}

	// Roles
	if localCacheStore.roleCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   RoleCacheSize,
		Name:                   "Role",
		DefaultExpiry:          RoleCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForRoles,
		Striped:                true,
		StripedBuckets:         max(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	if localCacheStore.rolePermissionsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   RoleCacheSize,
		Name:                   "RolePermission",
		DefaultExpiry:          RoleCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForRolePermissions,
	}); err != nil {
		return
	}
	localCacheStore.role = LocalCacheRoleStore{RoleStore: baseStore.Role(), rootStore: &localCacheStore}

	// Schemes
	if localCacheStore.schemeCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   SchemeCacheSize,
		Name:                   "Scheme",
		DefaultExpiry:          SchemeCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForSchemes,
	}); err != nil {
		return
	}
	localCacheStore.scheme = LocalCacheSchemeStore{SchemeStore: baseStore.Scheme(), rootStore: &localCacheStore}

	// FileInfo
	if localCacheStore.fileInfoCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   FileInfoCacheSize,
		Name:                   "FileInfo",
		DefaultExpiry:          FileInfoCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForFileInfos,
	}); err != nil {
		return
	}
	localCacheStore.fileInfo = LocalCacheFileInfoStore{FileInfoStore: baseStore.FileInfo(), rootStore: &localCacheStore}

	// Webhooks
	if localCacheStore.webhookCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   WebhookCacheSize,
		Name:                   "Webhook",
		DefaultExpiry:          WebhookCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForWebhooks,
	}); err != nil {
		return
	}
	localCacheStore.webhook = LocalCacheWebhookStore{WebhookStore: baseStore.Webhook(), rootStore: &localCacheStore}

	// Emojis
	if localCacheStore.emojiCacheById, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   EmojiCacheSize,
		Name:                   "EmojiById",
		DefaultExpiry:          EmojiCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForEmojisById,
	}); err != nil {
		return
	}
	if localCacheStore.emojiIdCacheByName, err = cacheProvider.NewCache(&cache.CacheOptions{
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
	if localCacheStore.channelPinnedPostCountsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ChannelPinnedPostsCountsCacheSize,
		Name:                   "ChannelPinnedPostsCounts",
		DefaultExpiry:          ChannelPinnedPostsCountsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelPinnedpostsCounts,
	}); err != nil {
		return
	}
	if localCacheStore.channelMemberCountsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ChannelMembersCountsCacheSize,
		Name:                   "ChannelMemberCounts",
		DefaultExpiry:          ChannelMembersCountsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelMemberCounts,
	}); err != nil {
		return
	}
	if localCacheStore.channelGuestCountCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   ChannelGuestCountCacheSize,
		Name:                   "ChannelGuestsCount",
		DefaultExpiry:          ChannelGuestCountCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelGuestCount,
	}); err != nil {
		return
	}
	if localCacheStore.channelByIdCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   model.ChannelCacheSize,
		Name:                   "channelById",
		DefaultExpiry:          ChannelCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannel,
	}); err != nil {
		return
	}

	if localCacheStore.channelMembersForUserCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   AllChannelMembersForUserCacheSize,
		Name:                   "ChannelMembersForUser",
		DefaultExpiry:          AllChannelMembersForUserCacheDuration,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForUser,
	}); err != nil {
		return
	}
	if localCacheStore.channelMembersNotifyPropsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   AllChannelMembersNotifyPropsForChannelCacheSize,
		Name:                   "ChannnelMembersNotifyProps",
		DefaultExpiry:          AllChannelMembersNotifyPropsForChannelCacheDuration,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelMembersNotifyProps,
	}); err != nil {
		return
	}
	if localCacheStore.channelByNameCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   model.ChannelCacheSize,
		Name:                   "ChannelByName",
		DefaultExpiry:          ChannelCacheDuration,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForChannelByName,
	}); err != nil {
		return
	}
	localCacheStore.channel = LocalCacheChannelStore{ChannelStore: baseStore.Channel(), rootStore: &localCacheStore}

	// Posts
	if localCacheStore.postLastPostsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   LastPostsCacheSize,
		Name:                   "LastPost",
		DefaultExpiry:          LastPostsCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForLastPosts,
	}); err != nil {
		return
	}
	if localCacheStore.lastPostTimeCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   LastPostTimeCacheSize,
		Name:                   "LastPostTime",
		DefaultExpiry:          LastPostTimeCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForLastPostTime,
	}); err != nil {
		return
	}
	if localCacheStore.postsUsageCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   PostsUsageCacheSize,
		Name:                   "PostsUsage",
		DefaultExpiry:          PostsUsageCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForPostsUsage,
	}); err != nil {
		return
	}
	localCacheStore.post = LocalCachePostStore{PostStore: baseStore.Post(), rootStore: &localCacheStore}

	// TOS
	if localCacheStore.termsOfServiceCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   TermsOfServiceCacheSize,
		Name:                   "TermsOfService",
		DefaultExpiry:          TermsOfServiceCacheSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForTermsOfService,
	}); err != nil {
		return
	}
	localCacheStore.termsOfService = LocalCacheTermsOfServiceStore{TermsOfServiceStore: baseStore.TermsOfService(), rootStore: &localCacheStore}

	// Users
	if localCacheStore.allUserCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   1,
		Name:                   "AllUserProfiles",
		DefaultExpiry:          UserProfileByIDSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForAllProfiles,
	}); err != nil {
		return
	}
	if localCacheStore.userProfileByIdsCache, err = cacheProvider.NewCache(&cache.CacheOptions{
		Size:                   UserProfileByIDCacheSize,
		Name:                   "UserProfileByIds",
		DefaultExpiry:          UserProfileByIDSec * time.Second,
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForProfileByIds,
		Striped:                true,
		StripedBuckets:         max(runtime.NumCPU()-1, 1),
	}); err != nil {
		return
	}
	// Hardcoding this to LRU because of the volume of SCAN calls in case of Redis.
	if localCacheStore.profilesInChannelCache, err = cache.NewProvider().NewCache(&cache.CacheOptions{
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
	if localCacheStore.teamAllTeamIdsForUserCache, err = cacheProvider.NewCache(&cache.CacheOptions{
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
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForUser, localCacheStore.channel.handleClusterInvalidateChannelForUser)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelMembersNotifyProps, localCacheStore.channel.handleClusterInvalidateChannelMembersNotifyProps)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForChannelByName, localCacheStore.channel.handleClusterInvalidateChannelByName)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForLastPosts, localCacheStore.post.handleClusterInvalidateLastPosts)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForTermsOfService, localCacheStore.termsOfService.handleClusterInvalidateTermsOfService)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForProfileByIds, localCacheStore.user.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForProfileInChannel, localCacheStore.user.handleClusterInvalidateProfilesInChannel)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForAllProfiles, localCacheStore.user.handleClusterInvalidateAllProfiles)
		cluster.RegisterClusterMessageHandler(model.ClusterEventInvalidateCacheForTeams, localCacheStore.team.handleClusterInvalidateTeam)
	}
	return
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

func (s *LocalCacheStore) doInvalidateCacheCluster(cache cache.Cache, key string, props map[string]string) {
	err := cache.Remove(key)
	if err != nil {
		s.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
	if s.cluster != nil && cache.GetInvalidateClusterEvent() != model.ClusterEventNone {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(key),
		}
		if props != nil {
			msg.Props = props
		}
		s.cluster.SendClusterMessage(msg)
	}
}

func (s *LocalCacheStore) doMultiInvalidateCacheCluster(cache cache.Cache, keys []string, props map[string]string) {
	err := cache.RemoveMulti(keys)
	if err != nil {
		s.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
	if s.cluster != nil && cache.GetInvalidateClusterEvent() != model.ClusterEventNone {
		for _, key := range keys {
			msg := &model.ClusterMessage{
				Event:    cache.GetInvalidateClusterEvent(),
				SendType: model.ClusterSendBestEffort,
				Data:     []byte(key),
			}
			if props != nil {
				msg.Props = props
			}
			s.cluster.SendClusterMessage(msg)
		}
	}
}

func (s *LocalCacheStore) doStandardAddToCache(cache cache.Cache, key string, value any) {
	err := cache.SetWithDefaultExpiry(key, value)
	if err != nil {
		s.logger.Warn("Error while setting cache entry", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
}

func (s *LocalCacheStore) doStandardReadCache(c cache.Cache, key string, value any) error {
	err := c.Get(key, value)
	if err == nil {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter(c.Name())
		}
		return nil
	}
	if err != cache.ErrKeyNotFound {
		s.logger.Warn("Error while reading from cache", mlog.Err(err), mlog.String("cache_name", c.Name()))
	}
	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter(c.Name())
	}
	return err
}

func (s *LocalCacheStore) doMultiReadCache(cache cache.Cache, keys []string, values []any) []error {
	errs := cache.GetMulti(keys, values)
	if s.metrics != nil {
		for _, err := range errs {
			if err == nil {
				s.metrics.IncrementMemCacheHitCounter(cache.Name())
				continue
			}
			s.metrics.IncrementMemCacheMissCounter(cache.Name())
		}
	}
	return errs
}

func (s *LocalCacheStore) doIncrementCache(cache cache.ExternalCache, key string, val int) {
	err := cache.Increment(key, val)
	if err != nil {
		s.logger.Warn("Error while incrementing cache entry", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
}

func (s *LocalCacheStore) doDecrementCache(cache cache.ExternalCache, key string, val int) {
	err := cache.Decrement(key, val)
	if err != nil {
		s.logger.Warn("Error while decrementing cache entry", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
}

func (s *LocalCacheStore) doClearCacheCluster(cache cache.Cache) {
	err := cache.Purge()
	if err != nil {
		s.logger.Warn("Error while purging cache", mlog.Err(err), mlog.String("cache_name", cache.Name()))
	}
	if s.cluster != nil && cache.GetInvalidateClusterEvent() != model.ClusterEventNone {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.ClusterSendBestEffort,
			Data:     clearCacheMessageData,
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
	s.doClearCacheCluster(s.channelMembersForUserCache)
	s.doClearCacheCluster(s.channelMembersNotifyPropsCache)
	s.doClearCacheCluster(s.channelByNameCache)
	s.doClearCacheCluster(s.postLastPostsCache)
	s.doClearCacheCluster(s.termsOfServiceCache)
	s.doClearCacheCluster(s.lastPostTimeCache)
	s.doClearCacheCluster(s.userProfileByIdsCache)
	s.doClearCacheCluster(s.allUserCache)
	s.doClearCacheCluster(s.profilesInChannelCache)
	s.doClearCacheCluster(s.teamAllTeamIdsForUserCache)
	s.doClearCacheCluster(s.rolePermissionsCache)
}

// allocateCacheTargets is used to fill target value types
// for getting items from cache.
func allocateCacheTargets[T any](l int) []any {
	toPass := make([]any, 0, l)
	for i := 0; i < l; i++ {
		toPass = append(toPass, new(T))
	}
	return toPass
}
