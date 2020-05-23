// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

	query := s.getQueryBuilder().
		Select("*").
		From("CommandWebhooks").
		Where(sq.Eq{"Id": id}).
		Where(sq.Gt{"CreateAt": exptime})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlCommandWebhookStore.Get", "store.sql.build_query.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	}

	if err := s.GetReplica().SelectOne(&webhook, queryString, args...); err != nil {
		appErr = model.NewAppError("SqlCommandWebhookStore.Get", "store.sql_command_webhooks.get.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		if err == sql.ErrNoRows {
			appErr.StatusCode = http.StatusNotFound
		}
		return nil, appErr
	}

	return &webhook, nil
}

func (s SqlCommandWebhookStore) TryUse(id string, limit int) *model.AppError {
	query := s.getQueryBuilder().
		Update("CommandWebhooks").
		Set("UseCount", string("UseCount + 1")).
		Where(sq.Eq{"Id": id}).
		Where(sq.Lt{"UseCount": limit})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql.build_query.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	}

	if sqlResult, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
	} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
		return model.NewAppError("SqlCommandWebhookStore.TryUse", "store.sql_command_webhooks.try_use.invalid.app_error", nil, "id="+id, http.StatusBadRequest)
	}

	return nil
}

func (s SqlCommandWebhookStore) Cleanup() {
	mlog.Debug("Cleaning up command webhook store.")
	exptime := model.GetMillis() - model.COMMAND_WEBHOOK_LIFETIME

	query := s.getQueryBuilder().
		Delete("CommandWebhooks").
		Where(sq.Lt{"CreateAt": exptime})

	queryString, args, err := query.ToSql()
	if err != nil {
		mlog.Error("Failed to build query.")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		mlog.Error("Unable to cleanup command webhook store.")
	}
}
