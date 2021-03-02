// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlStatusStore struct {
	*SqlStore
}

func newSqlStatusStore(sqlStore *SqlStore) store.StatusStore {
	s := &SqlStatusStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Status{}, "Status").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Status").SetMaxSize(32)
		table.ColMap("ActiveChannel").SetMaxSize(26)
		table.ColMap("PrevStatus").SetMaxSize(32)
	}

	return s
}

func (s SqlStatusStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_status_user_id", "Status", "UserId")
	s.CreateIndexIfNotExists("idx_status_status", "Status", "Status")
}

func (s SqlStatusStore) SaveOrUpdate(status *model.Status) error {
	if err := s.GetReplica().SelectOne(&model.Status{}, "SELECT * FROM Status WHERE UserId = :UserId", map[string]interface{}{"UserId": status.UserId}); err == nil {
		if _, err := s.GetMaster().Update(status); err != nil {
			return errors.Wrap(err, "failed to update Status")
		}
	} else {
		if err := s.GetMaster().Insert(status); err != nil {
			if !(strings.Contains(err.Error(), "for key 'PRIMARY'") && strings.Contains(err.Error(), "Duplicate entry")) {
				return errors.Wrap(err, "failed in save Status")
			}
		}
	}
	return nil
}

func (s SqlStatusStore) Get(userId string) (*model.Status, error) {
	var status model.Status

	if err := s.GetReplica().SelectOne(&status,
		`SELECT
			*
		FROM
			Status
		WHERE
			UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Status", fmt.Sprintf("userId=%s", userId))
		}
		return nil, errors.Wrapf(err, "failed to get Status with userId=%s", userId)
	}
	return &status, nil
}

func (s SqlStatusStore) GetByIds(userIds []string) ([]*model.Status, error) {
	query := s.getQueryBuilder().
		Select("UserId, Status, Manual, LastActivityAt").
		From("Status").
		Where(sq.Eq{"UserId": userIds})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}
	rows, err := s.GetReplica().Db.Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}
	var statuses []*model.Status
	defer rows.Close()
	for rows.Next() {
		var status model.Status
		if err = rows.Scan(&status.UserId, &status.Status, &status.Manual, &status.LastActivityAt); err != nil {
			return nil, errors.Wrap(err, "unable to scan from rows")
		}
		statuses = append(statuses, &status)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed while iterating over rows")
	}

	return statuses, nil
}

// MySql doesn't has support for RETURNING clause or any euivalent so use transaction
func (s SqlStatusStore) updateExpiredStatuses(t *gorp.Transaction) ([]string, error) {
	currUnixTime := time.Now().UTC().Unix()
	selectQuery, selectParams, _ := s.getQueryBuilder().
		Select("UserId").
		From("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.STATUS_DND},
				sq.Gt{"DNDEndTimeUnix": 0},
				sq.LtOrEq{"DNDEndTimeUnix": currUnixTime},
			},
		).ToSql()
	var selectedUsers []string
	_, err := t.Select(&selectedUsers, selectQuery, selectParams...)
	if err != nil {
		return nil, errors.Wrap(err, "getExpiredDNDStatusesT: failed to get expired dnd statuses")
	}
	updateQuery, args, _ := s.getQueryBuilder().
		Update("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.STATUS_DND},
				sq.Gt{"DNDEndTimeUnix": 0},
				sq.LtOrEq{"DNDEndTimeUnix": currUnixTime},
			},
		).
		Set("Status", sq.Expr("PrevStatus")).
		Set("PrevStatus", model.STATUS_DND).
		Set("DNDEndTimeUnix", 0).
		Set("Manual", false).
		ToSql()

	if _, err := t.Exec(updateQuery, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update statuses")
	}
	return selectedUsers, nil
}

func (s SqlStatusStore) UpdateExpiredDNDStatuses() ([]*model.Status, error) {
	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			return nil, errors.Wrap(err, "CreateInitialSidebarCategories: begin_transaction")
		}
		defer finalizeTransaction(transaction)
		userIds, err := s.updateExpiredStatuses(transaction)
		if err != nil {
			return nil, errors.Wrap(err, "CreateInitialSidebarCategories: createInitialSidebarCategoriesT")
		}
		if err := transaction.Commit(); err != nil {
			return nil, errors.Wrap(err, "CreateInitialSidebarCategories: commit_transaction")
		}
		return s.GetByIds(userIds)
	}

	queryString, args, _ := s.getQueryBuilder().
		Update("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.STATUS_DND},
				sq.Gt{"DNDEndTimeUnix": 0},
				sq.LtOrEq{"DNDEndTimeUnix": time.Now().UTC().Unix()},
			},
		).
		Set("Status", sq.Expr("PrevStatus")).
		Set("PrevStatus", model.STATUS_DND).
		Set("DNDEndTimeUnix", 0).
		Set("Manual", false).
		Suffix("RETURNING userId, Status").
		ToSql()

	rows, err := s.GetMaster().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}
	defer rows.Close()
	var statuses []*model.Status
	for rows.Next() {
		var status model.Status
		if err = rows.Scan(&status.UserId, &status.Status); err != nil {
			return nil, errors.Wrap(err, "unable to scan from rows")
		}
		statuses = append(statuses, &status)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed while iterating over rows")
	}

	return statuses, nil
}

func (s SqlStatusStore) ResetAll() error {
	if _, err := s.GetMaster().Exec("UPDATE Status SET Status = :Status WHERE Manual = false", map[string]interface{}{"Status": model.STATUS_OFFLINE}); err != nil {
		return errors.Wrap(err, "failed to update Statuses")
	}
	return nil
}

func (s SqlStatusStore) GetTotalActiveUsersCount() (int64, error) {
	time := model.GetMillis() - (1000 * 60 * 60 * 24)
	count, err := s.GetReplica().SelectInt("SELECT COUNT(UserId) FROM Status WHERE LastActivityAt > :Time", map[string]interface{}{"Time": time})
	if err != nil {
		return count, errors.Wrap(err, "failed to count active users")
	}
	return count, nil
}

func (s SqlStatusStore) UpdateLastActivityAt(userId string, lastActivityAt int64) error {
	if _, err := s.GetMaster().Exec("UPDATE Status SET LastActivityAt = :Time WHERE UserId = :UserId", map[string]interface{}{"UserId": userId, "Time": lastActivityAt}); err != nil {
		return errors.Wrapf(err, "failed to update last activity for userId=%s", userId)
	}

	return nil
}
