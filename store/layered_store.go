// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

const (
	ENABLE_EXPERIMENTAL_REDIS = false
)

type LayeredStoreDatabaseLayer interface {
	LayeredStoreSupplier
	Store
}

type LayeredStore struct {
	TmpContext      context.Context
	ReactionStore   ReactionStore
	RoleStore       RoleStore
	SchemeStore     SchemeStore
	DatabaseLayer   LayeredStoreDatabaseLayer
	LocalCacheLayer *LocalCacheSupplier
	RedisLayer      *RedisSupplier
	LayerChainHead  LayeredStoreSupplier
}

func NewLayeredStore(db LayeredStoreDatabaseLayer, metrics einterfaces.MetricsInterface, cluster einterfaces.ClusterInterface) Store {
	store := &LayeredStore{
		TmpContext:      context.TODO(),
		DatabaseLayer:   db,
		LocalCacheLayer: NewLocalCacheSupplier(metrics, cluster),
	}

	store.ReactionStore = &LayeredReactionStore{store}
	store.RoleStore = &LayeredRoleStore{store}
	store.SchemeStore = &LayeredSchemeStore{store}

	// Setup the chain
	if ENABLE_EXPERIMENTAL_REDIS {
		mlog.Debug("Experimental redis enabled.")
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

func (s *LayeredStore) CommandWebhook() CommandWebhookStore {
	return s.DatabaseLayer.CommandWebhook()
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

func (s *LayeredStore) ChannelMemberHistory() ChannelMemberHistoryStore {
	return s.DatabaseLayer.ChannelMemberHistory()
}

func (s *LayeredStore) Plugin() PluginStore {
	return s.DatabaseLayer.Plugin()
}

func (s *LayeredStore) Role() RoleStore {
	return s.RoleStore
}

func (s *LayeredStore) ServiceTerms() ServiceTermsStore {
	return s.DatabaseLayer.ServiceTerms()
}

func (s *LayeredStore) Scheme() SchemeStore {
	return s.SchemeStore
}

func (s *LayeredStore) MarkSystemRanUnitTests() {
	s.DatabaseLayer.MarkSystemRanUnitTests()
}

func (s *LayeredStore) Close() {
	s.DatabaseLayer.Close()
}

func (s *LayeredStore) LockToMaster() {
	s.DatabaseLayer.LockToMaster()
}

func (s *LayeredStore) UnlockFromMaster() {
	s.DatabaseLayer.UnlockFromMaster()
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

func (s *LayeredReactionStore) PermanentDeleteBatch(endTime int64, limit int64) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.ReactionPermanentDeleteBatch(s.TmpContext, endTime, limit)
	})
}

type LayeredRoleStore struct {
	*LayeredStore
}

func (s *LayeredRoleStore) Save(role *model.Role) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RoleSave(s.TmpContext, role)
	})
}

func (s *LayeredRoleStore) Get(roleId string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RoleGet(s.TmpContext, roleId)
	})
}

func (s *LayeredRoleStore) GetByName(name string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RoleGetByName(s.TmpContext, name)
	})
}

func (s *LayeredRoleStore) GetByNames(names []string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RoleGetByNames(s.TmpContext, names)
	})
}

func (s *LayeredRoleStore) Delete(roldId string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RoleDelete(s.TmpContext, roldId)
	})
}

func (s *LayeredRoleStore) PermanentDeleteAll() StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.RolePermanentDeleteAll(s.TmpContext)
	})
}

type LayeredSchemeStore struct {
	*LayeredStore
}

func (s *LayeredSchemeStore) Save(scheme *model.Scheme) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemeSave(s.TmpContext, scheme)
	})
}

func (s *LayeredSchemeStore) Get(schemeId string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemeGet(s.TmpContext, schemeId)
	})
}

func (s *LayeredSchemeStore) GetByName(schemeName string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemeGetByName(s.TmpContext, schemeName)
	})
}

func (s *LayeredSchemeStore) Delete(schemeId string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemeDelete(s.TmpContext, schemeId)
	})
}

func (s *LayeredSchemeStore) GetAllPage(scope string, offset int, limit int) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemeGetAllPage(s.TmpContext, scope, offset, limit)
	})
}

func (s *LayeredSchemeStore) PermanentDeleteAll() StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) *LayeredStoreSupplierResult {
		return supplier.SchemePermanentDeleteAll(s.TmpContext)
	})
}
