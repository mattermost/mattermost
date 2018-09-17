// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"net/http"
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

func (s SqlServiceTermsStore) Save(serviceTerms *model.ServiceTerms) store.StoreChannel {
	return store.Do(func (result *store.StoreResult) {
		if len(serviceTerms.Id) > 0 {
			result.Err = model.NewAppError(
				"SqlServiceTermsStore.Save",
				"store.sql_service_terms_store.save.existing.app_error",
				nil,
				"id="+serviceTerms.Id, http.StatusBadRequest,
			)
			return


		}
	})
}
