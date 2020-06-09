// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/pkg/errors"
)

type SqlCommandWebhookStore struct {
	SqlStore
}

func newSqlCommandWebhookStore(sqlStore SqlStore) store.CommandWebhookStore {
	s := &SqlCommandWebhookStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		tablec := db.AddTableWithName(model.CommandWebhook{}, "CommandWebhooks").SetKeys(false, "Id")
		tablec.ColMap("Id").SetMaxSize(26)
		tablec.ColMap("CommandId").SetMaxSize(26)
		tablec.ColMap("UserId").SetMaxSize(26)
		tablec.ColMap("ChannelId").SetMaxSize(26)
		tablec.ColMap("RootId").SetMaxSize(26)
		tablec.ColMap("ParentId").SetMaxSize(26)
	}

	return s
}

func (s SqlCommandWebhookStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_command_webhook_create_at", "CommandWebhooks", "CreateAt")
}

func (s SqlCommandWebhookStore) Save(webhook *model.CommandWebhook) (*model.CommandWebhook, error) {
	if len(webhook.Id) > 0 {
		return nil, store.NewErrInvalidInput("CommandWebhook", "id", webhook.Id)
	}

	webhook.PreSave()
	if err := webhook.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(webhook); err != nil {
		return nil, errors.Wrapf(err, "save: id=%s", webhook.Id)
	}

	return webhook, nil
}

func (s SqlCommandWebhookStore) Get(id string) (*model.CommandWebhook, error) {
	var webhook model.CommandWebhook

	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
	if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM CommandWebhooks WHERE Id = :Id AND CreateAt > :ExpTime", map[string]interface{}{"Id": id, "ExpTime": exptime}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("CommandWebhook", id)
		}
		return nil, errors.Wrapf(err, "get: id=%s", id)
	}

	return &webhook, nil
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) error {
	if sqlResult, err := s.GetMaster().Exec("UPDATE CommandWebhooks SET UseCount = UseCount + 1 WHERE Id = :Id AND UseCount < :UseLimit", map[string]interface{}{"Id": id, "UseLimit": limit}); err != nil {
		return errors.Wrapf(err, "tryuse: id=%s limit=%d", id, limit)
	} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
		return store.NewErrInvalidInput("CommandWebhook", "id", id)
	}

	return nil
}

func (s SqlCommandWebhookStore) Cleanup() {
	mlog.Debug("Cleaning up command webhook store.")
	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
	if _, err := s.GetMaster().Exec("DELETE FROM CommandWebhooks WHERE CreateAt < :ExpTime", map[string]interface{}{"ExpTime": exptime}); err != nil {
		mlog.Error("Unable to cleanup command webhook store.")
	}
}
