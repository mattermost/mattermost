// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
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
	metrics                      einterfaces.MetricsInterface
	cluster                      einterfaces.ClusterInterface
	reaction                     LocalCacheReactionStore
	reactionCache                cache.Cache
	role                         LocalCacheRoleStore
	roleCache                    cache.Cache
	scheme                       LocalCacheSchemeStore
	schemeCache                  cache.Cache
	emoji                        LocalCacheEmojiStore
	emojiCacheById               cache.Cache
	emojiIdCacheByName           cache.Cache
	channel                      LocalCacheChannelStore
	channelMemberCountsCache     cache.Cache
	channelGuestCountCache       cache.Cache
	channelPinnedPostCountsCache cache.Cache
	channelByIdCache             cache.Cache
	webhook                      LocalCacheWebhookStore
	webhookCache                 cache.Cache
	post                         LocalCachePostStore
	postLastPostsCache           cache.Cache
	lastPostTimeCache            cache.Cache
	user                         LocalCacheUserStore
	userProfileByIdsCache        cache.Cache
	profilesInChannelCache       cache.Cache
	team                         LocalCacheTeamStore
	teamAllTeamIdsForUserCache   cache.Cache
	termsOfService               LocalCacheTermsOfServiceStore
	termsOfServiceCache          cache.Cache
}

func NewLocalCacheLayer(baseStore store.Store, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface, cacheProvider cache.Provider) LocalCacheStore {

	localCacheStore := LocalCacheStore{
		Store:   baseStore,
		cluster: cluster,
		metrics: metrics,
	}
	localCacheStore.reactionCache = cacheProvider.NewCacheWithParams(REACTION_CACHE_SIZE, "Reaction", REACTION_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS)
	localCacheStore.reaction = LocalCacheReactionStore{ReactionStore: baseStore.Reaction(), rootStore: &localCacheStore}
	localCacheStore.roleCache = cacheProvider.NewCacheWithParams(ROLE_CACHE_SIZE, "Role", ROLE_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES)
	localCacheStore.role = LocalCacheRoleStore{RoleStore: baseStore.Role(), rootStore: &localCacheStore}
	localCacheStore.schemeCache = cacheProvider.NewCacheWithParams(SCHEME_CACHE_SIZE, "Scheme", SCHEME_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES)
	localCacheStore.scheme = LocalCacheSchemeStore{SchemeStore: baseStore.Scheme(), rootStore: &localCacheStore}
	localCacheStore.webhookCache = cacheProvider.NewCacheWithParams(WEBHOOK_CACHE_SIZE, "Webhook", WEBHOOK_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS)
	localCacheStore.webhook = LocalCacheWebhookStore{WebhookStore: baseStore.Webhook(), rootStore: &localCacheStore}
	localCacheStore.emojiCacheById = cacheProvider.NewCacheWithParams(EMOJI_CACHE_SIZE, "EmojiById", EMOJI_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID)
	localCacheStore.emojiIdCacheByName = cacheProvider.NewCacheWithParams(EMOJI_CACHE_SIZE, "EmojiByName", EMOJI_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME)
	localCacheStore.emoji = LocalCacheEmojiStore{EmojiStore: baseStore.Emoji(), rootStore: &localCacheStore}

	localCacheStore.channelPinnedPostCountsCache = cacheProvider.NewCacheWithParams(CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SIZE, "ChannelPinnedPostsCounts", CHANNEL_PINNEDPOSTS_COUNTS_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_PINNEDPOSTS_COUNTS)
	localCacheStore.channelMemberCountsCache = cacheProvider.NewCacheWithParams(CHANNEL_MEMBERS_COUNTS_CACHE_SIZE, "ChannelMemberCounts", CHANNEL_MEMBERS_COUNTS_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS)
	localCacheStore.channelGuestCountCache = cacheProvider.NewCacheWithParams(CHANNEL_GUEST_COUNT_CACHE_SIZE, "ChannelGuestsCount", CHANNEL_GUEST_COUNT_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_GUEST_COUNT)
	localCacheStore.channelByIdCache = cacheProvider.NewCacheWithParams(model.CHANNEL_CACHE_SIZE, "channelById", CHANNEL_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL)

	localCacheStore.channel = LocalCacheChannelStore{ChannelStore: baseStore.Channel(), rootStore: &localCacheStore}

	localCacheStore.postLastPostsCache = cacheProvider.NewCacheWithParams(LAST_POSTS_CACHE_SIZE, "LastPost", LAST_POSTS_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS)
	localCacheStore.lastPostTimeCache = cacheProvider.NewCacheWithParams(LAST_POST_TIME_CACHE_SIZE, "LastPostTime", LAST_POST_TIME_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POST_TIME)

	localCacheStore.post = LocalCachePostStore{PostStore: baseStore.Post(), rootStore: &localCacheStore}

	localCacheStore.termsOfServiceCache = cacheProvider.NewCacheWithParams(TERMS_OF_SERVICE_CACHE_SIZE, "TermsOfService", TERMS_OF_SERVICE_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TERMS_OF_SERVICE)
	localCacheStore.termsOfService = LocalCacheTermsOfServiceStore{TermsOfServiceStore: baseStore.TermsOfService(), rootStore: &localCacheStore}
	localCacheStore.userProfileByIdsCache = cacheProvider.NewCacheWithParams(USER_PROFILE_BY_ID_CACHE_SIZE, "UserProfileByIds", USER_PROFILE_BY_ID_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS)
	localCacheStore.profilesInChannelCache = cacheProvider.NewCacheWithParams(PROFILES_IN_CHANNEL_CACHE_SIZE, "ProfilesInChannel", PROFILES_IN_CHANNEL_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_IN_CHANNEL)
	localCacheStore.user = LocalCacheUserStore{UserStore: baseStore.User(), rootStore: &localCacheStore}
	localCacheStore.teamAllTeamIdsForUserCache = cacheProvider.NewCacheWithParams(TEAM_CACHE_SIZE, "Team", TEAM_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_TEAMS)
	localCacheStore.team = LocalCacheTeamStore{TeamStore: baseStore.Team(), rootStore: &localCacheStore}

	if cluster != nil {
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS, localCacheStore.reaction.handleClusterInvalidateReaction)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES, localCacheStore.role.handleClusterInvalidateRole)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES, localCacheStore.scheme.handleClusterInvalidateScheme)
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
	return localCacheStore
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
	cache.AddWithDefaultExpires(key, value)
}

func (s *LocalCacheStore) doStandardReadCache(cache cache.Cache, key string) interface{} {
	if cacheItem, ok := cache.Get(key); ok {
		if s.metrics != nil {
			s.metrics.IncrementMemCacheHitCounter(cache.Name())
		}
		return cacheItem
	}

	if s.metrics != nil {
		s.metrics.IncrementMemCacheMissCounter(cache.Name())
	}

	return nil
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
}
