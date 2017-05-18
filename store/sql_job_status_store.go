// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/platform/model"
)

type SqlJobStatusStore struct {
	*SqlStore
}

func NewSqlJobStatusStore(sqlStore *SqlStore) JobStatusStore {
	s := &SqlJobStatusStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.JobStatus{}, "JobStatuses").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Type").SetMaxSize(32)
		table.ColMap("Status").SetMaxSize(32)
		table.ColMap("Data").SetMaxSize(1024)
	}

	return s
}

func (jss SqlJobStatusStore) CreateIndexesIfNotExists() {
	jss.CreateIndexIfNotExists("idx_jobstatuses_type", "JobStatuses", "Type")
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
				Id = :Id`, map[string]interface{}{"Id": status.Id}); err == nil {
			if _, err := jss.GetMaster().Update(status); err != nil {
				result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
					"store.sql_job_status.update.app_error", nil, "id="+status.Id+", "+err.Error())
			}
		} else if err == sql.ErrNoRows {
			if err := jss.GetMaster().Insert(status); err != nil {
				result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
					"store.sql_job_status.save.app_error", nil, "id="+status.Id+", "+err.Error())
			}
		} else {
			result.Err = model.NewLocAppError("SqlJobStatusStore.SaveOrUpdate",
				"store.sql_job_status.save_or_update.app_error", nil, "id="+status.Id+", "+err.Error())
		}

		if result.Err == nil {
			result.Data = status
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) Get(id string) StoreChannel {
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
				Id = :Id`, map[string]interface{}{"Id": id}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlJobStatusStore.Get",
					"store.sql_job_status.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlJobStatusStore.Get",
					"store.sql_job_status.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = status
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) GetAllByType(jobType string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var statuses []*model.JobStatus

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				JobStatuses
			WHERE
				Type = :Type`, map[string]interface{}{"Type": jobType}); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.GetAllByType",
				"store.sql_job_status.get_all_by_type.app_error", nil, "Type="+jobType+", "+err.Error())
		} else {
			result.Data = statuses
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) GetAllByTypePage(jobType string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var statuses []*model.JobStatus

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				JobStatuses
			WHERE
				Type = :Type
			ORDER BY
				StartAt ASC
			LIMIT
				:Limit
			OFFSET
				:Offset`, map[string]interface{}{"Type": jobType, "Limit": limit, "Offset": offset}); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.GetAllByTypePage",
				"store.sql_job_status.get_all_by_type_page.app_error", nil, "Type="+jobType+", "+err.Error())
		} else {
			result.Data = statuses
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (jss SqlJobStatusStore) Delete(id string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := jss.GetReplica().Exec(
			`DELETE FROM
				JobStatuses
			WHERE
				Id = :Id`, map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewLocAppError("SqlJobStatusStore.DeleteByType",
				"store.sql_job_status.delete.app_error", nil, "id="+id+", "+err.Error())
		} else {
			result.Data = id
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
