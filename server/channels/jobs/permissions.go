// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import "github.com/mattermost/mattermost/server/public/model"

func ReadPermissionForType(jobType string) *model.Permission {
	switch jobType {
	case model.JobTypeDataRetention:
		return model.PermissionReadDataRetentionJob
	case model.JobTypeMessageExport:
		return model.PermissionReadComplianceExportJob
	case model.JobTypeElasticsearchPostIndexing:
		return model.PermissionReadElasticsearchPostIndexingJob
	case model.JobTypeElasticsearchPostAggregation:
		return model.PermissionReadElasticsearchPostAggregationJob
	case model.JobTypeLdapSync:
		return model.PermissionReadLdapSyncJob
	case
		model.JobTypeMigrations,
		model.JobTypePlugins,
		model.JobTypeProductNotices,
		model.JobTypeExpiryNotify,
		model.JobTypeActiveUsers,
		model.JobTypeImportProcess,
		model.JobTypeImportDelete,
		model.JobTypeExportProcess,
		model.JobTypeExportDelete,
		model.JobTypeCloud,
		model.JobTypeMobileSessionMetadata,
		model.JobTypeExtractContent,
		model.JobTypeCleanupExpiredAccessTokens,
		model.JobTypeLastAccessiblePost,
		model.JobTypeLastAccessibleFile,
		model.JobTypeRefreshMaterializedViews,
		model.JobTypeScheduledRecap:
		return model.PermissionReadJobs
	case model.JobTypeAccessControlSync:
		return model.PermissionManageSystem
	case model.JobTypeAccessControlTeamSync:
		return model.PermissionManageTeamAccessRules
	}

	return nil
}
