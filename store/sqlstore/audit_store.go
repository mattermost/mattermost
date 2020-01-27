// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlAuditStore struct {
	SqlStore
}

func NewSqlAuditStore(sqlStore SqlStore) store.AuditStore {
	s := &SqlAuditStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Audit{}, "Audits").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Action").SetMaxSize(512)
		table.ColMap("ExtraInfo").SetMaxSize(1024)
		table.ColMap("IpAddress").SetMaxSize(64)
		table.ColMap("SessionId").SetMaxSize(26)
	}

	return s
}

func (s SqlAuditStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_audits_user_id", "Audits", "UserId")
}

func (s SqlAuditStore) Save(audit *model.Audit) *model.AppError {
	audit.Id = model.NewId()
	audit.CreateAt = model.GetMillis()

	if err := s.GetMaster().Insert(audit); err != nil {
		return model.NewAppError("SqlAuditStore.Save", "store.sql_audit.save.saving.app_error", nil, "user_id="+audit.UserId+" action="+audit.Action, http.StatusInternalServerError)
	}
	return nil
}

func (s SqlAuditStore) Get(user_id string, offset int, limit int) (model.Audits, *model.AppError) {
	if limit > 1000 {
		return nil, model.NewAppError("SqlAuditStore.Get", "store.sql_audit.get.limit.app_error", nil, "user_id="+user_id, http.StatusBadRequest)
	}

	query := "SELECT * FROM Audits"

	if len(user_id) != 0 {
		query += " WHERE UserId = :user_id"
	}

	query += " ORDER BY CreateAt DESC LIMIT :limit OFFSET :offset"

	var audits model.Audits
	if _, err := s.GetReplica().Select(&audits, query, map[string]interface{}{"user_id": user_id, "limit": limit, "offset": offset}); err != nil {
		return nil, model.NewAppError("SqlAuditStore.Get", "store.sql_audit.get.finding.app_error", nil, "user_id="+user_id, http.StatusInternalServerError)
	}
	return audits, nil
}

func (s SqlAuditStore) PermanentDeleteByUser(userId string) *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM Audits WHERE UserId = :userId",
		map[string]interface{}{"userId": userId}); err != nil {
		return model.NewAppError("SqlAuditStore.Delete", "store.sql_audit.permanent_delete_by_user.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}
	return nil
}
