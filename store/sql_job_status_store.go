// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"database/sql"

	"github.com/mattermost/platform/model"
)

type SqlJobStatusStore struct {
	*SqlStore
}

func NewSqlJobStatusStore(sqlStore *SqlStore) JobStatusStore {
	s := &SqlJobStatusStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.JobStatus{}, "JobStatuses").SetKeys(false, "Type")
		table.ColMap("Type").SetMaxSize(32)
		table.ColMap("Progress").SetMaxSize(1024)
	}

	return s
}

func (jss SqlJobStatusStore) CreateIndexesIfNotExists() {
	jss.CreateIndexIfNotExists("idx_jobstatus_type", "JobStatuses", "Type")
}

func (jss SqlJobStatusStore) SaveOrUpdate(status *model.JobStatus) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if err := jss.GetReplica().SelectOne(&model.JobStatus{},
			`SELECT
				*
			FROM
				JobStatuses
			WHERE
				Type = :Type`, map[string]interface{}{"Type": status.Type}); err == nil {
			if _, err := jss.GetMaster().Update(status); err != nil {
				result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
					"store.sql_job_status.update.app_error", nil, "type="+status.Type+", "+err.Error())
			}
		} else if err == sql.ErrNoRows {
			if err := jss.GetMaster().Insert(status); err != nil {
				result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
					"store.sql_job_status.save.app_error", nil, "type="+status.Type+", "+err.Error())
			}
		} else {
			result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
				"store.sql_job_status.save_or_update.app_error", nil, "type="+status.Type+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) Get(jobType string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var status *model.JobStatus

		if err := jss.GetReplica().SelectOne(&status,
			`SELECT
				*
			FROM
				JobStatuses
			WHERE
				Type = :Type`, map[string]interface{}{"Type": jobType}); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.Get", "store.sql_job_status.get.app_error", nil, "type="+jobType+", "+err.Error())
		} else {
			result.Data = status
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) GetAll() StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var statuses []*model.JobStatus

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				JobStatuses`); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.GetAll", "store.sql_job_status.get_all.app_error", nil, "")
		} else {
			result.Data = statuses
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) DeleteByType(jobType string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := jss.GetReplica().Exec(
			`DELETE FROM
				JobStatuses
			WHERE
				Type = :Type`, map[string]interface{}{"Type": jobType}); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.DeleteByType",
				"store.sql_job_status.delete_by_type.app_error", nil, "type="+jobType+", "+err.Error())
		} else {
			result.Data = jobType
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
