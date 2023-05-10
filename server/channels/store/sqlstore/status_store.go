// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

type SqlStatusStore struct {
	*SqlStore
}

func newSqlStatusStore(sqlStore *SqlStore) store.StatusStore {
	return &SqlStatusStore{sqlStore}
}

func (s SqlStatusStore) SaveOrUpdate(st *model.Status) error {
	query := s.getQueryBuilder().
		Insert("Status").
		Columns("UserId", "Status", "Manual", "LastActivityAt", "DNDEndTime", "PrevStatus").
		Values(st.UserId, st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE Status = ?, Manual = ?, LastActivityAt = ?, DNDEndTime = ?, PrevStatus = ?",
			st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (userid) DO UPDATE SET Status = ?, Manual = ?, LastActivityAt = ?, DNDEndTime = ?, PrevStatus = ?",
			st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus))
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "status_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to upsert Status")
	}

	return nil
}

func (s SqlStatusStore) Get(userId string) (*model.Status, error) {
	var status model.Status

	if err := s.GetReplicaX().Get(&status, "SELECT * FROM Status WHERE UserId = ?", userId); err != nil {
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
	rows, err := s.GetReplicaX().DB.Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}
	statuses := []*model.Status{}
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

// MySQL doesn't have support for RETURNING clause, so we use a transaction to get the updated rows.
func (s SqlStatusStore) updateExpiredStatuses(t *sqlxTxWrapper) ([]*model.Status, error) {
	statuses := []*model.Status{}
	currUnixTime := time.Now().UTC().Unix()
	selectQuery, selectParams, err := s.getQueryBuilder().
		Select("*").
		From("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.StatusDnd},
				sq.Gt{"DNDEndTime": 0},
				sq.LtOrEq{"DNDEndTime": currUnixTime},
			},
		).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}
	err = t.Select(&statuses, selectQuery, selectParams...)
	if err != nil {
		return nil, errors.Wrap(err, "updateExpiredStatusesT: failed to get expired dnd statuses")
	}
	updateQuery, args, err := s.getQueryBuilder().
		Update("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.StatusDnd},
				sq.Gt{"DNDEndTime": 0},
				sq.LtOrEq{"DNDEndTime": currUnixTime},
			},
		).
		Set("Status", sq.Expr("PrevStatus")).
		Set("PrevStatus", model.StatusDnd).
		Set("DNDEndTime", 0).
		Set("Manual", false).
		ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}

	if _, err := t.Exec(updateQuery, args...); err != nil {
		return nil, errors.Wrapf(err, "updateExpiredStatusesT: failed to update statuses")
	}

	return statuses, nil
}

func (s SqlStatusStore) UpdateExpiredDNDStatuses() (_ []*model.Status, err error) {
	if s.DriverName() == model.DatabaseDriverMysql {
		transaction, terr := s.GetMasterX().Beginx()
		if terr != nil {
			return nil, errors.Wrap(terr, "UpdateExpiredDNDStatuses: begin_transaction")
		}
		defer finalizeTransactionX(transaction, &terr)
		statuses, terr := s.updateExpiredStatuses(transaction)
		if terr != nil {
			return nil, errors.Wrap(terr, "UpdateExpiredDNDStatuses: updateExpiredDNDStatusesT")
		}
		if terr = transaction.Commit(); terr != nil {
			return nil, errors.Wrap(terr, "UpdateExpiredDNDStatuses: commit_transaction")
		}

		for _, status := range statuses {
			status.Status = status.PrevStatus
			status.PrevStatus = model.StatusDnd
			status.DNDEndTime = 0
			status.Manual = false
		}

		return statuses, nil
	}

	queryString, args, err := s.getQueryBuilder().
		Update("Status").
		Where(
			sq.And{
				sq.Eq{"Status": model.StatusDnd},
				sq.Gt{"DNDEndTime": 0},
				sq.LtOrEq{"DNDEndTime": time.Now().UTC().Unix()},
			},
		).
		Set("Status", sq.Expr("PrevStatus")).
		Set("PrevStatus", model.StatusDnd).
		Set("DNDEndTime", 0).
		Set("Manual", false).
		Suffix("RETURNING *").
		ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "status_tosql")
	}

	rows, err := s.GetMasterX().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}
	defer rows.Close()
	statuses := []*model.Status{}
	for rows.Next() {
		var status model.Status
		if err = rows.Scan(&status.UserId, &status.Status, &status.Manual, &status.LastActivityAt,
			&status.DNDEndTime, &status.PrevStatus); err != nil {
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
	if _, err := s.GetMasterX().Exec("UPDATE Status SET Status = ? WHERE Manual = false", model.StatusOffline); err != nil {
		return errors.Wrap(err, "failed to update Statuses")
	}
	return nil
}

func (s SqlStatusStore) GetTotalActiveUsersCount() (int64, error) {
	time := model.GetMillis() - (1000 * 60 * 60 * 24)
	var count int64
	err := s.GetReplicaX().Get(&count, "SELECT COUNT(UserId) FROM Status WHERE LastActivityAt > ?", time)
	if err != nil {
		return count, errors.Wrap(err, "failed to count active users")
	}
	return count, nil
}

func (s SqlStatusStore) UpdateLastActivityAt(userId string, lastActivityAt int64) error {
	if _, err := s.GetMasterX().Exec("UPDATE Status SET LastActivityAt = ? WHERE UserId = ?", lastActivityAt, userId); err != nil {
		return errors.Wrapf(err, "failed to update last activity for userId=%s", userId)
	}

	return nil
}
