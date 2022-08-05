// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type SqlNotifyAdminStore struct {
	*SqlStore
}

func newSqlNotifyAdminStore(sqlStore *SqlStore) store.NotifyAdminStore {
	return &SqlNotifyAdminStore{sqlStore}
}

func (us SqlNotifyAdminStore) insert(data *model.NotifyAdminData) (sql.Result, error) {
	query := `INSERT INTO NotifyAdmin (Id, UserId, CreateAt, RequiredPlan, RequiredFeature, Trial) VALUES (:Id, :UserId, :CreateAt, :RequiredPlan, :RequiredFeature, :Trial)`
	return us.GetMasterX().NamedExec(query, data)
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
