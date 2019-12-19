// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func (s SqlLinkMetadataStore) Save(metadata *model.LinkMetadata) (*model.LinkMetadata, *model.AppError) {
	if err := metadata.IsValid(); err != nil {
		return nil, err
	}

	metadata.PreSave()

	err := s.GetMaster().Insert(metadata)
	if err != nil && !IsUniqueConstraintError(err, []string{"PRIMARY", "linkmetadata_pkey"}) {
		return nil, model.NewAppError("SqlLinkMetadataStore.Save", "store.sql_link_metadata.save.app_error", nil, "url="+metadata.URL+", "+err.Error(), http.StatusInternalServerError)
	}

	return metadata, nil
}

func (s SqlLinkMetadataStore) Get(url string, timestamp int64) (*model.LinkMetadata, *model.AppError) {
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
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlLinkMetadataStore.Get", "store.sql_link_metadata.get.app_error", nil, "url="+url+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlLinkMetadataStore.Get", "store.sql_link_metadata.get.app_error", nil, "url="+url+", "+err.Error(), http.StatusInternalServerError)
	}

	err = metadata.DeserializeDataToConcreteType()
	if err != nil {
		return nil, model.NewAppError("SqlLinkMetadataStore.Get", "store.sql_link_metadata.get.app_error", nil, "url="+url+", "+err.Error(), http.StatusInternalServerError)
	}

	return metadata, nil
}
