// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	JobTypeDataRetention                = "data_retention"
	JobTypeMessageExport                = "message_export"
	JobTypeElasticsearchPostIndexing    = "elasticsearch_post_indexing"
	JobTypeElasticsearchPostAggregation = "elasticsearch_post_aggregation"
	JobTypeElasticsearchFixChannelIndex = "elasticsearch_fix_channel_index"
	JobTypeBlevePostIndexing            = "bleve_post_indexing"
	JobTypeLdapSync                     = "ldap_sync"
	JobTypeMigrations                   = "migrations"
	JobTypePlugins                      = "plugins"
	JobTypeExpiryNotify                 = "expiry_notify"
	JobTypeProductNotices               = "product_notices"
	JobTypeActiveUsers                  = "active_users"
	JobTypeImportProcess                = "import_process"
	JobTypeImportDelete                 = "import_delete"
	JobTypeExportProcess                = "export_process"
	JobTypeExportDelete                 = "export_delete"
	JobTypeCloud                        = "cloud"
	JobTypeResendInvitationEmail        = "resend_invitation_email"
	JobTypeExtractContent               = "extract_content"
	JobTypeLastAccessiblePost           = "last_accessible_post"
	JobTypeLastAccessibleFile           = "last_accessible_file"
	JobTypeUpgradeNotifyAdmin           = "upgrade_notify_admin"
	JobTypeTrialNotifyAdmin             = "trial_notify_admin"
	JobTypePostPersistentNotifications  = "post_persistent_notifications"
	JobTypeInstallPluginNotifyAdmin     = "install_plugin_notify_admin"
	JobTypeHostedPurchaseScreening      = "hosted_purchase_screening"
	JobTypeS3PathMigration              = "s3_path_migration"

	JobStatusPending         = "pending"
	JobStatusInProgress      = "in_progress"
	JobStatusSuccess         = "success"
	JobStatusError           = "error"
	JobStatusCancelRequested = "cancel_requested"
	JobStatusCanceled        = "canceled"
	JobStatusWarning         = "warning"
)

var AllJobTypes = [...]string{
	JobTypeDataRetention,
	JobTypeMessageExport,
	JobTypeElasticsearchPostIndexing,
	JobTypeElasticsearchPostAggregation,
	JobTypeBlevePostIndexing,
	JobTypeLdapSync,
	JobTypeMigrations,
	JobTypePlugins,
	JobTypeExpiryNotify,
	JobTypeProductNotices,
	JobTypeActiveUsers,
	JobTypeImportProcess,
	JobTypeImportDelete,
	JobTypeExportProcess,
	JobTypeExportDelete,
	JobTypeCloud,
	JobTypeExtractContent,
	JobTypeLastAccessiblePost,
	JobTypeLastAccessibleFile,
}

type Job struct {
	Id             string    `json:"id"`
	Type           string    `json:"type"`
	Priority       int64     `json:"priority"`
	CreateAt       int64     `json:"create_at"`
	StartAt        int64     `json:"start_at"`
	LastActivityAt int64     `json:"last_activity_at"`
	Status         string    `json:"status"`
	Progress       int64     `json:"progress"`
	Data           StringMap `json:"data"`

	Logger *mlog.Logger `json:"-"`
}

func (j *Job) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":               j.Id,
		"type":             j.Type,
		"priority":         j.Priority,
		"create_at":        j.CreateAt,
		"start_at":         j.StartAt,
		"last_activity_at": j.LastActivityAt,
		"status":           j.Status,
		"progress":         j.Progress,
		"data":             j.Data, // TODO do we want this here
	}
}

func (j *Job) IsValid() *AppError {
	if !IsValidId(j.Id) {
		return NewAppError("Job.IsValid", "model.job.is_valid.id.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	if j.CreateAt == 0 {
		return NewAppError("Job.IsValid", "model.job.is_valid.create_at.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	switch j.Status {
	case JobStatusPending,
		JobStatusInProgress,
		JobStatusSuccess,
		JobStatusError,
		JobStatusWarning,
		JobStatusCancelRequested,
		JobStatusCanceled:
	default:
		return NewAppError("Job.IsValid", "model.job.is_valid.status.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	return nil
}

// InitLogger attaches an annotated logger to a Job.
// It should always be called after creating a new Job to ensure `Job.Logger` it set.
func (j *Job) InitLogger(logger mlog.LoggerIFace) {
	j.Logger = logger.With(
		mlog.String("job_id", j.Id),
		mlog.String("job_type", j.Type),
		mlog.String("create_at", time.UnixMilli(j.CreateAt).String()),
	)
}

type Worker interface {
	Run()
	Stop()
	JobChannel() chan<- Job
	IsEnabled(cfg *Config) bool
}
