// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlServiceTermsStore struct {
	SqlStore
}

func NewSqlTermStore(sqlStore SqlStore) store.ServiceTermsStore {
	s := SqlServiceTermsStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.ServiceTerms{}, "ServiceTerms").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Text").SetMaxSize(model.POST_MESSAGE_MAX_BYTES_V2)
	}

	return s
}

func (s SqlServiceTermsStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_service_terms_id", "ServiceTerms", "Id")
}
