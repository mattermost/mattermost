// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// SqlSessionAttributeStore is a no-op SessionAttributeStore: session
// attributes are never persisted to SQL. The localcachelayer wraps this and
// is the source of truth at runtime; the DB-backed shim exists only to
// satisfy the store.Store interface.
type SqlSessionAttributeStore struct {
	*SqlStore
}

func newSqlSessionAttributeStore(sqlStore *SqlStore) store.SessionAttributeStore {
	return &SqlSessionAttributeStore{SqlStore: sqlStore}
}

func (s *SqlSessionAttributeStore) Refresh(_ string, _ map[string]any) error {
	return nil
}

func (s *SqlSessionAttributeStore) Get(_ string) (map[string]any, error) {
	return map[string]any{}, nil
}
