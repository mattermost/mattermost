// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type SqlStatusScheduleStore struct {
	*SqlStore
}

func newSqlStatusScheduleStore(sqlStore *SqlStore) store.StatusScheduleStore {
	s := &SqlStatusScheduleStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.StatusSchedule{}, "StatusSchedule").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
	}

	return s
}

func (s SqlStatusScheduleStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_status_schedule_user_id", "StatusSchedule", "UserId")
}

func (s SqlStatusScheduleStore) SaveOrUpdate(statusSchedule *model.StatusSchedule) error {
	if err := s.GetReplica().SelectOne(&model.StatusSchedule{}, "SELECT * FROM StatusSchedule WHERE UserId = :UserId", map[string]interface{}{"UserId": statusSchedule.UserId}); err == nil {
		if _, err := s.GetMaster().Update(statusSchedule); err != nil {
			return errors.Wrap(err, "failed to update StatusSchedule")
		}
	} else {
		if err := s.GetMaster().Insert(statusSchedule); err != nil {
			if !(strings.Contains(err.Error(), "for key 'PRIMARY'") && strings.Contains(err.Error(), "Duplicate entry")) {
				return errors.Wrap(err, "failed in save StatusSchedule")
			}
		}
	}
	return nil
}

func (s SqlStatusScheduleStore) Get(userId string) (*model.StatusSchedule, error) {
	var statusSchedule model.StatusSchedule

	if err := s.GetReplica().SelectOne(&statusSchedule,
		`SELECT
			*
		FROM
			StatusSchedule
		WHERE
			UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("StatusSchedule", fmt.Sprintf("userId=%s", userId))
		}
		return nil, errors.Wrapf(err, "failed to get StatusSchedule with userId=%s", userId)
	}
	return &statusSchedule, nil
}
