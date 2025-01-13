// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

const (
	JobTypeDataRetention                 = "data_retention"
	JobTypeMessageExport                 = "message_export"
	JobTypeCLIMessageExport              = "cli_message_export"
	JobTypeElasticsearchPostIndexing     = "elasticsearch_post_indexing"
	JobTypeElasticsearchPostAggregation  = "elasticsearch_post_aggregation"
	JobTypeBlevePostIndexing             = "bleve_post_indexing"
	JobTypeLdapSync                      = "ldap_sync"
	JobTypeMigrations                    = "migrations"
	JobTypePlugins                       = "plugins"
	JobTypeExpiryNotify                  = "expiry_notify"
	JobTypeProductNotices                = "product_notices"
	JobTypeActiveUsers                   = "active_users"
	JobTypeImportProcess                 = "import_process"
	JobTypeImportDelete                  = "import_delete"
	JobTypeExportProcess                 = "export_process"
	JobTypeExportDelete                  = "export_delete"
	JobTypeCloud                         = "cloud"
	JobTypeResendInvitationEmail         = "resend_invitation_email"
	JobTypeExtractContent                = "extract_content"
	JobTypeLastAccessiblePost            = "last_accessible_post"
	JobTypeLastAccessibleFile            = "last_accessible_file"
	JobTypeUpgradeNotifyAdmin            = "upgrade_notify_admin"
	JobTypeTrialNotifyAdmin              = "trial_notify_admin"
	JobTypePostPersistentNotifications   = "post_persistent_notifications"
	JobTypeInstallPluginNotifyAdmin      = "install_plugin_notify_admin"
	JobTypeHostedPurchaseScreening       = "hosted_purchase_screening"
	JobTypeS3PathMigration               = "s3_path_migration"
	JobTypeCleanupDesktopTokens          = "cleanup_desktop_tokens"
	JobTypeDeleteEmptyDraftsMigration    = "delete_empty_drafts_migration"
	JobTypeRefreshPostStats              = "refresh_post_stats"
	JobTypeDeleteOrphanDraftsMigration   = "delete_orphan_drafts_migration"
	JobTypeExportUsersToCSV              = "export_users_to_csv"
	JobTypeDeleteDmsPreferencesMigration = "delete_dms_preferences_migration"
	JobTypeMobileSessionMetadata         = "mobile_session_metadata"

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
	JobTypeCleanupDesktopTokens,
	JobTypeRefreshPostStats,
	JobTypeMobileSessionMetadata,
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

	validStatus := IsValidJobStatus(j.Status)
	if !validStatus {
		return NewAppError("Job.IsValid", "model.job.is_valid.status.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	return nil
}

func (j *Job) IsValidStatusChange(newStatus string) bool {
	currentStatus := j.Status

	switch currentStatus {
	case JobStatusInProgress:
		return newStatus == JobStatusPending || newStatus == JobStatusCancelRequested
	case JobStatusPending:
		return newStatus == JobStatusCancelRequested
	case JobStatusCancelRequested:
		return newStatus == JobStatusCanceled
	}

	return false
}

func IsValidJobStatus(status string) bool {
	switch status {
	case JobStatusPending,
		JobStatusInProgress,
		JobStatusSuccess,
		JobStatusError,
		JobStatusWarning,
		JobStatusCancelRequested,
		JobStatusCanceled:
	default:
		return false
	}

	return true
}

func IsValidJobType(jobType string) bool {
	for _, t := range AllJobTypes {
		if t == jobType {
			return true
		}
	}

	return false
}

func (j *Job) LogClone() any {
	return j.Auditable()
}

type Worker interface {
	Run()
	Stop()
	JobChannel() chan<- Job
	IsEnabled(cfg *Config) bool
}
