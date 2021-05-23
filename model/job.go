// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"time"
)

const (
	JOB_TYPE_DATA_RETENTION                 = "data_retention"
	JOB_TYPE_MESSAGE_EXPORT                 = "message_export"
	JOB_TYPE_ELASTICSEARCH_POST_INDEXING    = "elasticsearch_post_indexing"
	JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION = "elasticsearch_post_aggregation"
	JOB_TYPE_BLEVE_POST_INDEXING            = "bleve_post_indexing"
	JOB_TYPE_LDAP_SYNC                      = "ldap_sync"
	JOB_TYPE_MIGRATIONS                     = "migrations"
	JOB_TYPE_PLUGINS                        = "plugins"
	JOB_TYPE_EXPIRY_NOTIFY                  = "expiry_notify"
	JOB_TYPE_PRODUCT_NOTICES                = "product_notices"
	JOB_TYPE_ACTIVE_USERS                   = "active_users"
	JOB_TYPE_IMPORT_PROCESS                 = "import_process"
	JOB_TYPE_IMPORT_DELETE                  = "import_delete"
	JOB_TYPE_EXPORT_PROCESS                 = "export_process"
	JOB_TYPE_EXPORT_DELETE                  = "export_delete"
	JOB_TYPE_CLOUD                          = "cloud"
	JOB_TYPE_RESEND_INVITATION_EMAIL        = "resend_invitation_email"

	JOB_STATUS_PENDING          = "pending"
	JOB_STATUS_IN_PROGRESS      = "in_progress"
	JOB_STATUS_SUCCESS          = "success"
	JOB_STATUS_ERROR            = "error"
	JOB_STATUS_CANCEL_REQUESTED = "cancel_requested"
	JOB_STATUS_CANCELED         = "canceled"
	JOB_STATUS_WARNING          = "warning"
)

var ALL_JOB_TYPES = [...]string{
	JOB_TYPE_DATA_RETENTION,
	JOB_TYPE_MESSAGE_EXPORT,
	JOB_TYPE_ELASTICSEARCH_POST_INDEXING,
	JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION,
	JOB_TYPE_BLEVE_POST_INDEXING,
	JOB_TYPE_LDAP_SYNC,
	JOB_TYPE_MIGRATIONS,
	JOB_TYPE_PLUGINS,
	JOB_TYPE_EXPIRY_NOTIFY,
	JOB_TYPE_PRODUCT_NOTICES,
	JOB_TYPE_ACTIVE_USERS,
	JOB_TYPE_IMPORT_PROCESS,
	JOB_TYPE_IMPORT_DELETE,
	JOB_TYPE_EXPORT_PROCESS,
	JOB_TYPE_EXPORT_DELETE,
	JOB_TYPE_CLOUD,
}

type Job struct {
	Id             string            `json:"id"`
	Type           string            `json:"type"`
	Priority       int64             `json:"priority"`
	CreateAt       int64             `json:"create_at"`
	StartAt        int64             `json:"start_at"`
	LastActivityAt int64             `json:"last_activity_at"`
	Status         string            `json:"status"`
	Progress       int64             `json:"progress"`
	Data           map[string]string `json:"data"`
}

func (j *Job) IsValid() *AppError {
	if !IsValidId(j.Id) {
		return NewAppError("Job.IsValid", "model.job.is_valid.id.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	if j.CreateAt == 0 {
		return NewAppError("Job.IsValid", "model.job.is_valid.create_at.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	switch j.Type {
	case JOB_TYPE_DATA_RETENTION:
	case JOB_TYPE_ELASTICSEARCH_POST_INDEXING:
	case JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION:
	case JOB_TYPE_BLEVE_POST_INDEXING:
	case JOB_TYPE_LDAP_SYNC:
	case JOB_TYPE_MESSAGE_EXPORT:
	case JOB_TYPE_MIGRATIONS:
	case JOB_TYPE_PLUGINS:
	case JOB_TYPE_PRODUCT_NOTICES:
	case JOB_TYPE_EXPIRY_NOTIFY:
	case JOB_TYPE_ACTIVE_USERS:
	case JOB_TYPE_IMPORT_PROCESS:
	case JOB_TYPE_IMPORT_DELETE:
	case JOB_TYPE_EXPORT_PROCESS:
	case JOB_TYPE_EXPORT_DELETE:
	case JOB_TYPE_CLOUD:
	case JOB_TYPE_RESEND_INVITATION_EMAIL:
	default:
		return NewAppError("Job.IsValid", "model.job.is_valid.type.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	switch j.Status {
	case JOB_STATUS_PENDING:
	case JOB_STATUS_IN_PROGRESS:
	case JOB_STATUS_SUCCESS:
	case JOB_STATUS_ERROR:
	case JOB_STATUS_CANCEL_REQUESTED:
	case JOB_STATUS_CANCELED:
	default:
		return NewAppError("Job.IsValid", "model.job.is_valid.status.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	return nil
}

func (j *Job) ToJson() string {
	b, _ := json.Marshal(j)
	return string(b)
}

func JobFromJson(data io.Reader) *Job {
	var job Job
	if err := json.NewDecoder(data).Decode(&job); err == nil {
		return &job
	}
	return nil
}

func JobsToJson(jobs []*Job) string {
	b, _ := json.Marshal(jobs)
	return string(b)
}

func JobsFromJson(data io.Reader) []*Job {
	var jobs []*Job
	if err := json.NewDecoder(data).Decode(&jobs); err == nil {
		return jobs
	}
	return nil
}

func (j *Job) DataToJson() string {
	b, _ := json.Marshal(j.Data)
	return string(b)
}

type Worker interface {
	Run()
	Stop()
	JobChannel() chan<- Job
}

type Scheduler interface {
	Name() string
	JobType() string
	Enabled(cfg *Config) bool
	NextScheduleTime(cfg *Config, now time.Time, pendingJobs bool, lastSuccessfulJob *Job) *time.Time
	ScheduleJob(cfg *Config, pendingJobs bool, lastSuccessfulJob *Job) (*Job, *AppError)
}
