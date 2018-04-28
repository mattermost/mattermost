// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
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

func (s SqlCommandWebhookStore) Save(webhook *model.CommandWebhook) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(webhook.Id) > 0 {
			result.Err = model.NewAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.existing.app_error", nil, "id="+webhook.Id, http.StatusBadRequest)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(webhook); err != nil {
			result.Err = model.NewAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.app_error", nil, "id="+webhook.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = webhook
		}
	})
}

func (s SqlCommandWebhookStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var webhook model.CommandWebhook

		exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM CommandWebhooks WHERE Id = :Id AND CreateAt > :ExpTime", map[string]interface{}{"Id": id, "ExpTime": exptime}); err != nil {
			result.Err = model.NewAppError("SqlCommandWebhookStore.Get", "store.sql_command_webhooks.get.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		}

		result.Data = &webhook
	})
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if sqlResult, err := s.GetMaster().Exec("UPDATE CommandWebhooks SET UseCount = UseCount + 1 WHERE Id = :Id AND UseCount < :UseLimit", map[string]interface{}{"Id": id, "UseLimit": limit}); err != nil {
			result.Err = model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
			result.Err = model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.invalid.app_error", nil, "id="+id, http.StatusBadRequest)
		}

		result.Data = id
	})
}

func (s SqlCommandWebhookStore) Cleanup() {
	mlog.Debug("Cleaning up command webhook store.")
	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
	if _, err := s.GetMaster().Exec("DELETE FROM CommandWebhooks WHERE CreateAt < :ExpTime", map[string]interface{}{"ExpTime": exptime}); err != nil {
		mlog.Error("Unable to cleanup command webhook store.")
	}
}
