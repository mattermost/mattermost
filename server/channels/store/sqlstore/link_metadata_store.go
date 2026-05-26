// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlLinkMetadataStore struct {
	*SqlStore

	linkMetadataColumns []string
	linkMetadataQuery   sq.SelectBuilder
}

func newSqlLinkMetadataStore(sqlStore *SqlStore) store.LinkMetadataStore {
	s := &SqlLinkMetadataStore{
		SqlStore: sqlStore,
		linkMetadataColumns: []string{
			"Hash",
			"URL",
			"Timestamp",
			"Type",
			"Data",
		},
	}

	s.linkMetadataQuery = s.getQueryBuilder().
		Select(s.linkMetadataColumns...).
		From("LinkMetadata")

	return s
}

func (s SqlLinkMetadataStore) Save(metadata *model.LinkMetadata) (*model.LinkMetadata, error) {
	if err := metadata.IsValid(); err != nil {
		return nil, err
	}

	metadata.PreSave()
	metadataBytes, err := json.Marshal(metadata.Data)
	if err != nil {
		return nil, fmt.Errorf("could not serialize metadataBytes to JSON: %w", err)
	}
	if s.IsBinaryParamEnabled() {
		metadataBytes = AppendBinaryFlag(metadataBytes)
	}

	query := s.getQueryBuilder().
		Insert("LinkMetadata").
		Columns(s.linkMetadataColumns...).
		Values(metadata.Hash, metadata.URL, metadata.Timestamp, metadata.Type, metadataBytes)

	query = query.SuffixExpr(sq.Expr("ON CONFLICT (hash) DO UPDATE SET URL = ?, Timestamp = ?, Type = ?, Data = ?", metadata.URL, metadata.Timestamp, metadata.Type, metadataBytes))

	q, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("metadata_tosql: %w", err)
	}

	_, err = s.GetMaster().Exec(q, args...)
	if err != nil && !IsUniqueConstraintError(err, []string{"PRIMARY", "linkmetadata_pkey"}) {
		return nil, fmt.Errorf("could not save link metadata: %w", err)
	}

	return metadata, nil
}

func (s SqlLinkMetadataStore) Get(url string, timestamp int64) (*model.LinkMetadata, error) {
	var metadata model.LinkMetadata
	query, args, err := s.linkMetadataQuery.
		Where(sq.Eq{"URL": url, "Timestamp": timestamp}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("could not create query with querybuilder: %w", err)
	}
	err = s.GetReplica().Get(&metadata, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("LinkMetadata", "url="+url)
		}
		return nil, fmt.Errorf("could not get metadata with selectone: url=%s: %w", url, err)
	}

	err = metadata.DeserializeDataToConcreteType()
	if err != nil {
		return nil, fmt.Errorf("could not deserialize metadata to concrete type for url=%s: %w", url, err)
	}

	return &metadata, nil
}
