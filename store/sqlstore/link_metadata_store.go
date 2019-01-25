// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlLinkMetadataStore struct {
	SqlStore
}

func NewSqlLinkMetadataStore(sqlStore SqlStore) store.LinkMetadataStore {
	s := &SqlLinkMetadataStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.LinkMetadata{}, "LinkMetadata").SetKeys(false, "Hash")
		table.ColMap("URL").SetMaxSize(2048)
		table.ColMap("Type").SetMaxSize(16)
		table.ColMap("Data").SetMaxSize(4096)
	}

	return s
}

func (s SqlLinkMetadataStore) CreateIndexesIfNotExists() {
	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		s.CreateCompositeIndexIfNotExists("idx_link_metadata_url_timestamp", "LinkMetadata", []string{"URL(512)", "Timestamp"})
	} else {
		s.CreateCompositeIndexIfNotExists("idx_link_metadata_url_timestamp", "LinkMetadata", []string{"URL", "Timestamp"})
	}
}

func (s SqlLinkMetadataStore) Save(metadata *model.LinkMetadata) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = metadata.IsValid(); result.Err != nil {
			return
		}

		metadata.PreSave()

		err := s.GetMaster().Insert(metadata)
		if err != nil {
			result.Err = model.NewAppError("SqlLinkMetadataStore.Save", "store.sql_link_metadata.save.app_error", nil, "url="+metadata.URL+", "+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = metadata
	})
}

func (s SqlLinkMetadataStore) Get(url string, timestamp int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var metadata *model.LinkMetadata

		err := s.GetReplica().SelectOne(&metadata,
			`SELECT
				*
			FROM
				LinkMetadata
			WHERE
				URL = :URL
				AND Timestamp = :Timestamp`, map[string]interface{}{"URL": url, "Timestamp": timestamp})
		if err != nil {
			result.Err = model.NewAppError("SqlLinkMetadataStore.Get", "store.sql_link_metadata.get.app_error", nil, "url="+url+", "+err.Error(), http.StatusInternalServerError)

			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}

			return
		}

		err = metadata.DeserializeDataToConcreteType()
		if err != nil {
			result.Err = model.NewAppError("SqlLinkMetadataStore.Get", "store.sql_link_metadata.get.app_error", nil, "url="+url+", "+err.Error(), http.StatusInternalServerError)

			return
		}

		result.Data = metadata
	})
}
