// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlStatusStore struct {
	*SqlStore

	statusSelectQuery sq.SelectBuilder
}

func newSqlStatusStore(sqlStore *SqlStore) store.StatusStore {
	s := SqlStatusStore{
		SqlStore: sqlStore,
	}

	manualColumnName := quoteColumnName(s.DriverName(), "Manual")
	s.statusSelectQuery = s.getQueryBuilder().
		Select(
			"COALESCE(UserId, '') AS UserId",
			"COALESCE(Status, '') AS Status",
			fmt.Sprintf("COALESCE(%s, FALSE) AS %s", manualColumnName, manualColumnName),
			"COALESCE(LastActivityAt, 0) AS LastActivityAt",
			"COALESCE(DNDEndTime, 0) AS DNDEndTime",
			"COALESCE(PrevStatus, '') AS PrevStatus",
		).
		From("Status")

	return &s
}

func (s SqlStatusStore) SaveOrUpdate(st *model.Status) error {
	query := s.getQueryBuilder().
		Insert("Status").
		Columns("UserId", "Status", quoteColumnName(s.DriverName(), "Manual"), "LastActivityAt", "DNDEndTime", "PrevStatus").
		Values(st.UserId, st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE Status = ?, `Manual` = ?, LastActivityAt = ?, DNDEndTime = ?, PrevStatus = ?",
			st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (userid) DO UPDATE SET Status = ?, Manual = ?, LastActivityAt = ?, DNDEndTime = ?, PrevStatus = ?",
			st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus))
	}

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to upsert Status")
	}

	return nil
}

func (s SqlStatusStore) Get(userId string) (*model.Status, error) {
	query := s.statusSelectQuery.Where(sq.Eq{"UserId": userId})

	var status model.Status
	if err := s.GetReplica().GetBuilder(&status, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Status", fmt.Sprintf("userId=%s", userId))
		}
		return nil, errors.Wrapf(err, "failed to get Status with userId=%s", userId)
	}
	return &status, nil
}

func (s SqlStatusStore) GetByIds(userIds []string) ([]*model.Status, error) {
	query := s.statusSelectQuery.Where(sq.Eq{"UserId": userIds})

	statuses := []*model.Status{}
	err := s.GetReplica().SelectBuilder(&statuses, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}

	return statuses, nil
}

// MySQL doesn't have support for RETURNING clause, so we use a transaction to get the updated rows.
func (s SqlStatusStore) updateExpiredStatuses(t *sqlxTxWrapper) ([]*model.Status, error) {
	statuses := []*model.Status{}
	currUnixTime := time.Now().UTC().Unix()
	selectQuery := s.statusSelectQuery.Where(
		sq.And{
			sq.Eq{"Status": model.StatusDnd},
			sq.Gt{"DNDEndTime": 0},
			sq.LtOrEq{"DNDEndTime": currUnixTime},
		},
	)

	err := t.SelectBuilder(&statuses, selectQuery)
	if err != nil {
		return nil, errors.Wrap(err, "updateExpiredStatusesT: failed to get expired dnd statuses")
	}
	updateQuery := s.getQueryBuilder().
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
		Set(quoteColumnName(s.DriverName(), "Manual"), false)

	if _, err := t.ExecBuilder(updateQuery); err != nil {
		return nil, errors.Wrapf(err, "updateExpiredStatusesT: failed to update statuses")
	}

	return statuses, nil
}

func (s SqlStatusStore) UpdateExpiredDNDStatuses() (_ []*model.Status, err error) {
	if s.DriverName() == model.DatabaseDriverMysql {
		transaction, terr := s.GetMaster().Beginx()
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

	queryString := s.getQueryBuilder().
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
		Set(quoteColumnName(s.DriverName(), "Manual"), false).
		Suffix("RETURNING *")

	statuses := []*model.Status{}
	err = s.GetMaster().SelectBuilder(&statuses, queryString)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}

	return statuses, nil
}

func (s SqlStatusStore) ResetAll() error {
	if _, err := s.GetMaster().Exec(fmt.Sprintf("UPDATE Status SET Status = ? WHERE %s = false", quoteColumnName(s.DriverName(), "Manual")), model.StatusOffline); err != nil {
		return errors.Wrap(err, "failed to update Statuses")
	}
	return nil
}

func (s SqlStatusStore) GetTotalActiveUsersCount() (int64, error) {
	time := model.GetMillis() - (1000 * 60 * 60 * 24)
	query := s.getQueryBuilder().
		Select("COUNT(UserId)").
		From("Status").
		Where(sq.Gt{"LastActivityAt": time})

	var count int64
	err := s.GetReplica().GetBuilder(&count, query)
	if err != nil {
		return count, errors.Wrap(err, "failed to count active users")
	}
	return count, nil
}

func (s SqlStatusStore) UpdateLastActivityAt(userId string, lastActivityAt int64) error {
	builder := s.getQueryBuilder().
		Update("Status").
		Set("LastActivityAt", lastActivityAt).
		Where(sq.Eq{"UserId": userId})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to update last activity for userId=%s", userId)
	}

	return nil
}
