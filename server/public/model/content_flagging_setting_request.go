package model

import (
	"net/http"
)

type ReviewSettingsRequest struct {
	ReviewerSettings
	ReviewerIDsSettings
}

func (rs *ReviewSettingsRequest) SetDefaults() {
	rs.ReviewerSettings.SetDefaults()
	rs.ReviewerIDsSettings.SetDefaults()
}

func (rs *ReviewSettingsRequest) IsValid() *AppError {
	additionalReviewersEnabled := *rs.SystemAdminsAsReviewers || *rs.TeamAdminsAsReviewers

	// If common reviewers are enabled, there must be at least one specified reviewer, or additional viewers be specified
	if *rs.CommonReviewers && len(rs.CommonReviewerIds) == 0 && !additionalReviewersEnabled {
		return NewAppError("Config.IsValid", "model.config.is_valid.content_flagging.common_reviewers_not_set.app_error", nil, "", http.StatusBadRequest)
	}

	// if Additional Reviewers are specified, no extra validation is needed in team specific settings as
	// settings team reviewers keeping team feature disabled is valid, as well as
	// enabling team feature and not specified reviews is fine as well (since Additional Reviewers are set)
	if !additionalReviewersEnabled {
		for _, setting := range rs.TeamReviewersSetting {
			if *setting.Enabled && len(setting.ReviewerIds) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.content_flagging.team_reviewers_not_set.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

type ContentFlaggingSettingsRequest struct {
	ContentFlaggingSettingsBase
	ReviewerSettings *ReviewSettingsRequest
}

func (cfs *ContentFlaggingSettingsRequest) SetDefaults() {
	cfs.ContentFlaggingSettingsBase.SetDefaults()

	if cfs.EnableContentFlagging == nil {
		cfs.EnableContentFlagging = NewPointer(false)
	}

	if cfs.NotificationSettings == nil {
		cfs.NotificationSettings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: make(map[ContentFlaggingEvent][]NotificationTarget),
		}
	}

	if cfs.ReviewerSettings == nil {
		cfs.ReviewerSettings = &ReviewSettingsRequest{}
	}

	if cfs.AdditionalSettings == nil {
		cfs.AdditionalSettings = &AdditionalContentFlaggingSettings{}
	}

	cfs.NotificationSettings.SetDefaults()
	cfs.ReviewerSettings.SetDefaults()
	cfs.AdditionalSettings.SetDefaults()
}

func (cfs *ContentFlaggingSettingsRequest) IsValid() *AppError {
	if appErr := cfs.ContentFlaggingSettingsBase.IsValid(); appErr != nil {
		return appErr
	}

	if appErr := cfs.ReviewerSettings.IsValid(); appErr != nil {
		return appErr
	}

	return nil
}
