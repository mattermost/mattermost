// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlMEChannelKeysStore struct {
	*SqlStore

	selectQueryBuilder sq.SelectBuilder
}

func newSqlMEChannelKeysStore(sqlStore *SqlStore) store.MEChannelKeysStore {
	s := &SqlMEChannelKeysStore{SqlStore: sqlStore}

	s.selectQueryBuilder = s.getQueryBuilder().Select(meChannelKeyColumns()...).From("MEChannelKeys")

	return s
}

func meChannelKeyColumns() []string {
	return []string{
		"ChannelId",
		"WrappedDEK",
		"KeyId",
		"CreateAt",
		"UpdateAt",
	}
}

// Save inserts a new row. It mutates key by populating CreateAt/UpdateAt via
// PreSave so the caller can observe the persisted timestamps. Use Upsert
// instead on a row that may already exist — Upsert does not mutate.
func (s *SqlMEChannelKeysStore) Save(rctx request.CTX, key *model.MEChannelKey) error {
	key.PreSave()

	query := s.getQueryBuilder().
		Insert("MEChannelKeys").
		Columns(meChannelKeyColumns()...).
		Values(key.ChannelID, key.WrappedDEK, key.KeyID, key.CreateAt, key.UpdateAt)

	// TODO(phase-4): detect PK violation on mechannelkeys_pkey (use IsUniqueConstraintError
	// as channel_store.go:823 does) and return store.NewErrUniqueConstraint("ChannelId") so
	// CreateMEChannel's rollback path can distinguish "duplicate key row" (race, previous
	// failed creation — retryable) from "DB unreachable" (permanent — abort). Update
	// testMEChannelKeysSaveDuplicate to assert via errors.As(&store.ErrUniqueConstraint{})
	// instead of the current bare require.Error.
	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save ME channel key")
	}

	return nil
}

func (s *SqlMEChannelKeysStore) Get(rctx request.CTX, channelID string) (*model.MEChannelKey, error) {
	query := s.selectQueryBuilder.Where(sq.Eq{"ChannelId": channelID})

	var key model.MEChannelKey
	if err := s.GetReplica().GetBuilder(&key, query); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("MEChannelKey", channelID)
		}
		return nil, errors.Wrapf(err, "failed to get ME channel key for channel %s", channelID)
	}

	return &key, nil
}

func (s *SqlMEChannelKeysStore) GetAll(rctx request.CTX) ([]*model.MEChannelKey, error) {
	keys := make([]*model.MEChannelKey, 0)

	// GetMaster: called at startup to populate security guards; replicas may lag.
	if err := s.GetMaster().SelectBuilder(&keys, s.selectQueryBuilder); err != nil {
		return nil, errors.Wrap(err, "failed to get all ME channel keys")
	}

	return keys, nil
}

func (s *SqlMEChannelKeysStore) Delete(rctx request.CTX, channelID string) error {
	query := s.getQueryBuilder().
		Delete("MEChannelKeys").
		Where(sq.Eq{"ChannelId": channelID})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete ME channel key")
	}

	return nil
}

func (s *SqlMEChannelKeysStore) Upsert(rctx request.CTX, key *model.MEChannelKey) error {
	// Upsert deliberately does NOT mutate the caller's struct: on the UPDATE path
	// the DB row keeps its original CreateAt, so mutating key.CreateAt to GetMillis()
	// (as PreSave would) would leave the caller with a value that doesn't match the
	// DB. Compute everything locally. Callers that need the DB-truth CreateAt must
	// re-Get after Upsert.
	now := model.GetMillis()
	createAt := key.CreateAt
	if createAt == 0 {
		createAt = now
	}
	updateAt := now

	query := s.getQueryBuilder().
		Insert("MEChannelKeys").
		Columns(meChannelKeyColumns()...).
		Values(key.ChannelID, key.WrappedDEK, key.KeyID, createAt, updateAt).
		SuffixExpr(sq.Expr(
			"ON CONFLICT (ChannelId) DO UPDATE SET WrappedDEK = ?, KeyId = ?, UpdateAt = ?",
			key.WrappedDEK, key.KeyID, updateAt,
		))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to upsert ME channel key")
	}

	return nil
}
