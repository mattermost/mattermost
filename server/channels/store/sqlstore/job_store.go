// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"

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
		return nil, fmt.Errorf("failed marshalling job data: %w", err)
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
		return nil, fmt.Errorf("failed to generate sqlquery: %w", err)
	}

	if _, err = jss.GetMaster().Exec(queryString, args...); err != nil {
		return nil, fmt.Errorf("failed to save Job: %w", err)
	}

	return job, nil
}

func (jss SqlJobStore) SaveOnce(job *model.Job) (*model.Job, error) {
	jsonData, err := json.Marshal(job.Data)
	if err != nil {
		return nil, fmt.Errorf("failed marshalling job data: %w", err)
	}
	if jss.IsBinaryParamEnabled() {
		jsonData = AppendBinaryFlag(jsonData)
	}

	tx, err := jss.GetMaster().BeginWithIsolation(&sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return nil, fmt.Errorf("begin_transaction: %w", err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	var count int64
	err = tx.Get(&count, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to count pending and in-progress jobs with type=%s: %w", job.Type, err)
	}

	if count > 0 {
		return nil, nil
	}

	query, args, err = jss.getQueryBuilder().
		Insert("Jobs").
		Columns("Id", "Type", "Priority", "CreateAt", "StartAt", "LastActivityAt", "Status", "Progress", "Data").
		Values(job.Id, job.Type, job.Priority, job.CreateAt, job.StartAt, job.LastActivityAt, job.Status, job.Progress, jsonData).ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to generate sqlquery: %w", err)
	}

	if _, err = tx.Exec(query, args...); err != nil {
		if isRepeatableError(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to save Job: %w", err)
	}

	if err = tx.Commit(); err != nil {
		if isRepeatableError(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("commit_transaction: %w", err)
	}

	return job, nil
}

func (jss SqlJobStore) UpdateOptimistically(job *model.Job, currentStatus string) (bool, error) {
	dataJSON, jsonErr := json.Marshal(job.Data)
	if jsonErr != nil {
		return false, fmt.Errorf("failed to encode job's data to JSON: %w", jsonErr)
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
		return false, fmt.Errorf("job_tosql: %w", err)
	}
	sqlResult, err := jss.GetMaster().Exec(query, args...)
	if err != nil {
		return false, fmt.Errorf("failed to update Job: %w", err)
	}

	rows, err := sqlResult.RowsAffected()

	if err != nil {
		return false, fmt.Errorf("unable to get rows affected: %w", err)
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
		return nil, fmt.Errorf("failed to update Job with id=%s: %w", id, err)
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
		return nil, fmt.Errorf("failed to update Job with id=%s: %w", id, err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	var status model.Job
	if err = jss.GetReplica().Get(&status, query, args...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Job", id)
		}
		return nil, fmt.Errorf("failed to get Job with id=%s: %w", id, err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	var jobs []*model.Job
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with types: %w", err)
	}

	return jobs, nil
}

func (jss SqlJobStore) GetAllByType(rctx request.CTX, jobType string) ([]*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	statuses := []*model.Job{}
	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with type=%s: %w", jobType, err)
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypeAndStatus(rctx request.CTX, jobType string, status string) ([]*model.Job, error) {
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Type": jobType, "Status": status}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	jobs := []*model.Job{}
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with type=%s: %w", jobType, err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	statuses := []*model.Job{}
	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with type=%s: %w", jobType, err)
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByStatus(rctx request.CTX, status string) ([]*model.Job, error) {
	statuses := []*model.Job{}
	query, args, err := jss.jobQuery.
		Where(sq.Eq{"Status": status}).
		OrderBy("CreateAt ASC").ToSql()
	if err != nil {
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	if err = jss.GetReplica().Select(&statuses, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with status=%s: %w", status, err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	jobs := []*model.Job{}
	if err = jss.GetReplica().Select(&jobs, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find Jobs with types=%s and statuses=%s: %w", strings.Join(jobType, ","), strings.Join(status, ","), err)
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
		return nil, fmt.Errorf("job_tosql: %w", err)
	}

	var job model.Job
	if err = jss.GetReplica().Get(&job, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Job", fmt.Sprintf("<status, type>=<%s, %s>", strings.Join(status, ","), jobType))
		}
		return nil, fmt.Errorf("failed to find Job with statuses=%s and type=%s: %w", strings.Join(status, ","), jobType, err)
	}
	return &job, nil
}

func (jss SqlJobStore) GetCountByStatusAndType(status string, jobType string) (int64, error) {
	query, args, err := jss.getQueryBuilder().
		Select("COUNT(*)").
		From("Jobs").
		Where(sq.Eq{"Status": status, "Type": jobType}).ToSql()
	if err != nil {
		return 0, fmt.Errorf("job_tosql: %w", err)
	}

	var count int64
	err = jss.GetReplica().Get(&count, query, args...)
	if err != nil {
		return int64(0), fmt.Errorf("failed to count Jobs with status=%s and type=%s: %w", status, jobType, err)
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
		return nil, fmt.Errorf("get_by_type_and_data_tosql: %w", err)
	}

	var jobs []*model.Job
	// For consistency-critical operations (like job deduplication), use master
	db := jss.GetReplica()
	if useMaster {
		db = jss.GetMaster()
	}

	if err := db.Select(&jobs, queryString, args...); err != nil {
		return nil, fmt.Errorf("failed to get Jobs by type and data: %w", err)
	}

	return jobs, nil
}

func (jss SqlJobStore) Delete(id string) (string, error) {
	query, args, err := jss.getQueryBuilder().
		Delete("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return "", fmt.Errorf("job_tosql: %w", err)
	}

	if _, err = jss.GetMaster().Exec(query, args...); err != nil {
		return "", fmt.Errorf("failed to delete Job with id=%s: %w", id, err)
	}
	return id, nil
}

func (jss SqlJobStore) Cleanup(expiryTime int64, batchSize int) error {
	query := "DELETE FROM Jobs WHERE Id IN (SELECT Id FROM Jobs WHERE CreateAt < ? AND (Status != ? AND Status != ?) ORDER BY CreateAt ASC LIMIT ?)"

	var rowsAffected int64 = 1

	for rowsAffected > 0 {
		sqlResult, err := jss.GetMaster().Exec(query,
			expiryTime, model.JobStatusInProgress, model.JobStatusPending, batchSize)
		if err != nil {
			return fmt.Errorf("unable to delete jobs: %w", err)
		}
		var rowErr error
		rowsAffected, rowErr = sqlResult.RowsAffected()
		if rowErr != nil {
			return fmt.Errorf("unable to delete jobs: %w", rowErr)
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
