// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// jobTypePermissions holds the permissions required to read, manage, and create jobs of a type.
type jobTypePermissions struct {
	read   *model.Permission
	manage *model.Permission
	// create is nil if jobs of this type can't be created through the API.
	create *model.Permission
}

var (
	generalJobPermissions = jobTypePermissions{
		read:   model.PermissionReadJobs,
		manage: model.PermissionManageJobs,
		create: model.PermissionManageJobs,
	}
	readableJobPermissions = jobTypePermissions{
		read:   model.PermissionReadJobs,
		manage: model.PermissionManageSystem,
	}
	systemJobPermissions = jobTypePermissions{
		read:   model.PermissionManageSystem,
		manage: model.PermissionManageSystem,
	}
	// The SessionHasPermissionTo*Job methods additionally allow channel and team admins for these job types.
	accessControlJobPermissions = jobTypePermissions{
		read:   model.PermissionManageSystem,
		manage: model.PermissionManageSystem,
		create: model.PermissionManageSystem,
	}
)

// jobPermissions maps every job type in model.AllJobTypes to its permissions.
var jobPermissions = map[string]jobTypePermissions{
	model.JobTypeDataRetention: {
		read:   model.PermissionReadDataRetentionJob,
		manage: model.PermissionManageDataRetentionJob,
		create: model.PermissionCreateDataRetentionJob,
	},
	model.JobTypeMessageExport: {
		read:   model.PermissionReadComplianceExportJob,
		manage: model.PermissionManageComplianceExportJob,
		create: model.PermissionCreateComplianceExportJob,
	},
	model.JobTypeElasticsearchPostIndexing: {
		read:   model.PermissionReadElasticsearchPostIndexingJob,
		manage: model.PermissionManageElasticsearchPostIndexingJob,
		create: model.PermissionCreateElasticsearchPostIndexingJob,
	},
	model.JobTypeElasticsearchPostAggregation: {
		read:   model.PermissionReadElasticsearchPostAggregationJob,
		manage: model.PermissionManageElasticsearchPostAggregationJob,
		create: model.PermissionCreateElasticsearchPostAggregationJob,
	},
	model.JobTypeLdapSync: {
		read:   model.PermissionReadLdapSyncJob,
		manage: model.PermissionManageLdapSyncJob,
		create: model.PermissionCreateLdapSyncJob,
	},
	model.JobTypeAccessControlSync:     accessControlJobPermissions,
	model.JobTypeAccessControlTeamSync: accessControlJobPermissions,

	model.JobTypeMigrations:                 generalJobPermissions,
	model.JobTypePlugins:                    generalJobPermissions,
	model.JobTypeProductNotices:             generalJobPermissions,
	model.JobTypeExpiryNotify:               generalJobPermissions,
	model.JobTypeActiveUsers:                generalJobPermissions,
	model.JobTypeImportProcess:              generalJobPermissions,
	model.JobTypeImportDelete:               generalJobPermissions,
	model.JobTypeExportProcess:              generalJobPermissions,
	model.JobTypeExportDelete:               generalJobPermissions,
	model.JobTypeCloud:                      generalJobPermissions,
	model.JobTypeExtractContent:             generalJobPermissions,
	model.JobTypeCleanupExpiredAccessTokens: generalJobPermissions,
	model.JobTypeNotifyExpiringAccessTokens: generalJobPermissions,

	model.JobTypeMobileSessionMetadata:       readableJobPermissions,
	model.JobTypePostPersistentNotifications: readableJobPermissions,
	model.JobTypeDeleteExpiredPosts:          readableJobPermissions,

	model.JobTypeCLIMessageExport:              systemJobPermissions,
	model.JobTypeResendInvitationEmail:         systemJobPermissions,
	model.JobTypeLastAccessiblePost:            systemJobPermissions,
	model.JobTypeUpgradeNotifyAdmin:            systemJobPermissions,
	model.JobTypeTrialNotifyAdmin:              systemJobPermissions,
	model.JobTypeInstallPluginNotifyAdmin:      systemJobPermissions,
	model.JobTypeS3PathMigration:               systemJobPermissions,
	model.JobTypeCleanupDesktopTokens:          systemJobPermissions,
	model.JobTypeDeleteEmptyDraftsMigration:    systemJobPermissions,
	model.JobTypeRefreshMaterializedViews:      systemJobPermissions,
	model.JobTypeDeleteOrphanDraftsMigration:   systemJobPermissions,
	model.JobTypeExportUsersToCSV:              systemJobPermissions,
	model.JobTypeDeleteDmsPreferencesMigration: systemJobPermissions,
	model.JobTypePushProxyAuth:                 systemJobPermissions,
	model.JobTypeRecap:                         systemJobPermissions,
	model.JobTypeScheduledRecap:                systemJobPermissions,
	model.JobTypeAutoTranslationRecovery:       systemJobPermissions,
}

// SessionHasPermissionToCreateJob returns whether the session may create the job and the permission
// that was checked. The permission is nil if jobs of this type can't be created through the API.
func (a *App) SessionHasPermissionToCreateJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	switch job.Type {
	case model.JobTypeAccessControlTeamSync:
		return a.sessionHasPermissionToTeamSyncJob(session, job)
	case model.JobTypeAccessControlSync:
		// Allow system admins to create access control sync jobs
		hasSystemPermission := a.SessionHasPermissionTo(session, model.PermissionManageSystem)
		if hasSystemPermission {
			return true, model.PermissionManageSystem
		}

		// For channel admins, check if they have permission for the specific channel/policy
		channelID := a.getChannelIDFromJobData(job.Data)
		if channelID != "" {
			// Check specific channel permission
			ctx := request.EmptyContext(a.Srv().Log())
			hasChannelPermission, _ := a.HasPermissionToChannel(ctx, session.UserId, channelID, model.PermissionManageChannelAccessRules)
			if hasChannelPermission {
				return true, model.PermissionManageChannelAccessRules
			}
		}

		// Check team admin permission. This is needed for jobs that are scoped to a team but don't specify a channel (i.e. team-level syncs).
		teamID, hasTeamID := job.Data["team_id"]
		if hasTeamID && teamID != "" && model.IsValidId(teamID) && job.Data["policy_id"] == "" {
			if a.SessionHasPermissionToTeam(session, teamID, model.PermissionManageTeamAccessRules) {
				return true, model.PermissionManageTeamAccessRules
			}
		}

		// Check team admin permission for policy-scoped syncs (e.g. triggered after policy creation).
		// Verify the team admin owns the policy via ValidateTeamAdminPolicyOwnership.
		policyID, hasPolicyID := job.Data["policy_id"]
		if hasPolicyID && policyID != "" && model.IsValidId(policyID) && hasTeamID && teamID != "" && model.IsValidId(teamID) {
			if a.SessionHasPermissionToTeam(session, teamID, model.PermissionManageTeamAccessRules) {
				ctx := request.EmptyContext(a.Srv().Log())
				if owned, appErr := a.ValidateTeamAdminPolicyOwnership(ctx, teamID, policyID); appErr == nil && owned {
					return true, model.PermissionManageTeamAccessRules
				}
			}
		}

		return false, model.PermissionManageSystem
	}

	return a.sessionHasJobPermission(session, jobPermissions[job.Type].create)
}

// SessionHasPermissionToManageJob returns whether the session may manage the job and the permission
// that was checked. The permission is nil for unknown job types.
func (a *App) SessionHasPermissionToManageJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	if job.Type == model.JobTypeAccessControlTeamSync {
		return a.sessionHasPermissionToTeamSyncJob(session, job)
	}

	return a.sessionHasJobPermission(session, jobPermissions[job.Type].manage)
}

// SessionHasPermissionToCancelJob returns whether the session may cancel the job and the permission
// that was checked. Cancelling requires the create permission, or the manage permission for job types
// that can't be created through the API. The permission is nil for unknown job types.
func (a *App) SessionHasPermissionToCancelJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	if hasPermission, permission := a.SessionHasPermissionToCreateJob(session, job); permission != nil {
		return hasPermission, permission
	}

	return a.SessionHasPermissionToManageJob(session, job)
}

// SessionHasPermissionToReadJob returns whether the session may read jobs of the type and the permission
// that was checked. The permission is nil for unknown job types.
func (a *App) SessionHasPermissionToReadJob(session model.Session, jobType string) (bool, *model.Permission) {
	if jobType == model.JobTypeAccessControlTeamSync {
		if a.SessionHasPermissionTo(session, model.PermissionManageSystem) {
			return true, model.PermissionManageSystem
		}
		return a.SessionHasPermissionTo(session, model.PermissionManageTeamAccessRules), model.PermissionManageTeamAccessRules
	}

	return a.sessionHasJobPermission(session, jobPermissions[jobType].read)
}

// sessionHasPermissionToTeamSyncJob checks create and manage access to an access control team sync job.
// Team-type policies use the team ID as the policy ID, so a team admin may act on their own team's policy.
func (a *App) sessionHasPermissionToTeamSyncJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	if a.SessionHasPermissionTo(session, model.PermissionManageSystem) {
		return true, model.PermissionManageSystem
	}
	if policyID, ok := job.Data["policy_id"]; ok && policyID != "" && model.IsValidId(policyID) {
		if a.SessionHasPermissionToTeam(session, policyID, model.PermissionManageTeamAccessRules) {
			return true, model.PermissionManageTeamAccessRules
		}
	}
	return false, model.PermissionManageSystem
}

func (a *App) sessionHasJobPermission(session model.Session, permission *model.Permission) (bool, *model.Permission) {
	if permission == nil {
		return false, nil
	}

	return a.SessionHasPermissionTo(session, permission), permission
}
