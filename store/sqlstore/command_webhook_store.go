// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlCommandWebhookStore struct {
	SqlStore
}

func NewSqlCommandWebhookStore(sqlStore SqlStore) store.CommandWebhookStore {
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

func (s SqlCommandWebhookStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_command_webhook_create_at", "CommandWebhooks", "CreateAt")
}

func (s SqlCommandWebhookStore) Save(webhook *model.CommandWebhook) (*model.CommandWebhook, *model.AppError) {
	if len(webhook.Id) > 0 {
		return nil, model.NewAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.existing.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
	}

	webhook.PreSave()
	if err := webhook.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(webhook); err != nil {
		return nil, model.NewAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return webhook, nil
}

func (s SqlCommandWebhookStore) Get(id string) (*model.CommandWebhook, *model.AppError) {
	var webhook model.CommandWebhook

	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
	var appErr *model.AppError
	if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM CommandWebhooks WHERE Id = :Id AND CreateAt > :ExpTime", map[string]interface{}{"Id": id, "ExpTime": exptime}); err != nil {
		appErr = model.NewAppError("SqlCommandWebhookStore.Get", "store.sql_command_webhooks.get.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		if err == sql.ErrNoRows {
			appErr.StatusCode = http.StatusNotFound
		}
		return nil, appErr
	}

	return &webhook, nil
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) *model.AppError {
	if sqlResult, err := s.GetMaster().Exec("UPDATE CommandWebhooks SET UseCount = UseCount + 1 WHERE Id = :Id AND UseCount < :UseLimit", map[string]interface{}{"Id": id, "UseLimit": limit}); err != nil {
		return model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
		return model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.invalid.app_error", nil, "id="+id, http.StatusBadRequest)
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
