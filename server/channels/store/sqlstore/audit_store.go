// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlAuditStore struct {
	*SqlStore
}

func newSqlAuditStore(sqlStore *SqlStore) store.AuditStore {
	return &SqlAuditStore{sqlStore}
}

func (s SqlAuditStore) Save(audit *model.Audit) error {
	audit.Id = model.NewId()
	audit.CreateAt = model.GetMillis()

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO Audits
(Id, CreateAt, UserId, Action, ExtraInfo, IpAddress, SessionId)
VALUES
(:Id, :CreateAt, :UserId, :Action, :ExtraInfo, :IpAddress, :SessionId)`, audit); err != nil {
		return errors.Wrapf(err, "failed to save Audit with userId=%s and action=%s", audit.UserId, audit.Action)
	}
	return nil
}

func (s SqlAuditStore) Get(userId string, offset int, limit int) (model.Audits, error) {
	if limit > 1000 {
		return nil, store.NewErrOutOfBounds(limit)
	}

	query := s.getQueryBuilder().
		Select("*").
		From("Audits").
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if userId != "" {
		query = query.Where(sq.Eq{"UserId": userId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "audits_tosql")
	}

	var audits model.Audits
	if err := s.GetReplicaX().Select(&audits, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get Audit list for userId=%s", userId)
	}
	return audits, nil
}

func (s SqlAuditStore) PermanentDeleteByUser(userId string) error {
	if _, err := s.GetMasterX().Exec("DELETE FROM Audits WHERE UserId = ?", userId); err != nil {
		return errors.Wrapf(err, "failed to delete Audit with userId=%s", userId)
	}
	return nil
}

func (s *SqlAuditStore) BatchMergeUserId(toUserId string, fromUserId string) error {
	for {
		var query string
		if s.DriverName() == "postgres" {
			query = "UPDATE Audits SET UserId = ? WHERE Id = any (array (SELECT Id FROM audits WHERE UserId = ? LIMIT 1000))"
		} else {
			query = "UPDATE Audits SET UserId = ? WHERE UserId = ? LIMIT 1000"
		}

		sqlResult, err := s.GetMasterX().Exec(query, toUserId, fromUserId)
		if err != nil {
			return errors.Wrap(err, "failed to update audits")
		}

		rowsAffected, err := sqlResult.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to update audits")
		}

		if rowsAffected < 1000 {
			break
		}
	}

	return nil
}
