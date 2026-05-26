// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlNotifyAdminStore struct {
	*SqlStore

	notifyAdminQuery sq.SelectBuilder
}

func newSqlNotifyAdminStore(sqlStore *SqlStore) store.NotifyAdminStore {
	s := &SqlNotifyAdminStore{
		SqlStore: sqlStore,
	}

	s.notifyAdminQuery = s.getQueryBuilder().
		Select(
			"UserId",
			"CreateAt",
			"RequiredPlan",
			"RequiredFeature",
			"Trial",
			"SentAt",
		).
		From("NotifyAdmin")

	return s
}

func (s SqlNotifyAdminStore) insert(data *model.NotifyAdminData) (sql.Result, error) {
	query := `INSERT INTO NotifyAdmin (UserId, CreateAt, RequiredPlan, RequiredFeature, Trial) VALUES (:UserId, :CreateAt, :RequiredPlan, :RequiredFeature, :Trial)`
	return s.GetMaster().NamedExec(query, data)
}

func (s SqlNotifyAdminStore) Save(data *model.NotifyAdminData) (*model.NotifyAdminData, error) {
	if err := data.IsValid(); err != nil {
		return nil, err
	}

	data.PreSave()

	_, err := s.insert(data)
	if err != nil {
		return nil, fmt.Errorf("failed to save Notify Admin data: %w", err)
	}

	return data, nil
}

func (s SqlNotifyAdminStore) GetDataByUserIdAndFeature(userId string, feature model.MattermostFeature) ([]*model.NotifyAdminData, error) {
	data := []*model.NotifyAdminData{}
	query, args, err := s.notifyAdminQuery.
		Where(sq.Eq{"UserId": userId, "RequiredFeature": feature}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("could not build sql query to get all notification data by user id and required feature: %w", err)
	}

	if err := s.GetReplica().Select(&data, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("NotifyAdmin", fmt.Sprintf("user id: %s and required feature: %s", userId, feature))
		}
		return nil, fmt.Errorf("notifcation data by user id: %s and required feature: %s: %w", userId, feature, err)
	}
	return data, nil
}

func (s SqlNotifyAdminStore) Get(trial bool) ([]*model.NotifyAdminData, error) {
	data := []*model.NotifyAdminData{}
	query, args, err := s.notifyAdminQuery.
		Where(sq.Eq{"Trial": trial}).
		Where("(SentAt IS NULL)").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("could not build sql query to get all notifcation data: %w", err)
	}

	if err := s.GetReplica().Select(&data, query, args...); err != nil {
		return nil, fmt.Errorf("notifcation data: %w", err)
	}
	return data, nil
}

func (s SqlNotifyAdminStore) DeleteBefore(trial bool, now int64) error {
	if _, err := s.GetMaster().Exec("DELETE FROM NotifyAdmin WHERE Trial = ? AND CreateAt < ? AND SentAt IS NULL", trial, now); err != nil {
		return fmt.Errorf("failed to remove all notification data with trial=%t: %w", trial, err)
	}
	return nil
}

func (s SqlNotifyAdminStore) Update(userId string, requiredPlan string, requiredFeature model.MattermostFeature, now int64) error {
	if _, err := s.GetMaster().Exec("UPDATE NotifyAdmin SET SentAt = ? WHERE UserId = ? AND RequiredPlan = ? AND RequiredFeature = ?", now, userId, requiredPlan, requiredFeature); err != nil {
		return fmt.Errorf("failed to update SentAt for userId=%s and requiredPlan=%s: %w", userId, requiredPlan, err)
	}
	return nil
}
