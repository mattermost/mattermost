// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgLinkMetadataStore struct {
	sqlstore.SqlLinkMetadataStore
}

func (s PgLinkMetadataStore) CreateIndexesIfNotExists() {
	s.CreateCompositeIndexIfNotExists("idx_link_metadata_url_timestamp", "LinkMetadata", []string{"URL", "Timestamp"})
}
