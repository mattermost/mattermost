// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlAuditStore struct {
	*SqlStore

	auditQuery sq.SelectBuilder
}

func newSqlAuditStore(sqlStore *SqlStore) store.AuditStore {
	s := &SqlAuditStore{
		SqlStore: sqlStore,
	}

	s.auditQuery = s.getQueryBuilder().
		Select(
			"Id",
			"CreateAt",
			"UserId",
			"Action",
			"ExtraInfo",
			"IpAddress",
			"SessionId",
		).
		From("Audits")

	return s
}

func (s SqlAuditStore) Save(audit *model.Audit) error {
	audit.Id = model.NewId()
	audit.CreateAt = model.GetMillis()

	if _, err := s.GetMaster().NamedExec(`INSERT INTO Audits
(Id, CreateAt, UserId, Action, ExtraInfo, IpAddress, SessionId)
VALUES
(:Id, :CreateAt, :UserId, :Action, :ExtraInfo, :IpAddress, :SessionId)`, audit); err != nil {
		return fmt.Errorf("failed to save Audit with userId=%s and action=%s: %w", audit.UserId, audit.Action, err)
	}
	return nil
}

func (s SqlAuditStore) Get(userId string, offset int, limit int) (model.Audits, error) {
	if limit > 1000 {
		return nil, store.NewErrOutOfBounds(limit)
	}

	query := s.auditQuery.
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if userId != "" {
		query = query.Where(sq.Eq{"UserId": userId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("audits_tosql: %w", err)
	}

	var audits model.Audits
	if err := s.GetReplica().Select(&audits, queryString, args...); err != nil {
		return nil, fmt.Errorf("failed to get Audit list for userId=%s: %w", userId, err)
	}
	return audits, nil
}

func (s SqlAuditStore) PermanentDeleteByUser(userId string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Audits WHERE UserId = ?", userId); err != nil {
		return fmt.Errorf("failed to delete Audit with userId=%s: %w", userId, err)
	}
	return nil
}
