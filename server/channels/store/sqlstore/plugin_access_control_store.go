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

type SqlPluginAccessControlStore struct {
	*SqlStore
}

func newSqlPluginAccessControlStore(sqlStore *SqlStore) store.PluginAccessControlStore {
	return &SqlPluginAccessControlStore{SqlStore: sqlStore}
}

func (s *SqlPluginAccessControlStore) IsUserAllowed(rctx request.CTX, pluginID, userID string) (bool, error) {
	query := s.getQueryBuilder().
		Select("1").
		From("PluginAccessControlUsers").
		Where(sq.Eq{
			"PluginId": pluginID,
			"UserId":   userID,
		}).
		Limit(1)

	var one int
	err := s.DBXFromContext(rctx.Context()).GetBuilder(&one, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, errors.Wrapf(err, "failed to check plugin access control for plugin=%s user=%s", pluginID, userID)
	}
	return true, nil
}

func (s *SqlPluginAccessControlStore) GetUserIDs(rctx request.CTX, pluginID string) ([]string, error) {
	query := s.getQueryBuilder().
		Select("UserId").
		From("PluginAccessControlUsers").
		Where(sq.Eq{"PluginId": pluginID}).
		OrderBy("CreateAt ASC", "UserId ASC")

	userIDs := []string{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&userIDs, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get plugin access control users for plugin=%s", pluginID)
	}
	return userIDs, nil
}

func (s *SqlPluginAccessControlStore) SetUserIDs(rctx request.CTX, pluginID string, userIDs []string) error {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	del := s.getQueryBuilder().
		Delete("PluginAccessControlUsers").
		Where(sq.Eq{"PluginId": pluginID})
	if _, err = transaction.ExecBuilder(del); err != nil {
		return errors.Wrapf(err, "failed to clear plugin access control users for plugin=%s", pluginID)
	}

	if len(userIDs) == 0 {
		if err = transaction.Commit(); err != nil {
			return errors.Wrap(err, "commit_transaction")
		}
		return nil
	}

	now := model.GetMillis()
	chunks := chunkSlice(userIDs, 3, s.SqlStore.getMaxInsertParams())
	for _, chunk := range chunks {
		insert := s.getQueryBuilder().
			Insert("PluginAccessControlUsers").
			Columns("PluginId", "UserId", "CreateAt")
		for _, userID := range chunk {
			insert = insert.Values(pluginID, userID, now)
		}
		if _, err = transaction.ExecBuilder(insert); err != nil {
			return errors.Wrapf(err, "failed to set plugin access control users for plugin=%s", pluginID)
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (s *SqlPluginAccessControlStore) DeleteByPlugin(rctx request.CTX, pluginID string) error {
	query := s.getQueryBuilder().
		Delete("PluginAccessControlUsers").
		Where(sq.Eq{"PluginId": pluginID})
	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to delete plugin access control users for plugin=%s", pluginID)
	}
	return nil
}
