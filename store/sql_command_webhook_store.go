// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"net/http"

	"database/sql"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
)

type SqlCommandWebhookStore struct {
	SqlStore
}

func NewSqlCommandWebhookStore(sqlStore SqlStore) CommandWebhookStore {
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

func (s SqlCommandWebhookStore) Save(webhook *model.CommandWebhook) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if len(webhook.Id) > 0 {
			result.Err = model.NewLocAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.existing.app_error", nil, "id="+webhook.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		webhook.PreSave()
		if result.Err = webhook.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(webhook); err != nil {
			result.Err = model.NewLocAppError("SqlCommandWebhookStore.Save", "store.sql_command_webhooks.save.app_error", nil, "id="+webhook.Id+", "+err.Error())
		} else {
			result.Data = webhook
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandWebhookStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var webhook model.CommandWebhook

		exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
		if err := s.GetReplica().SelectOne(&webhook, "SELECT * FROM CommandWebhooks WHERE Id = :Id AND CreateAt > :ExpTime", map[string]interface{}{"Id": id, "ExpTime": exptime}); err != nil {
			result.Err = model.NewLocAppError("SqlCommandWebhookStore.Get", "store.sql_command_webhooks.get.app_error", nil, "id="+id+", err="+err.Error())
			if err == sql.ErrNoRows {
				result.Err.StatusCode = http.StatusNotFound
			}
		}

		result.Data = &webhook

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if sqlResult, err := s.GetMaster().Exec("UPDATE CommandWebhooks SET UseCount = UseCount + 1 WHERE Id = :Id AND UseCount < :UseLimit", map[string]interface{}{"Id": id, "UseLimit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.app_error", nil, "id="+id+", err="+err.Error())
		} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
			result.Err = model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.invalid.app_error", nil, "id="+id, http.StatusBadRequest)
		}

		result.Data = id

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlCommandWebhookStore) Cleanup() {
	l4g.Debug("Cleaning up command webhook store.")
	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME
	if _, err := s.GetMaster().Exec("DELETE FROM CommandWebhooks WHERE CreateAt < :ExpTime", map[string]interface{}{"ExpTime": exptime}); err != nil {
		l4g.Error("Unable to cleanup command webhook store.")
	}
}
