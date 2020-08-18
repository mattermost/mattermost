// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"
	"strings"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlJobStore struct {
	SqlStore
}

func newSqlJobStore(sqlStore SqlStore) store.JobStore {
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

func (jss SqlJobStore) createIndexesIfNotExists() {
	jss.CreateIndexIfNotExists("idx_jobs_type", "Jobs", "Type")
}

func (jss SqlJobStore) Save(job *model.Job) (*model.Job, *model.AppError) {
	if err := jss.GetMaster().Insert(job); err != nil {
		return nil, model.NewAppError("SqlJobStore.Save", "store.sql_job.save.app_error", nil, "id="+job.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	return job, nil
}

func (jss SqlJobStore) UpdateOptimistically(job *model.Job, currentStatus string) (bool, *model.AppError) {
	sql, args, err := jss.getQueryBuilder().
		Update("Jobs").
		Set("LastActivityAt", model.GetMillis()).
		Set("Status", job.Status).
		Set("Data", job.DataToJson()).
		Set("Progress", job.Progress).
		Where(sq.Eq{"Id": job.Id, "Status": currentStatus}).ToSql()
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateOptimistically", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	sqlResult, err := jss.GetMaster().Exec(sql, args...)
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
	sql := jss.getQueryBuilder().
		Update("Jobs").
		Set("LastActivityAt", model.GetMillis()).
		Set("Status", newStatus).
		Where(sq.Eq{"Id": id, "Status": currentStatus})

	if newStatus == model.JOB_STATUS_IN_PROGRESS {
		sql = sql.Set("StartAt", model.GetMillis())
	}
	query, args, err := sql.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateStatusOptimistically", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	sqlResult, err := jss.GetMaster().Exec(query, args...)
	if err != nil {
		return false, model.NewAppError("SqlJobStore.UpdateStatusOptimistically", "store.sql_job.update.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
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
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.Get", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	var status *model.Job
	if err = jss.GetReplica().SelectOne(&status, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlJobStore.Get", "store.sql_job.get.app_error", nil, "Id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	return status, nil
}

func (jss SqlJobStore) GetAllPage(offset int, limit int) ([]*model.Job, *model.AppError) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllPage", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var statuses []*model.Job
	if _, err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllPage", "store.sql_job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByType(jobType string) ([]*model.Job, *model.AppError) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByType", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	var statuses []*model.Job
	if _, err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByType", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypePage(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByTypePage", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var statuses []*model.Job
	if _, err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByTypePage", "store.sql_job.get_all.app_error", nil, "Type="+jobType+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}

func (jss SqlJobStore) GetAllByStatus(status string) ([]*model.Job, *model.AppError) {
	var statuses []*model.Job
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Status": status}).
		OrderBy("CreateAt ASC").ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByStatus", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, model.NewAppError("SqlJobStore.GetAllByStatus", "store.sql_job.get_all.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
	}
	return statuses, nil
}
func (jss SqlJobStore) GetNewestJobByStatusAndType(status string, jobType string) (*model.Job, *model.AppError) {
	return jss.GetNewestJobByStatusesAndType([]string{status}, jobType)
}

func (jss SqlJobStore) GetNewestJobByStatusesAndType(status []string, jobType string) (*model.Job, *model.AppError) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Status": status, "Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(1).ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlJobStore.GetNewestJobByStatusAndType", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var job *model.Job
	if err = jss.GetReplica().SelectOne(&job, query, args...); err != nil && err != sql.ErrNoRows {
		return nil, model.NewAppError("SqlJobStore.GetNewestJobByStatusAndType", "store.sql_job.get_newest_job_by_status_and_type.app_error", nil, "Status="+strings.Join(status, ",")+", "+err.Error(), http.StatusInternalServerError)
	}
	return job, nil
}

func (jss SqlJobStore) GetCountByStatusAndType(status string, jobType string) (int64, *model.AppError) {
	query, args, err := jss.getQueryBuilder().
		Select("COUNT(*)").
		From("Jobs").
		Where(sq.Eq{"Status": status, "Type": jobType}).ToSql()
	if err != nil {
		return 0, model.NewAppError("SqlJobStore.GetCountByStatusAndType", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	count, err := jss.GetReplica().SelectInt(query, args...)
	if err != nil {
		return int64(0), model.NewAppError("SqlJobStore.GetCountByStatusAndType", "store.sql_job.get_count_by_status_and_type.app_error", nil, "Status="+status+", "+err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (jss SqlJobStore) Delete(id string) (string, *model.AppError) {
	sql, args, err := jss.getQueryBuilder().
		Delete("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return "", model.NewAppError("SqlJobStore.DeleteByType", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = jss.GetMaster().Exec(sql, args...); err != nil {
		return "", model.NewAppError("SqlJobStore.DeleteByType", "store.sql_job.delete.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	return id, nil
}
