// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
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

func (s SqlAuditStore) Save(audit *model.Audit) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		audit.Id = model.NewId()
		audit.CreateAt = model.GetMillis()

		if err := s.GetMaster().Insert(audit); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Save",
				"We encounted an error saving the audit", "user_id="+
					audit.UserId+" action="+audit.Action)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlAuditStore) Get(user_id string, limit int) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if limit > 1000 {
			limit = 1000
			result.Err = model.NewAppError("SqlAuditStore.Get", "Limit exceeded for paging", "user_id="+user_id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		var audits model.Audits
		if _, err := s.GetReplica().Select(&audits, "SELECT * FROM Audits WHERE UserId = :user_id ORDER BY CreateAt DESC LIMIT :limit",
			map[string]interface{}{"user_id": user_id, "limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlAuditStore.Get", "We encounted an error finding the audits", "user_id="+user_id)
		} else {
			result.Data = audits
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
