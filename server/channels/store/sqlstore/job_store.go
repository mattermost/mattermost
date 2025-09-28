// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	jobsCleanupDelay = 100 * time.Millisecond
)

type SqlJobStore struct {
	*SqlStore

	jobColumns []string
	jobQuery   sq.SelectBuilder
}

func newSqlJobStore(sqlStore *SqlStore) store.JobStore {
	s := &SqlJobStore{
		SqlStore: sqlStore,
		jobColumns: []string{
			"Id",
			"Type",
			"Priority",
			"CreateAt",
			"StartAt",
			"LastActivityAt",
			"Status",
			"Progress",
			"Data",
		},
	}

	s.jobQuery = s.getQueryBuilder().
		Select(s.jobColumns...).
		From("Jobs")

	return s
}

func (jss SqlJobStore) Save(job *model.Job) (*model.Job, error) {
	jsonData, err := json.Marshal(job.Data)
	if err != nil {
		return nil, errors.Wrap(err, "failed marshalling job data")
	}
	if jss.IsBinaryParamEnabled() {
		jsonData = AppendBinaryFlag(jsonData)
	}
	query := jss.getQueryBuilder().
		Insert("Jobs").
		Columns("Id", "Type", "Priority", "CreateAt", "StartAt", "LastActivityAt", "Status", "Progress", "Data").
		Values(job.Id, job.Type, job.Priority, job.CreateAt, job.StartAt, job.LastActivityAt, job.Status, job.Progress, jsonData)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate sqlquery")
	}

	if _, err = jss.GetMaster().Exec(queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save Job")
	}

	return job, nil
}

func (jss SqlJobStore) SaveOnce(job *model.Job) (*model.Job, error) {
	jsonData, err := json.Marshal(job.Data)
	if err != nil {
		return nil, errors.Wrap(err, "failed marshalling job data")
	}
	if jss.IsBinaryParamEnabled() {
		jsonData = AppendBinaryFlag(jsonData)
	}

	tx, err := jss.GetMaster().BeginXWithIsolation(&sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	query, args, err := jss.getQueryBuilder().
		Select("COUNT(*)").
		From("Jobs").
		Where(sq.Eq{
			"Status": []string{model.JobStatusPending, model.JobStatusInProgress},
			"Type":   job.Type,
		}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var count int64
	err = tx.Get(&count, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to count pending and in-progress jobs with type=%s", job.Type)
	}

	if count > 0 {
		return nil, nil
	}

	query, args, err = jss.getQueryBuilder().
		Insert("Jobs").
		Columns("Id", "Type", "Priority", "CreateAt", "StartAt", "LastActivityAt", "Status", "Progress", "Data").
		Values(job.Id, job.Type, job.Priority, job.CreateAt, job.StartAt, job.LastActivityAt, job.Status, job.Progress, jsonData).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate sqlquery")
	}

	if _, err = tx.Exec(query, args...); err != nil {
		if isRepeatableError(err) {
			return nil, nil
		}
		return nil, errors.Wrap(err, "failed to save Job")
	}

	if err = tx.Commit(); err != nil {
		if isRepeatableError(err) {
			return nil, nil
		}
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return job, nil
}

func (jss SqlJobStore) UpdateOptimistically(job *model.Job, currentStatus string) (bool, error) {
	dataJSON, jsonErr := json.Marshal(job.Data)
	if jsonErr != nil {
		return false, errors.Wrap(jsonErr, "failed to encode job's data to JSON")
	}
	if jss.IsBinaryParamEnabled() {
		dataJSON = AppendBinaryFlag(dataJSON)
	}
	query, args, err := jss.getQueryBuilder().
		Update("Jobs").
		Set("LastActivityAt", model.GetMillis()).
		Set("Status", job.Status).
		Set("Data", dataJSON).
		Set("Progress", job.Progress).
		Where(sq.Eq{"Id": job.Id, "Status": currentStatus}).ToSql()
	if err != nil {
		return false, errors.Wrap(err, "job_tosql")
	}
	sqlResult, err := jss.GetMaster().Exec(query, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to update Job")
	}

	rows, err := sqlResult.RowsAffected()

	if err != nil {
		return false, errors.Wrap(err, "unable to get rows affected")
	}

	if rows != 1 {
		return false, nil
	}

	return true, nil
}

func (jss SqlJobStore) UpdateStatus(id string, status string) (*model.Job, error) {
	job := &model.Job{
		Id:             id,
		Status:         status,
		LastActivityAt: model.GetMillis(),
	}

	if _, err := jss.GetMaster().NamedExec(`UPDATE Jobs
		SET Status=:Status, LastActivityAt=:LastActivityAt
		WHERE Id=:Id`, job); err != nil {
		return nil, errors.Wrapf(err, "failed to update Job with id=%s", id)
	}

	return job, nil
}

func (jss SqlJobStore) UpdateStatusOptimistically(id string, currentStatus string, newStatus string) (*model.Job, error) {
	lastActivityAndStartTime := model.GetMillis()

	// Use RETURNING to get the updated job in a single query
	builder := jss.getQueryBuilder().
		Update("Jobs").
		Set("LastActivityAt", lastActivityAndStartTime).
		Set("Status", newStatus).
		Where(sq.Eq{"Id": id, "Status": currentStatus}).
		Suffix("RETURNING " + strings.Join(jss.jobColumns, ", "))

	if newStatus == model.JobStatusInProgress {
		builder = builder.Set("StartAt", lastActivityAndStartTime)
	}

	var job []*model.Job
	if err := jss.GetMaster().SelectBuilder(&job, builder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Job", id)
		}
		return nil, errors.Wrapf(err, "failed to update Job with id=%s", id)
	}

	// we are updating by id, so we should only ever update 1 job
	if len(job) != 1 {
		// no row was updated, but no error above, so to remain consistent we return nil, nil
		return nil, nil
	}

	return job[0], nil
}

func (jss SqlJobStore) Get(rctx request.CTX, id string) (*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var status model.Job
	if err = jss.GetReplica().Get(&status, query, args...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Job", id)
		}
		return nil, errors.Wrapf(err, "failed to get Job with id=%s", id)
	}

	return &status, nil
}

func (jss SqlJobStore) GetAllByTypesPage(rctx request.CTX, jobTypes []string, page int, perPage int) ([]*model.Job, error) {
	offset := page * perPage
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobTypes}).
		OrderBy("CreateAt DESC").
		Limit(uint64(perPage)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var jobs []*model.Job
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with types")
	}

	return jobs, nil
}

func (jss SqlJobStore) GetAllByType(rctx request.CTX, jobType string) ([]*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	statuses := []*model.Job{}
	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypeAndStatus(rctx request.CTX, jobType string, status string) ([]*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType, "Status": status}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	jobs := []*model.Job{}
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}

	return jobs, nil
}

func (jss SqlJobStore) GetAllByTypePage(rctx request.CTX, jobType string, page int, perPage int) ([]*model.Job, error) {
	offset := page * perPage
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(uint64(perPage)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	statuses := []*model.Job{}
	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByStatus(rctx request.CTX, status string) ([]*model.Job, error) {
	statuses := []*model.Job{}
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Status": status}).
		OrderBy("CreateAt ASC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with status=%s", status)
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypesAndStatusesPage(rctx request.CTX, jobType []string, status []string, offset int, limit int) ([]*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType, "Status": status}).
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	jobs := []*model.Job{}
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with types=%s and statuses=%s", strings.Join(jobType, ","), strings.Join(status, ","))
	}

	return jobs, nil
}

func (jss SqlJobStore) GetNewestJobByStatusAndType(status string, jobType string) (*model.Job, error) {
	return jss.GetNewestJobByStatusesAndType([]string{status}, jobType)
}

func (jss SqlJobStore) GetNewestJobByStatusesAndType(status []string, jobType string) (*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Status": status, "Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(1).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var job model.Job
	if err = jss.GetReplica().Get(&job, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Job", fmt.Sprintf("<status, type>=<%s, %s>", strings.Join(status, ","), jobType))
		}
		return nil, errors.Wrapf(err, "failed to find Job with statuses=%s and type=%s", strings.Join(status, ","), jobType)
	}
	return &job, nil
}

func (jss SqlJobStore) GetCountByStatusAndType(status string, jobType string) (int64, error) {
	query, args, err := jss.getQueryBuilder().
		Select("COUNT(*)").
		From("Jobs").
		Where(sq.Eq{"Status": status, "Type": jobType}).ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "job_tosql")
	}

	var count int64
	err = jss.GetReplica().Get(&count, query, args...)
	if err != nil {
		return int64(0), errors.Wrapf(err, "failed to count Jobs with status=%s and type=%s", status, jobType)
	}
	return count, nil
}

func (jss SqlJobStore) GetByTypeAndData(rctx request.CTX, jobType string, data map[string]string, useMaster bool, statuses ...string) ([]*model.Job, error) {
	query := jss.jobQuery.Where(sq.Eq{"Type": jobType})

	// Add status filtering if provided - enables full usage of idx_jobs_status_type index
	if len(statuses) > 0 {
		query = query.Where(sq.Eq{"Status": statuses})
	}

	// Add JSON data filtering for each key-value pair
	for key, value := range data {
		query = query.Where(sq.Expr("Data->? = ?", key, fmt.Sprintf(`"%s"`, value)))
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_type_and_data_tosql")
	}

	var jobs []*model.Job
	// For consistency-critical operations (like job deduplication), use master
	db := jss.GetReplica()
	if useMaster {
		db = jss.GetMaster()
	}

	if err := db.Select(&jobs, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get Jobs by type and data")
	}

	return jobs, nil
}

func (jss SqlJobStore) Delete(id string) (string, error) {
	query, args, err := jss.getQueryBuilder().
		Delete("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return "", errors.Wrap(err, "job_tosql")
	}

	if _, err = jss.GetMaster().Exec(query, args...); err != nil {
		return "", errors.Wrapf(err, "failed to delete Job with id=%s", id)
	}
	return id, nil
}

func (jss SqlJobStore) Cleanup(expiryTime int64, batchSize int) error {
	var query string
	if jss.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Jobs WHERE Id IN (SELECT Id FROM Jobs WHERE CreateAt < ? AND (Status != ? AND Status != ?) ORDER BY CreateAt ASC LIMIT ?)"
	} else {
		query = "DELETE FROM Jobs WHERE CreateAt < ? AND (Status != ? AND Status != ?) ORDER BY CreateAt ASC LIMIT ?"
	}

	var rowsAffected int64 = 1

	for rowsAffected > 0 {
		sqlResult, err := jss.GetMaster().Exec(query,
			expiryTime, model.JobStatusInProgress, model.JobStatusPending, batchSize)
		if err != nil {
			return errors.Wrap(err, "unable to delete jobs")
		}
		var rowErr error
		rowsAffected, rowErr = sqlResult.RowsAffected()
		if rowErr != nil {
			return errors.Wrap(err, "unable to delete jobs")
		}

		time.Sleep(jobsCleanupDelay)
	}

	return nil
}

// isRepeatableError is a bit of copied code from retrylayer.go.
// A little copying is fine because we don't want to import another package
// in the store layer
func isRepeatableError(err error) bool {
	var pqErr *pq.Error
	switch {
	case errors.As(err, &pqErr):
		if pqErr.Code == "40001" || pqErr.Code == "40P01" {
			return true
		}
	}
	return false
}
