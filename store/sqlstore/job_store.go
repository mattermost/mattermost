// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func (jss SqlJobStore) Save(job *model.Job) (*model.Job, *model.AppError) {
	if err := jss.GetMaster().Insert(job); err != nil {
		return nil, model.NewAppError("SqlJobStore.Save", "store.sql_job.save.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	return job, nil
}

func (jss SqlJobStore) UpdateOptimistically(job *model.Job, currentStatus string) (bool, *model.AppError) {
	query := "UPDATE Jobs SET LastActivityAt = :LastActivityAt, Status = :Status, Progress = :Progress, Data = :Data WHERE Id = :Id AND Status = :OldStatus"
	params := map[string]interface{}{
		"Id":             job.Id,
		"OldStatus":      currentStatus,
		"LastActivityAt": model.GetMillis(),
		"Status":         job.Status,
		"Data":           job.DataToJson(),
		"Progress":       job.Progress,
	}
	sqlResult, err := jss.GetMaster().Exec(query, params)
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateOptimistically", "store.sql_job.update.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	rows, err := sqlResult.RowsAffected()

	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	if rows != 1 {
		return false, nil
	}

	return true, nil
}

func (jss SqlJobStore) UpdateStatus(id string, status string) (*model.Job, *model.AppError) {
	job := &model.Job{
		Id:             id,
		Status:         status,
		LastActivityAt: model.GetMillis(),
	}

	if _, err := jss.GetMaster().UpdateColumns(func(col *gorp.ColumnMap) bool {
		return col.ColumnName == "Status" || col.ColumnName == "LastActivityAt"
	}, job); err != nil {
		return nil, model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}

	return job, nil
}

func (jss SqlJobStore) UpdateStatusOptimistically(id string, currentStatus string, newStatus string) (bool, *model.AppError) {
	var startAtClause string
	if newStatus == model.JOB_STATUS_IN_PROGRESS {
		startAtClause = "StartAt = :StartAt,"
	}
	query := "UPDATE Jobs SET " + startAtClause + " Status = :NewStatus, LastActivityAt = :LastActivityAt WHERE Id = :Id AND Status = :OldStatus"
	params := map[string]interface{}{
		"Id":             id,
		"OldStatus":      currentStatus,
		"NewStatus":      newStatus,
		"StartAt":        model.GetMillis(),
		"LastActivityAt": model.GetMillis(),
	}

	sqlResult, err := jss.GetMaster().Exec(query, params)
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	rows, err := sqlResult.RowsAffected()
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateStatus", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	if rows != 1 {
		return false, nil
	}

	return true, nil
}

func (jss SqlJobStore) Get(id string) (*model.Job, *model.AppError) {
	query := "SELECT * FROM Jobs WHERE Id = :Id"

	var status *model.Job
	if err := jss.GetReplica().SelectOne(&status, query, map[string]interface{}{"Id": id}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	return status, nil
}

func (jss SqlJobStore) GetAllPage(offset int, limit int) ([]*model.Job, *model.AppError) {
	query := "SELECT * FROM Jobs ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset"

	var statuses []*model.Job
	if _, err := jss.GetReplica().Select(&statuses, query, map[string]interface{}{"Limit": limit, "Offset": offset}); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllPage", "store.sql_job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByType(jobType string) ([]*model.Job, *model.AppError) {
	query := "SELECT * FROM Jobs WHERE Type = :Type ORDER BY CreateAt DESC"
	var statuses []*model.Job
	if _, err := jss.GetReplica().Select(&statuses, query, map[string]interface{}{"Type": jobType}); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByType", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypePage(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	query := "SELECT * FROM Jobs WHERE Type = :Type ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset"

	var statuses []*model.Job
	if _, err := jss.GetReplica().Select(&statuses, query, map[string]interface{}{"Type": jobType, "Limit": limit, "Offset": offset}); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByTypePage", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByStatus(status string) ([]*model.Job, *model.AppError) {
	var statuses []*model.Job
	query := "SELECT * FROM Jobs WHERE Status = :Status ORDER BY CreateAt ASC"

	if _, err := jss.GetReplica().Select(&statuses, query, map[string]interface{}{"Status": status}); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByStatus", "store.sql_job.get_all.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetNewestJobByStatusAndType(status string, jobType string) (*model.Job, *model.AppError) {
	query := "SELECT * FROM Jobs WHERE Status = :Status AND Type = :Type ORDER BY CreateAt DESC LIMIT 1"

	var job *model.Job
	if err := jss.GetReplica().SelectOne(&job, query, map[string]interface{}{"Status": status, "Type": jobType}); err != nil && err != sql.ErrNoRows {
		return nil, model.NewAppError("SqlJobStore.GetNewestJobByStatusAndType", "store.sql_job.get_newest_job_by_status_and_type.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
	}
	return job, nil
}

func (jss SqlJobStore) GetCountByStatusAndType(status string, jobType string) (int64, *model.AppError) {
	query := "SELECT COUNT(*) FROM Jobs WHERE Status = :Status AND Type = :Type"
	count, err := jss.GetReplica().SelectInt(query, map[string]interface{}{"Status": status, "Type": jobType})
	if err != nil {
		return int64(0), model.NewAppError("SqlJobStore.GetCountByStatusAndType", "store.sql_job.get_count_by_status_and_type.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (jss SqlJobStore) Delete(id string) (string, *model.AppError) {
	query := "DELETE FROM Jobs WHERE Id = :Id"
	if _, err := jss.GetMaster().Exec(query, map[string]interface{}{"Id": id}); err != nil {
		return "", model.NewAppError("SqlJobStore.DeleteByType", "store.sql_job.delete.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	return id, nil
}
