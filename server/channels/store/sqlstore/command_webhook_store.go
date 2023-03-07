// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

type SqlCommandWebhookStore struct {
	*SqlStore
}

func newSqlCommandWebhookStore(sqlStore *SqlStore) store.CommandWebhookStore {
	return &SqlCommandWebhookStore{sqlStore}
}

func (s SqlCommandWebhookStore) Save(webhook *model.CommandWebhook) (*model.CommandWebhook, error) {
	if webhook.Id != "" {
		return nil, store.NewErrInvalidInput("CommandWebhook", "id", webhook.Id)
	}

	webhook.PreSave()
	if err := webhook.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO CommandWebhooks
		(Id,CreateAt,CommandId,UserId,ChannelId,RootId,UseCount)
		Values
		(:Id, :CreateAt, :CommandId, :UserId, :ChannelId, :RootId, :UseCount)`, webhook); err != nil {
		return nil, errors.Wrapf(err, "save: id=%s", webhook.Id)
	}

	return webhook, nil
}

func (s SqlCommandWebhookStore) Get(id string) (*model.CommandWebhook, error) {
	var webhook model.CommandWebhook

	exptime := model.GetMillis() - model.CommandWebhookLifetime

	query := s.getQueryBuilder().
		Select("*").
		From("CommandWebhooks").
		Where(sq.Eq{"Id": id}).
		Where(sq.Gt{"CreateAt": exptime})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_tosql")
	}

	if err := s.GetReplicaX().Get(&webhook, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("CommandWebhook", id)
		}
		return nil, errors.Wrapf(err, "get: id=%s", id)
	}

	return &webhook, nil
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) error {
	query := s.getQueryBuilder().
		Update("CommandWebhooks").
		Set("UseCount", sq.Expr("UseCount + 1")).
		Where(sq.Eq{"Id": id}).
		Where(sq.Lt{"UseCount": limit})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "tryuse_tosql")
	}

	if sqlResult, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "tryuse: id=%s limit=%d", id, limit)
	} else if rows, err := sqlResult.RowsAffected(); rows == 0 {
		return store.NewErrInvalidInput("CommandWebhook", "id", id).Wrap(err)
	}

	return nil
}

func (s SqlCommandWebhookStore) Cleanup() {
	mlog.Debug("Cleaning up command webhook store.")
	exptime := model.GetMillis() - model.CommandWebhookLifetime

	query := s.getQueryBuilder().
		Delete("CommandWebhooks").
		Where(sq.Lt{"CreateAt": exptime})

	queryString, args, err := query.ToSql()
	if err != nil {
		mlog.Error("Failed to build query when trying to perform a cleanup in command webhook store.")
		return
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		mlog.Error("Unable to cleanup command webhook store.")
	}
}
