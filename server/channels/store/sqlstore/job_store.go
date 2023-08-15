// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	jobsCleanupDelay = 100 * time.Millisecond
)

type SqlJobStore struct {
	*SqlStore
}

func newSqlJobStore(sqlStore *SqlStore) store.JobStore {
	return &SqlJobStore{sqlStore}
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

	if _, err = jss.GetMasterX().Exec(queryString, args...); err != nil {
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

	tx, err := jss.GetMasterX().BeginXWithIsolation(&sql.TxOptions{
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
	sqlResult, err := jss.GetMasterX().Exec(query, args...)
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

	if _, err := jss.GetMasterX().NamedExec(`UPDATE Jobs
		SET Status=:Status, LastActivityAt=:LastActivityAt
		WHERE Id=:Id`, job); err != nil {
		return nil, errors.Wrapf(err, "failed to update Job with id=%s", id)
	}

	return job, nil
}

func (jss SqlJobStore) UpdateStatusOptimistically(id string, currentStatus string, newStatus string) (bool, error) {
	builder := jss.getQueryBuilder().
		Update("Jobs").
		Set("LastActivityAt", model.GetMillis()).
		Set("Status", newStatus).
		Where(sq.Eq{"Id": id, "Status": currentStatus})

	if newStatus == model.JobStatusInProgress {
		builder = builder.Set("StartAt", model.GetMillis())
	}
	query, args, err := builder.ToSql()
	if err != nil {
		return false, errors.Wrap(err, "job_tosql")
	}

	sqlResult, err := jss.GetMasterX().Exec(query, args...)
	if err != nil {
		return false, errors.Wrapf(err, "failed to update Job with id=%s", id)
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

func (jss SqlJobStore) Get(id string) (*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}
	var status model.Job
	if err = jss.GetReplicaX().Get(&status, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Job", id)
		}
		return nil, errors.Wrapf(err, "failed to get Job with id=%s", id)
	}
	return &status, nil
}

func (jss SqlJobStore) GetAllByTypesPage(c *request.Context, jobTypes []string, offset int, limit int) ([]*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobTypes}).
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var jobs []*model.Job
	if err = jss.GetReplicaX().Select(&jobs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with types")
	}
	for _, j := range jobs {
		j.InitLogger(c.Logger())
	}

	return jobs, nil
}

func (jss SqlJobStore) GetAllByType(c *request.Context, jobType string) ([]*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	statuses := []*model.Job{}
	if err = jss.GetReplicaX().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}
	for _, j := range statuses {
		j.InitLogger(c.Logger())
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByTypeAndStatus(c *request.Context, jobType string, status string) ([]*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobType, "Status": status}).
		OrderBy("CreateAt DESC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	jobs := []*model.Job{}
	if err = jss.GetReplicaX().Select(&jobs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}
	for _, j := range jobs {
		j.InitLogger(c.Logger())
	}

	return jobs, nil
}

func (jss SqlJobStore) GetAllByTypePage(c *request.Context, jobType string, offset int, limit int) ([]*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(uint64(limit)).
		Offset(uint64(offset)).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	statuses := []*model.Job{}
	if err = jss.GetReplicaX().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with type=%s", jobType)
	}
	for _, j := range statuses {
		j.InitLogger(c.Logger())
	}

	return statuses, nil
}

func (jss SqlJobStore) GetAllByStatus(c *request.Context, status string) ([]*model.Job, error) {
	statuses := []*model.Job{}
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Status": status}).
		OrderBy("CreateAt ASC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	if err = jss.GetReplicaX().Select(&statuses, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Jobs with status=%s", status)
	}
	for _, j := range statuses {
		j.InitLogger(c.Logger())
	}

	return statuses, nil
}

func (jss SqlJobStore) GetNewestJobByStatusAndType(status string, jobType string) (*model.Job, error) {
	return jss.GetNewestJobByStatusesAndType([]string{status}, jobType)
}

func (jss SqlJobStore) GetNewestJobByStatusesAndType(status []string, jobType string) (*model.Job, error) {
	query, args, err := jss.getQueryBuilder().
		Select("*").
		From("Jobs").
		Where(sq.Eq{"Status": status, "Type": jobType}).
		OrderBy("CreateAt DESC").
		Limit(1).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "job_tosql")
	}

	var job model.Job
	if err = jss.GetReplicaX().Get(&job, query, args...); err != nil {
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
	err = jss.GetReplicaX().Get(&count, query, args...)
	if err != nil {
		return int64(0), errors.Wrapf(err, "failed to count Jobs with status=%s and type=%s", status, jobType)
	}
	return count, nil
}

func (jss SqlJobStore) Delete(id string) (string, error) {
	query, args, err := jss.getQueryBuilder().
		Delete("Jobs").
		Where(sq.Eq{"Id": id}).ToSql()
	if err != nil {
		return "", errors.Wrap(err, "job_tosql")
	}

	if _, err = jss.GetMasterX().Exec(query, args...); err != nil {
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
		sqlResult, err := jss.GetMasterX().Exec(query,
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

const mySQLDeadlockCode = uint16(1213)

// isRepeatableError is a bit of copied code from retrylayer.go.
// A little copying is fine because we don't want to import another package
// in the store layer
func isRepeatableError(err error) bool {
	var pqErr *pq.Error
	var mysqlErr *mysql.MySQLError
	switch {
	case errors.As(err, &pqErr):
		if pqErr.Code == "40001" || pqErr.Code == "40P01" {
			return true
		}
	case errors.As(err, &mysqlErr):
		if mysqlErr.Number == mySQLDeadlockCode {
			return true
		}
	}
	return false
}
