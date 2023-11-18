// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlLinkMetadataStore struct {
	*SqlStore
}

func newSqlLinkMetadataStore(sqlStore *SqlStore) store.LinkMetadataStore {
	return &SqlLinkMetadataStore{sqlStore}
}

func (s SqlLinkMetadataStore) Save(metadata *model.LinkMetadata) (*model.LinkMetadata, error) {
	if err := metadata.IsValid(); err != nil {
		return nil, err
	}

	metadata.PreSave()
	metadataBytes, err := json.Marshal(metadata.Data)
	if err != nil {
		return nil, errors.Wrap(err, "could not serialize metadataBytes to JSON")
	}
	if s.IsBinaryParamEnabled() {
		metadataBytes = AppendBinaryFlag(metadataBytes)
	}

	query := s.getQueryBuilder().
		Insert("LinkMetadata").
		Columns("Hash", "URL", "Timestamp", "Type", "Data").
		Values(metadata.Hash, metadata.URL, metadata.Timestamp, metadata.Type, metadataBytes)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE URL = ?, Timestamp = ?, Type = ?, Data = ?", metadata.URL, metadata.Timestamp, metadata.Type, metadataBytes))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (hash) DO UPDATE SET URL = ?, Timestamp = ?, Type = ?, Data = ?", metadata.URL, metadata.Timestamp, metadata.Type, metadataBytes))
	}

	q, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "metadata_tosql")
	}

	_, err = s.GetMasterX().Exec(q, args...)
	if err != nil && !IsUniqueConstraintError(err, []string{"PRIMARY", "linkmetadata_pkey"}) {
		return nil, errors.Wrap(err, "could not save link metadata")
	}

	return metadata, nil
}

func (s SqlLinkMetadataStore) Get(url string, timestamp int64) (*model.LinkMetadata, error) {
	var metadata model.LinkMetadata
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("LinkMetadata").
		Where(sq.Eq{"URL": url, "Timestamp": timestamp}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "could not create query with querybuilder")
	}
	err = s.GetReplicaX().Get(&metadata, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("LinkMetadata", "url="+url)
		}
		return nil, errors.Wrapf(err, "could not get metadata with selectone: url=%s", url)
	}

	err = metadata.DeserializeDataToConcreteType()
	if err != nil {
		return nil, errors.Wrapf(err, "could not deserialize metadata to concrete type for url=%s", url)
	}

	return &metadata, nil
}
