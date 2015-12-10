// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type SqlAuditStore struct {
	*SqlStore
}

func NewSqlAuditStore(sqlStore *SqlStore) AuditStore {
	s := &SqlAuditStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Audit{}, "Audits").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Action").SetMaxSize(64)
		table.ColMap("ExtraInfo").SetMaxSize(128)
		table.ColMap("IpAddress").SetMaxSize(64)
		table.ColMap("SessionId").SetMaxSize(26)
	}

	return s
}

func (s SqlAuditStore) UpgradeSchemaIfNeeded() {
}

func (s SqlAuditStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_audits_user_id", "Audits", "UserId")
}

func (s SqlAuditStore) Save(audit *model.Audit, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		audit.Id = model.NewId()
		audit.CreateAt = model.GetMillis()

		if err := s.GetMaster().Insert(audit); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Save",
				T("We encounted an error saving the audit"), "user_id="+
					audit.UserId+" action="+audit.Action)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlAuditStore) Get(user_id string, limit int, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if limit > 1000 {
			limit = 1000
			result.Err = model.NewAppError("SqlAuditStore.Get", T("Limit exceeded for paging"), "user_id="+user_id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		var audits model.Audits
		if _, err := s.GetReplica().Select(&audits, "SELECT * FROM Audits WHERE UserId = :user_id ORDER BY CreateAt DESC LIMIT :limit",
			map[string]interface{}{"user_id": user_id, "limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Get", T("We encounted an error finding the audits"), "user_id="+user_id)
		} else {
			result.Data = audits
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlAuditStore) PermanentDeleteByUser(userId string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM Audits WHERE UserId = :userId",
			map[string]interface{}{"userId": userId}); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Delete", "We encountered an error deleting the audits", "user_id="+userId)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
