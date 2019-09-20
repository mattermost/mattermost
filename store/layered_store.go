// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
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

func (s *LayeredStore) GetCurrentSchemaVersion() string {
	return s.DatabaseLayer.GetCurrentSchemaVersion()
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

func (s *LayeredStore) Bot() BotStore {
	return s.DatabaseLayer.Bot()
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
	return s.DatabaseLayer.Reaction()
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
	return s.DatabaseLayer.Role()
}

func (s *LayeredStore) TermsOfService() TermsOfServiceStore {
	return s.DatabaseLayer.TermsOfService()
}

func (s *LayeredStore) UserTermsOfService() UserTermsOfServiceStore {
	return s.DatabaseLayer.UserTermsOfService()
}

func (s *LayeredStore) Scheme() SchemeStore {
	return s.DatabaseLayer.Scheme()
}

func (s *LayeredStore) Group() GroupStore {
	return s.DatabaseLayer.Group()
}

func (s *LayeredStore) LinkMetadata() LinkMetadataStore {
	return s.DatabaseLayer.LinkMetadata()
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
	defer s.LocalCacheLayer.Invalidate()
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

func (s *LayeredStore) CheckIntegrity() <-chan IntegrityCheckResult {
	return s.DatabaseLayer.CheckIntegrity()
}
