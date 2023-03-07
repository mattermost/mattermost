// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
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
