// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

// SqlLicenseStore encapsulates the database writes and reads for
// model.LicenseRecord objects.
type SqlTrueUpReviewStore struct {
	*SqlStore
}

func newSqlTrueUpReviewStore(sqlStore *SqlStore) store.TrueUpReviewStore {
	return &SqlTrueUpReviewStore{sqlStore}
}

func trueUpReviewStatusColumns() []string {
	return []string{
		"DueDate",
		"Completed",
	}
}

func (s *SqlTrueUpReviewStore) GetTrueUpReviewStatus(dueDate int64) (*model.TrueUpReviewStatus, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("TrueUpReviewHistory").
		Where(sq.Eq{"DueDate": dueDate})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_trueUpReviewStatusRecord_tosql")
	}
	var trueUpReviewStatus model.TrueUpReviewStatus
	if err := s.GetReplicaX().Get(&trueUpReviewStatus, queryString, args...); err != nil {
		trueUpReviewStatus.Completed = false
		trueUpReviewStatus.DueDate = dueDate
		return &trueUpReviewStatus, err
	}

	return &trueUpReviewStatus, nil
}

func (s *SqlTrueUpReviewStore) CreateTrueUpReviewStatusRecord(reviewStatus *model.TrueUpReviewStatus) (*model.TrueUpReviewStatus, error) {
	builder := s.getQueryBuilder().Insert("TrueUpReviewHistory").Columns(trueUpReviewStatusColumns()...).Values(reviewStatus.ToSlice()...)
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "create_trueUpReviewStatusRecord_tosql")
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "fail to create true up review status record")
	}

	return reviewStatus, nil
}

func (s *SqlTrueUpReviewStore) Update(reviewStatus *model.TrueUpReviewStatus) (*model.TrueUpReviewStatus, error) {
	query := s.getQueryBuilder().
		Update("TrueUpReviewHistory").
		Set("Completed", reviewStatus.Completed).
		Where(sq.Eq{"DueDate": reviewStatus.DueDate})

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return nil, errors.Wrapf(err, "failed to update true up review status with DueDate=%d", reviewStatus.DueDate)
	}

	return reviewStatus, nil
}
