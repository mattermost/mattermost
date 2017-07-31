// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

const (
	ENABLE_EXPERIMENTAL_REDIS = false
)

type LayeredStore struct {
	TmpContext      context.Context
	ReactionStore   ReactionStore
	DatabaseLayer   *SqlSupplier
	LocalCacheLayer *LocalCacheSupplier
	RedisLayer      *RedisSupplier
	LayerChainHead  LayeredStoreSupplier
}

func NewLayeredStore() Store {
	store := &LayeredStore{
		TmpContext:      context.TODO(),
		DatabaseLayer:   NewSqlSupplier(),
		LocalCacheLayer: NewLocalCacheSupplier(),
	}

	store.ReactionStore = &LayeredReactionStore{store}

	// Setup the chain
	if ENABLE_EXPERIMENTAL_REDIS {
		l4g.Debug("Experimental redis enabled.")
		store.RedisLayer = NewRedisSupplier()
		store.RedisLayer.SetChainNext(store.DatabaseLayer)
		store.LayerChainHead = store.RedisLayer
	} else {
		store.LocalCacheLayer.SetChainNext(store.DatabaseLayer)
		store.LayerChainHead = store.LocalCacheLayer
	}

	return store
}

type QueryFunction func(LayeredStoreSupplier) *LayeredStoreSupplierResult

func (s *LayeredStore) RunQuery(queryFunction QueryFunction) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := queryFunction(s.LayerChainHead)
		storeChannel <- result.StoreResult
	}()

	return storeChannel
}

func (s *LayeredStore) Team() TeamStore {
	return s.DatabaseLayer.Team()
}

func (s *LayeredStore) Channel() ChannelStore {
	return s.DatabaseLayer.Channel()
}

func (s *LayeredStore) Post() PostStore {
	return s.DatabaseLayer.Post()
}

func (s *LayeredStore) User() UserStore {
	return s.DatabaseLayer.User()
}

func (s *LayeredStore) Audit() AuditStore {
	return s.DatabaseLayer.Audit()
}

func (s *LayeredStore) ClusterDiscovery() ClusterDiscoveryStore {
	return s.DatabaseLayer.ClusterDiscovery()
}

func (s *LayeredStore) Compliance() ComplianceStore {
	return s.DatabaseLayer.Compliance()
}

func (s *LayeredStore) Session() SessionStore {
	return s.DatabaseLayer.Session()
}

func (s *LayeredStore) OAuth() OAuthStore {
	return s.DatabaseLayer.OAuth()
}

func (s *LayeredStore) System() SystemStore {
	return s.DatabaseLayer.System()
}

func (s *LayeredStore) Webhook() WebhookStore {
	return s.DatabaseLayer.Webhook()
}

func (s *LayeredStore) Command() CommandStore {
	return s.DatabaseLayer.Command()
}

func (s *LayeredStore) Preference() PreferenceStore {
	return s.DatabaseLayer.Preference()
}

func (s *LayeredStore) License() LicenseStore {
	return s.DatabaseLayer.License()
}

func (s *LayeredStore) Token() TokenStore {
	return s.DatabaseLayer.Token()
}

func (s *LayeredStore) Emoji() EmojiStore {
	return s.DatabaseLayer.Emoji()
}

func (s *LayeredStore) Status() StatusStore {
	return s.DatabaseLayer.Status()
}

func (s *LayeredStore) FileInfo() FileInfoStore {
	return s.DatabaseLayer.FileInfo()
}

func (s *LayeredStore) Reaction() ReactionStore {
	return s.ReactionStore
}

func (s *LayeredStore) Job() JobStore {
	return s.DatabaseLayer.Job()
}

func (s *LayeredStore) UserAccessToken() UserAccessTokenStore {
	return s.DatabaseLayer.UserAccessToken()
}

func (s *LayeredStore) MarkSystemRanUnitTests() {
	s.DatabaseLayer.MarkSystemRanUnitTests()
}

func (s *LayeredStore) Close() {
	s.DatabaseLayer.Close()
}

func (s *LayeredStore) DropAllTables() {
	s.DatabaseLayer.DropAllTables()
}

func (s *LayeredStore) TotalMasterDbConnections() int {
	return s.DatabaseLayer.TotalMasterDbConnections()
}

func (s *LayeredStore) TotalReadDbConnections() int {
	return s.DatabaseLayer.TotalReadDbConnections()
}

func (s *LayeredStore) TotalSearchDbConnections() int {
	return s.DatabaseLayer.TotalSearchDbConnections()
}

type LayeredReactionStore struct {
	*LayeredStore
}

func (s *LayeredReactionStore) Save(reaction *model.Reaction) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.ReactionSave(s.TmpContext, reaction)
	})
}

func (s *LayeredReactionStore) Delete(reaction *model.Reaction) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.ReactionDelete(s.TmpContext, reaction)
	})
}

func (s *LayeredReactionStore) GetForPost(postId string, allowFromCache bool) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.ReactionGetForPost(s.TmpContext, postId)
	})
}

func (s *LayeredReactionStore) DeleteAllWithEmojiName(emojiName string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.ReactionDeleteAllWithEmojiName(s.TmpContext, emojiName)
	})
}
