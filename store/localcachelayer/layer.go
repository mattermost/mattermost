// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	REACTION_CACHE_SIZE = 20000
	REACTION_CACHE_SEC  = 30 * 60

	ROLE_CACHE_SIZE = 20000
	ROLE_CACHE_SEC  = 30 * 60

	SCHEME_CACHE_SIZE = 20000
	SCHEME_CACHE_SEC  = 30 * 60

	WEBHOOK_CACHE_SIZE = 25000
	WEBHOOK_CACHE_SEC  = 15 * 60

	EMOJI_CACHE_SIZE = 5000
	EMOJI_CACHE_SEC  = 30 * 60

	CHANNEL_MEMBERS_COUNTS_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	CHANNEL_MEMBERS_COUNTS_CACHE_SEC  = 30 * 60

	LAST_POSTS_CACHE_SIZE = 20000
	LAST_POSTS_CACHE_SEC  = 30 * 60

	USER_PROFILE_BY_ID_CACHE_SIZE = 20000
	USER_PROFILE_BY_ID_SEC        = 30 * 60

	CLEAR_CACHE_MESSAGE_DATA = ""
)

type LocalCacheStore struct {
	store.Store
	metrics                  einterfaces.MetricsInterface
	cluster                  einterfaces.ClusterInterface
	reaction                 LocalCacheReactionStore
	reactionCache            *utils.Cache
	role                     LocalCacheRoleStore
	roleCache                *utils.Cache
	scheme                   LocalCacheSchemeStore
	schemeCache              *utils.Cache
	emoji                    LocalCacheEmojiStore
	emojiCacheById           *utils.Cache
	emojiIdCacheByName       *utils.Cache
	channel                  LocalCacheChannelStore
	channelMemberCountsCache *utils.Cache
	webhook                  LocalCacheWebhookStore
	webhookCache             *utils.Cache
	post                     LocalCachePostStore
	postLastPostsCache       *utils.Cache
	user                     LocalCacheUserStore
	userProfileByIdsCache    *utils.Cache
}

func NewLocalCacheLayer(baseStore store.Store, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface) LocalCacheStore {
	localCacheStore := LocalCacheStore{
		Store:   baseStore,
		cluster: cluster,
		metrics: metrics,
	}
	localCacheStore.reactionCache = utils.NewLruWithParams(REACTION_CACHE_SIZE, "Reaction", REACTION_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS)
	localCacheStore.reaction = LocalCacheReactionStore{ReactionStore: baseStore.Reaction(), rootStore: &localCacheStore}
	localCacheStore.roleCache = utils.NewLruWithParams(ROLE_CACHE_SIZE, "Role", ROLE_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES)
	localCacheStore.role = LocalCacheRoleStore{RoleStore: baseStore.Role(), rootStore: &localCacheStore}
	localCacheStore.schemeCache = utils.NewLruWithParams(SCHEME_CACHE_SIZE, "Scheme", SCHEME_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES)
	localCacheStore.scheme = LocalCacheSchemeStore{SchemeStore: baseStore.Scheme(), rootStore: &localCacheStore}
	localCacheStore.webhookCache = utils.NewLruWithParams(WEBHOOK_CACHE_SIZE, "Webhook", WEBHOOK_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS)
	localCacheStore.webhook = LocalCacheWebhookStore{WebhookStore: baseStore.Webhook(), rootStore: &localCacheStore}
	localCacheStore.emojiCacheById = utils.NewLruWithParams(EMOJI_CACHE_SIZE, "EmojiById", EMOJI_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID)
	localCacheStore.emojiIdCacheByName = utils.NewLruWithParams(EMOJI_CACHE_SIZE, "EmojiByName", EMOJI_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME)
	localCacheStore.emoji = LocalCacheEmojiStore{EmojiStore: baseStore.Emoji(), rootStore: &localCacheStore}
	localCacheStore.channelMemberCountsCache = utils.NewLruWithParams(CHANNEL_MEMBERS_COUNTS_CACHE_SIZE, "ChannelMemberCounts", CHANNEL_MEMBERS_COUNTS_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS)
	localCacheStore.channel = LocalCacheChannelStore{ChannelStore: baseStore.Channel(), rootStore: &localCacheStore}
	localCacheStore.postLastPostsCache = utils.NewLruWithParams(LAST_POSTS_CACHE_SIZE, "LastPost", LAST_POSTS_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS)
	localCacheStore.post = LocalCachePostStore{PostStore: baseStore.Post(), rootStore: &localCacheStore}
	localCacheStore.userProfileByIdsCache = utils.NewLruWithParams(USER_PROFILE_BY_ID_CACHE_SIZE, "UserProfileByIds", USER_PROFILE_BY_ID_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS)
	localCacheStore.user = LocalCacheUserStore{UserStore: baseStore.User(), rootStore: &localCacheStore}

	if cluster != nil {
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS, localCacheStore.reaction.handleClusterInvalidateReaction)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_ROLES, localCacheStore.role.handleClusterInvalidateRole)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_SCHEMES, localCacheStore.scheme.handleClusterInvalidateScheme)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_WEBHOOKS, localCacheStore.webhook.handleClusterInvalidateWebhook)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_BY_ID, localCacheStore.emoji.handleClusterInvalidateEmojiById)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_EMOJIS_ID_BY_NAME, localCacheStore.emoji.handleClusterInvalidateEmojiIdByName)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_CHANNEL_MEMBER_COUNTS, localCacheStore.channel.handleClusterInvalidateChannelMemberCounts)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_LAST_POSTS, localCacheStore.post.handleClusterInvalidateLastPosts)
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_PROFILE_BY_IDS, localCacheStore.user.handleClusterInvalidateScheme)
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

func (s LocalCacheStore) User() store.UserStore {
	return s.user
}

func (s LocalCacheStore) DropAllTables() {
	s.Invalidate()
	s.Store.DropAllTables()
}

func (s *LocalCacheStore) doInvalidateCacheCluster(cache *utils.Cache, key string) {
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

func (s *LocalCacheStore) doStandardAddToCache(cache *utils.Cache, key string, value interface{}) {
	cache.AddWithDefaultExpires(key, value)
}

func (s *LocalCacheStore) doStandardReadCache(cache *utils.Cache, key string) interface{} {
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

func (s *LocalCacheStore) doClearCacheCluster(cache *utils.Cache) {
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
	s.doClearCacheCluster(s.postLastPostsCache)
	s.doClearCacheCluster(s.userProfileByIdsCache)
}
