// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
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

func (s SqlAuditStore) Save(audit *model.Audit) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		audit.Id = model.NewId()
		audit.CreateAt = model.GetMillis()

		if err := s.GetMaster().Insert(audit); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Save", "store.sql_audit.save.saving.app_error", nil, "user_id="+audit.UserId+" action="+audit.Action, http.StatusInternalServerError)
		}
	})
}

func (s SqlAuditStore) Get(user_id string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if limit > 1000 {
			limit = 1000
			result.Err = model.NewAppError("SqlAuditStore.Get", "store.sql_audit.get.limit.app_error", nil, "user_id="+user_id, http.StatusBadRequest)
			return
		}

		query := "SELECT * FROM Audits"

		if len(user_id) != 0 {
			query += " WHERE UserId = :user_id"
		}

		query += " ORDER BY CreateAt DESC LIMIT :limit OFFSET :offset"

		var audits model.Audits
		if _, err := s.GetReplica().Select(&audits, query, map[string]interface{}{"user_id": user_id, "limit": limit, "offset": offset}); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Get", "store.sql_audit.get.finding.app_error", nil, "user_id="+user_id, http.StatusInternalServerError)
		} else {
			result.Data = audits
		}
	})
}

func (s SqlAuditStore) PermanentDeleteByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Audits WHERE UserId = :userId",
			map[string]interface{}{"userId": userId}); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Delete", "store.sql_audit.permanent_delete_by_user.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
		}
	})
}

func (s SqlAuditStore) PermanentDeleteBatch(endTime int64, limit int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var query string
		if s.DriverName() == "postgres" {
			query = "DELETE from Audits WHERE Id = any (array (SELECT Id FROM Audits WHERE CreateAt < :EndTime LIMIT :Limit))"
		} else {
			query = "DELETE from Audits WHERE CreateAt < :EndTime LIMIT :Limit"
		}

		sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlAuditStore.PermanentDeleteBatch", "store.sql_audit.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
		} else {
			rowsAffected, err1 := sqlResult.RowsAffected()
			if err1 != nil {
				result.Err = model.NewAppError("SqlAuditStore.PermanentDeleteBatch", "store.sql_audit.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}
