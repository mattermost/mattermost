// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
)

type SqlNotifyAdminStore struct {
	*SqlStore
}

func newSqlNotifyAdminStore(sqlStore *SqlStore) store.NotifyAdminStore {
	return &SqlNotifyAdminStore{sqlStore}
}

func (s SqlNotifyAdminStore) insert(data *model.NotifyAdminData) (sql.Result, error) {
	query := `INSERT INTO NotifyAdmin (UserId, CreateAt, RequiredPlan, RequiredFeature, Trial) VALUES (:UserId, :CreateAt, :RequiredPlan, :RequiredFeature, :Trial)`
	return s.GetMasterX().NamedExec(query, data)
}

func (s SqlNotifyAdminStore) Save(data *model.NotifyAdminData) (*model.NotifyAdminData, error) {
	if err := data.IsValid(); err != nil {
		return nil, err
	}

	data.PreSave()

	_, err := s.insert(data)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save Notify Admin data")
	}

	return data, nil
}

func (s SqlNotifyAdminStore) GetDataByUserIdAndFeature(userId string, feature model.MattermostFeature) ([]*model.NotifyAdminData, error) {
	data := []*model.NotifyAdminData{}
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("NotifyAdmin").
		Where(sq.Eq{"UserId": userId, "RequiredFeature": feature}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "could not build sql query to get all notification data by user id and required feature")
	}

	if err := s.GetReplicaX().Select(&data, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("NotifyAdmin", fmt.Sprintf("user id: %s and required feature: %s", userId, feature))
		}
		return nil, errors.Wrapf(err, "notifcation data by user id: %s and required feature: %s", userId, feature)
	}
	return data, nil
}

func (s SqlNotifyAdminStore) Get(trial bool) ([]*model.NotifyAdminData, error) {
	data := []*model.NotifyAdminData{}
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("NotifyAdmin").
		Where(sq.Eq{"Trial": trial}).
		Where("(SentAt IS NULL)").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "could not build sql query to get all notifcation data")
	}

	if err := s.GetReplicaX().Select(&data, query, args...); err != nil {
		return nil, errors.Wrap(err, "notifcation data")
	}
	return data, nil
}

func (s SqlNotifyAdminStore) DeleteBefore(trial bool, now int64) error {
	if _, err := s.GetMasterX().Exec("DELETE FROM NotifyAdmin WHERE Trial = ? AND CreateAt < ? AND SentAt IS NULL", trial, now); err != nil {
		return errors.Wrapf(err, "failed to remove all notification data with trial=%t", trial)
	}
	return nil
}

func (s SqlNotifyAdminStore) Update(userId string, requiredPlan string, requiredFeature model.MattermostFeature, now int64) error {
	if _, err := s.GetMasterX().Exec("UPDATE NotifyAdmin SET SentAt = ? WHERE UserId = ? AND RequiredPlan = ? AND RequiredFeature = ?", now, userId, requiredPlan, requiredFeature); err != nil {
		return errors.Wrapf(err, "failed to update SentAt for userId=%s and requiredPlan=%s", userId, requiredPlan)
	}
	return nil
}
