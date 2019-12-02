// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	MISSING_STATUS_ERROR = "store.sql_status.get.missing.app_error"
)

type SqlStatusStore struct {
	SqlStore
}

func NewSqlStatusStore(sqlStore SqlStore) store.StatusStore {
	s := &SqlStatusStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Status{}, "Status").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Status").SetMaxSize(32)
		table.ColMap("ActiveChannel").SetMaxSize(26)
	}

	return s
}

func (s SqlStatusStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_status_user_id", "Status", "UserId")
	s.CreateIndexIfNotExists("idx_status_status", "Status", "Status")
}

func (s SqlStatusStore) SaveOrUpdate(status *model.Status) *model.AppError {
	if err := s.GetReplica().SelectOne(&model.Status{}, "SELECT * FROM Status WHERE UserId = :UserId", map[string]interface{}{"UserId": status.UserId}); err == nil {
		if _, err := s.GetMaster().Update(status); err != nil {
			return model.NewAppError("SqlStatusStore.SaveOrUpdate", "store.sql_status.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		if err := s.GetMaster().Insert(status); err != nil {
			if !(strings.Contains(err.Error(), "for key 'PRIMARY'") && strings.Contains(err.Error(), "Duplicate entry")) {
				return model.NewAppError("SqlStatusStore.SaveOrUpdate", "store.sql_status.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}
	return nil
}

func (s SqlStatusStore) Get(userId string) (*model.Status, *model.AppError) {
	var status model.Status

	if err := s.GetReplica().SelectOne(&status,
		`SELECT
			*
		FROM
			Status
		WHERE
			UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlStatusStore.Get", MISSING_STATUS_ERROR, nil, err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlStatusStore.Get", "store.sql_status.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return &status, nil
}

func (s SqlStatusStore) GetByIds(userIds []string) ([]*model.Status, *model.AppError) {
	props := make(map[string]interface{})
	idQuery := ""

	for index, userId := range userIds {
		if len(idQuery) > 0 {
			idQuery += ", "
		}

		props["userId"+strconv.Itoa(index)] = userId
		idQuery += ":userId" + strconv.Itoa(index)
	}

	var statuses []*model.Status
	if _, err := s.GetReplica().Select(&statuses, "SELECT * FROM Status WHERE UserId IN ("+idQuery+")", props); err != nil {
		return nil, model.NewAppError("SqlStatusStore.GetByIds", "store.sql_status.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (s SqlStatusStore) ResetAll() *model.AppError {
	if _, err := s.GetMaster().Exec("UPDATE Status SET Status = :Status WHERE Manual = false", map[string]interface{}{"Status": model.STATUS_OFFLINE}); err != nil {
		return model.NewAppError("SqlStatusStore.ResetAll", "store.sql_status.reset_all.app_error", nil, "", http.StatusInternalServerError)
	}
	return nil
}

func (s SqlStatusStore) GetTotalActiveUsersCount() (int64, *model.AppError) {
	time := model.GetMillis() - (1000 * 60 * 60 * 24)
	count, err := s.GetReplica().SelectInt("SELECT COUNT(UserId) FROM Status WHERE LastActivityAt > :Time", map[string]interface{}{"Time": time})
	if err != nil {
		return count, model.NewAppError("SqlStatusStore.GetTotalActiveUsersCount", "store.sql_status.get_total_active_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (s SqlStatusStore) UpdateLastActivityAt(userId string, lastActivityAt int64) *model.AppError {
	if _, err := s.GetMaster().Exec("UPDATE Status SET LastActivityAt = :Time WHERE UserId = :UserId", map[string]interface{}{"UserId": userId, "Time": lastActivityAt}); err != nil {
		return model.NewAppError("SqlStatusStore.UpdateLastActivityAt", "store.sql_status.update_last_activity_at.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}
