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

	s.statusSelectQuery = s.getQueryBuilder().
		Select(
			"COALESCE(UserId, '') AS UserId",
			"COALESCE(Status, '') AS Status",
			"COALESCE(Manual, FALSE) AS Manual",
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
		Columns("UserId", "Status", "Manual", "LastActivityAt", "DNDEndTime", "PrevStatus").
		Values(st.UserId, st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus)

	query = query.SuffixExpr(sq.Expr("ON CONFLICT (userid) DO UPDATE SET Status = EXCLUDED.Status, Manual = EXCLUDED.Manual, LastActivityAt = EXCLUDED.LastActivityAt, DNDEndTime = EXCLUDED.DNDEndTime, PrevStatus = EXCLUDED.PrevStatus"))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to upsert Status")
	}

	return nil
}

func (s SqlStatusStore) SaveOrUpdateMany(statuses map[string]*model.Status) error {
	if len(statuses) == 0 {
		return nil
	}

	// If there's only one status, use the existing method
	if len(statuses) == 1 {
		for _, st := range statuses {
			return s.SaveOrUpdate(st)
		}
	}

	query := s.getQueryBuilder().
		Insert("Status").
		Columns("UserId", "Status", "Manual", "LastActivityAt", "DNDEndTime", "PrevStatus")

	// Add values for each unique status
	for _, st := range statuses {
		query = query.Values(st.UserId, st.Status, st.Manual, st.LastActivityAt, st.DNDEndTime, st.PrevStatus)
	}

	// Handle upsert for PostgreSQL
	query = query.SuffixExpr(sq.Expr("ON CONFLICT (userid) DO UPDATE SET Status = EXCLUDED.Status, Manual = EXCLUDED.Manual, LastActivityAt = EXCLUDED.LastActivityAt, DNDEndTime = EXCLUDED.DNDEndTime, PrevStatus = EXCLUDED.PrevStatus"))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to upsert multiple Status records")
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

func (s SqlStatusStore) UpdateExpiredDNDStatuses() (_ []*model.Status, err error) {
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
		Set("Manual", false).
		Suffix("RETURNING *")

	statuses := []*model.Status{}
	err = s.GetMaster().SelectBuilder(&statuses, queryString)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Statuses")
	}

	return statuses, nil
}

func (s SqlStatusStore) ResetAll() error {
	if _, err := s.GetMaster().Exec("UPDATE Status SET Status = ? WHERE Manual = false", model.StatusOffline); err != nil {
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
