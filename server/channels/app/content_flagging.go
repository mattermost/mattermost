// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/model"

func (a *App) GetReportingConfiguration() *model.ContentFlaggingReportingConfig {
	contentFlaggingSettings := a.Config().ContentFlaggingSettings

	return &model.ContentFlaggingReportingConfig{
		Reasons:                 contentFlaggingSettings.AdditionalSettings.Reasons,
		ReporterCommentRequired: contentFlaggingSettings.AdditionalSettings.ReporterCommentRequired,
	}
}

func (a *App) GetTeamPostReportingFeatureStatus(teamId string) bool {
	reviewerSettings := a.Config().ContentFlaggingSettings.ReviewerSettings

	hasCommonReviewers := reviewerSettings.CommonReviewers != nil && *reviewerSettings.CommonReviewers == true
	if hasCommonReviewers {
		return true
	}

	teamSettings, exist := (*reviewerSettings.TeamReviewersSetting)[teamId]
	if !exist || (teamSettings.Enabled != nil && !*teamSettings.Enabled) {
		return false
	}

	if teamSettings.ReviewerIds != nil && len(*teamSettings.ReviewerIds) > 0 {
		return true
	}

	hasAdditionalReviewers := (reviewerSettings.TeamAdminsAsReviewers != nil && *reviewerSettings.TeamAdminsAsReviewers == true) ||
		(reviewerSettings.SystemAdminsAsReviewers != nil && *reviewerSettings.SystemAdminsAsReviewers == true)

	return hasAdditionalReviewers
}
