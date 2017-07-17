// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/platform/model"
)

type LayeredStore struct {
	TmpContext    context.Context
	ReactionStore ReactionStore
	DatabaseLayer *SqlSupplier
}

func NewLayeredStore() Store {
	return &LayeredStore{
		TmpContext:    context.TODO(),
		ReactionStore: &LayeredReactionStore{},
		DatabaseLayer: NewSqlSupplier(),
	}
}

type QueryFunction func(LayeredStoreSupplier) LayeredStoreSupplierResult

func (s *LayeredStore) RunQuery(queryFunction QueryFunction) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		finalResult := StoreResult{}
		// Logic for determining what layers to run
		if result := queryFunction(s.DatabaseLayer); result.Err == nil {
			finalResult.Data = result.Result
		} else {
			finalResult.Err = result.Err
		}

		storeChannel <- finalResult
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
	return s.DatabaseLayer.Reaction()
}

func (s *LayeredStore) Job() JobStore {
	return s.DatabaseLayer.Job()
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
	return s.RunQuery(func(supplier LayeredStoreSupplier) LayeredStoreSupplierResult {
		return supplier.ReactionSave(s.TmpContext, reaction)
	})
}

func (s *LayeredReactionStore) Delete(reaction *model.Reaction) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) LayeredStoreSupplierResult {
		return supplier.ReactionDelete(s.TmpContext, reaction)
	})
}

// TODO: DELETE ME
func (s *LayeredReactionStore) InvalidateCacheForPost(postId string) {
	return
}

// TODO: DELETE ME
func (s *LayeredReactionStore) InvalidateCache() {
	return
}

func (s *LayeredReactionStore) GetForPost(postId string, allowFromCache bool) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) LayeredStoreSupplierResult {
		return supplier.ReactionGetForPost(s.TmpContext, postId)
	})
}

func (s *LayeredReactionStore) DeleteAllWithEmojiName(emojiName string) StoreChannel {
	return s.RunQuery(func(supplier LayeredStoreSupplier) LayeredStoreSupplierResult {
		return supplier.ReactionDeleteAllWithEmojiName(s.TmpContext, emojiName)
	})
}
