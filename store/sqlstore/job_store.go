// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlJobStore struct {
	SqlStore
}

func NewSqlJobStore(sqlStore SqlStore) store.JobStore {
	s := &SqlJobStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Job{}, "Jobs").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Type").SetMaxSize(32)
		table.ColMap("Status").SetMaxSize(32)
		table.ColMap("Data").SetMaxSize(1024)
	}

	return s
}

func (jss SqlJobStore) CreateIndexesIfNotExists() {
	jss.CreateIndexIfNotExists("idx_jobs_type", "Jobs", "Type")
}

func (jss SqlJobStore) Save(job *model.Job) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := jss.GetMaster().Insert(job); err != nil {
			result.Err = model.NewAppError("SqlJobStore.Save", "store.sql_job.save.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = job
		}
	})
}

func (jss SqlJobStore) UpdateOptimistically(job *model.Job, currentStatus string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if sqlResult, err := jss.GetMaster().Exec(
			`UPDATE
				Jobs
			SET
				LastActivityAt = :LastActivityAt,
				Status = :Status,
				Progress = :Progress,
				Data = :Data
			WHERE
				Id = :Id
			AND
				Status = :OldStatus`,
			map[string]interface{}{
				"Id":             job.Id,
				"OldStatus":      currentStatus,
				"LastActivityAt": model.GetMillis(),
				"Status":         job.Status,
				"Data":           job.DataToJson(),
				"Progress":       job.Progress,
			}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.UpdateOptimistically", "store.sql_job.update.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			rows, err := sqlResult.RowsAffected()

			if err != nil {
				result.Err = model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
			} else {
				if rows == 1 {
					result.Data = true
				} else {
					result.Data = false
				}
			}
		}
	})
}

func (jss SqlJobStore) UpdateStatus(id string, status string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		job := &model.Job{
			Id:             id,
			Status:         status,
			LastActivityAt: model.GetMillis(),
		}

		if _, err := jss.GetMaster().UpdateColumns(func(col *gorp.ColumnMap) bool {
			return col.ColumnName == "Status" || col.ColumnName == "LastActivityAt"
		}, job); err != nil {
			result.Err = model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
		}

		if result.Err == nil {
			result.Data = job
		}
	})
}

func (jss SqlJobStore) UpdateStatusOptimistically(id string, currentStatus string, newStatus string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var startAtClause string
		if newStatus == model.JOB_STATUS_IN_PROGRESS {
			startAtClause = `StartAt = :StartAt,`
		}

		if sqlResult, err := jss.GetMaster().Exec(
			`UPDATE
				Jobs
			SET `+startAtClause+`
				Status = :NewStatus,
				LastActivityAt = :LastActivityAt
			WHERE
				Id = :Id
			AND
				Status = :OldStatus`, map[string]interface{}{"Id": id, "OldStatus": currentStatus, "NewStatus": newStatus, "StartAt": model.GetMillis(), "LastActivityAt": model.GetMillis()}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			rows, err := sqlResult.RowsAffected()

			if err != nil {
				result.Err = model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
			} else {
				if rows == 1 {
					result.Data = true
				} else {
					result.Data = false
				}
			}
		}
	})
}

func (jss SqlJobStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var status *model.Job

		if err := jss.GetReplica().SelectOne(&status,
			`SELECT
				*
			FROM
				Jobs
			WHERE
				Id = :Id`, map[string]interface{}{"Id": id}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = status
		}
	})
}

func (jss SqlJobStore) GetAllPage(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var statuses []*model.Job

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				Jobs
			ORDER BY
				CreateAt DESC
			LIMIT
				:Limit
			OFFSET
				:Offset`, map[string]interface{}{"Limit": limit, "Offset": offset}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.GetAllPage", "store.sql_job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = statuses
		}
	})
}

func (jss SqlJobStore) GetAllByType(jobType string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var statuses []*model.Job

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				Jobs
			WHERE
				Type = :Type
			ORDER BY
				CreateAt DESC`, map[string]interface{}{"Type": jobType}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.GetAllByType", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = statuses
		}
	})
}

func (jss SqlJobStore) GetAllByTypePage(jobType string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var statuses []*model.Job

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				Jobs
			WHERE
				Type = :Type
			ORDER BY
				CreateAt DESC
			LIMIT
				:Limit
			OFFSET
				:Offset`, map[string]interface{}{"Type": jobType, "Limit": limit, "Offset": offset}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.GetAllByTypePage", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = statuses
		}
	})
}

func (jss SqlJobStore) GetAllByStatus(status string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var statuses []*model.Job

		if _, err := jss.GetReplica().Select(&statuses,
			`SELECT
				*
			FROM
				Jobs
			WHERE
				Status = :Status
			ORDER BY
				CreateAt ASC`, map[string]interface{}{"Status": status}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.GetAllByStatus", "store.sql_job.get_all.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = statuses
		}
	})
}

func (jss SqlJobStore) GetNewestJobByStatusAndType(status string, jobType string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var job *model.Job

		if err := jss.GetReplica().SelectOne(&job,
			`SELECT
				*
			FROM
				Jobs
			WHERE
				Status = :Status
			AND
				Type = :Type
			ORDER BY
				CreateAt DESC
			LIMIT 1`, map[string]interface{}{"Status": status, "Type": jobType}); err != nil && err != sql.ErrNoRows {
			result.Err = model.NewAppError("SqlJobStore.GetNewestJobByStatusAndType", "store.sql_job.get_newest_job_by_status_and_type.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = job
		}
	})
}

func (jss SqlJobStore) GetCountByStatusAndType(status string, jobType string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := jss.GetReplica().SelectInt(`SELECT
				COUNT(*)
			FROM
				Jobs
			WHERE
				Status = :Status
			AND
				Type = :Type`, map[string]interface{}{"Status": status, "Type": jobType}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.GetCountByStatusAndType", "store.sql_job.get_count_by_status_and_type.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (jss SqlJobStore) Delete(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := jss.GetMaster().Exec(
			`DELETE FROM
				Jobs
			WHERE
				Id = :Id`, map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlJobStore.DeleteByType", "store.sql_job.delete.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = id
		}
	})
}
