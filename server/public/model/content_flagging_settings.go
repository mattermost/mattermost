// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

type ContentFlaggingEvent string

const (
	EventFlagged          ContentFlaggingEvent = "flagged"
	EventAssigned         ContentFlaggingEvent = "assigned"
	EventContentRemoved   ContentFlaggingEvent = "removed"
	EventContentDismissed ContentFlaggingEvent = "dismissed"
)

type NotificationTarget string

const (
	TargetReviewers NotificationTarget = "reviewers"
	TargetAuthor    NotificationTarget = "author"
	TargetReporter  NotificationTarget = "reporter"
)

type ContentFlaggingNotificationSettings struct {
	EventTargetMapping map[ContentFlaggingEvent][]NotificationTarget
}

func (cfs *ContentFlaggingNotificationSettings) SetDefault() {
	if cfs.EventTargetMapping == nil {
		cfs.EventTargetMapping = make(map[ContentFlaggingEvent][]NotificationTarget)
	}

	if _, exists := cfs.EventTargetMapping[EventFlagged]; !exists {
		cfs.EventTargetMapping[EventFlagged] = []NotificationTarget{TargetReviewers}
	}

	if _, exists := cfs.EventTargetMapping[EventAssigned]; !exists {
		cfs.EventTargetMapping[EventAssigned] = []NotificationTarget{TargetReviewers}
	}

	if _, exists := cfs.EventTargetMapping[EventContentRemoved]; !exists {
		cfs.EventTargetMapping[EventContentRemoved] = []NotificationTarget{TargetReviewers, TargetAuthor, TargetReporter}
	}

	if _, exists := cfs.EventTargetMapping[EventContentDismissed]; !exists {
		cfs.EventTargetMapping[EventContentDismissed] = []NotificationTarget{TargetReviewers, TargetReporter}
	}
}

func (cfs *ContentFlaggingNotificationSettings) IsValid() *AppError {
	if cfs.EventTargetMapping[EventFlagged] == nil || len(cfs.EventTargetMapping[EventFlagged]) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", nil, "", http.StatusBadRequest)
	}

	reviewerFound := false
	for _, target := range cfs.EventTargetMapping[EventFlagged] {
		if target == TargetReviewers {
			reviewerFound = true
			break
		}
	}

	if !reviewerFound {
		return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", nil, "", http.StatusBadRequest)
	}

	return nil
}

type TeamReviewerSetting struct {
	Enabled     *bool
	ReviewerIds *[]string
}

type ReviewerSettings struct {
	CommonReviewers         *bool
	CommonReviewerIds       *[]string
	TeamReviewersSetting    *map[string]TeamReviewerSetting
	SystemAdminsAsReviewers *bool
	TeamAdminsAsReviewers   *bool
}

func (rs *ReviewerSettings) SetDefault() {
	if rs.CommonReviewers == nil {
		rs.CommonReviewers = NewPointer(true)
	}

	if rs.CommonReviewerIds == nil {
		rs.CommonReviewerIds = &[]string{}
	}

	if rs.TeamReviewersSetting == nil {
		rs.TeamReviewersSetting = &map[string]TeamReviewerSetting{}
	}

	if rs.SystemAdminsAsReviewers == nil {
		rs.SystemAdminsAsReviewers = NewPointer(false)
	}

	if rs.TeamAdminsAsReviewers == nil {
		rs.TeamAdminsAsReviewers = NewPointer(true)
	}
}

func (rs *ReviewerSettings) IsValid() *AppError {
	additionalReviewersEnabled := *rs.SystemAdminsAsReviewers || *rs.TeamAdminsAsReviewers

	// If common reviewers are enabled, there must be at least one specified reviewer, or additional viewers be specified
	if *rs.CommonReviewers && (rs.CommonReviewerIds == nil || len(*rs.CommonReviewerIds) == 0) && !additionalReviewersEnabled {
		return NewAppError("Config.IsValid", "model.config.is_valid.content_flagging.common_reviewers_not_set.app_error", nil, "", http.StatusBadRequest)
	}

	// if additional reviewers are specified, no extra validation is needed in team specific settings as
	// settings team reviewers keeping team feature disabled is valid, as well as
	// enabling team feature and not specified reviews is fine as well (since additional reviewers are set)
	if !additionalReviewersEnabled {
		for _, setting := range *rs.TeamReviewersSetting {
			if *setting.Enabled && (setting.ReviewerIds == nil || len(*setting.ReviewerIds) == 0) {
				return NewAppError("Config.IsValid", "model.config.is_valid.content_flagging.team_reviewers_not_set.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

type AdditionalContentFlaggingSettings struct {
	Reasons                 *[]string
	ReporterCommentRequired *bool
	ReviewerCommentRequired *bool
	HideFlaggedContent      *bool
}

func (acfs *AdditionalContentFlaggingSettings) SetDefault() {
	if acfs.Reasons == nil {
		acfs.Reasons = &[]string{
			"Inappropriate content",
			"Sensitive data",
			"Security concern",
			"Harassment or abuse",
			"Spam or phishing",
		}
	}

	if acfs.ReporterCommentRequired == nil {
		acfs.ReporterCommentRequired = NewPointer(true)
	}

	if acfs.ReviewerCommentRequired == nil {
		acfs.ReviewerCommentRequired = NewPointer(true)
	}

	if acfs.HideFlaggedContent == nil {
		acfs.HideFlaggedContent = NewPointer(true)
	}
}

func (acfs *AdditionalContentFlaggingSettings) IsValid() *AppError {
	if acfs.Reasons == nil || len(*acfs.Reasons) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.content_flagging.reasons_not_set.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

type ContentFlaggingSettings struct {
	EnableContentFlagging *bool
	ReviewerSettings      *ReviewerSettings
	NotificationSettings  *ContentFlaggingNotificationSettings
	AdditionalSettings    *AdditionalContentFlaggingSettings
}

func (cfs *ContentFlaggingSettings) SetDefault() {
	if cfs.EnableContentFlagging == nil {
		cfs.EnableContentFlagging = NewPointer(false)
	}

	if cfs.NotificationSettings == nil {
		cfs.NotificationSettings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: make(map[ContentFlaggingEvent][]NotificationTarget),
		}
	}

	if cfs.ReviewerSettings == nil {
		cfs.ReviewerSettings = &ReviewerSettings{}
	}

	if cfs.AdditionalSettings == nil {
		cfs.AdditionalSettings = &AdditionalContentFlaggingSettings{}
	}

	cfs.NotificationSettings.SetDefault()
	cfs.ReviewerSettings.SetDefault()
	cfs.AdditionalSettings.SetDefault()
}

func (cfs *ContentFlaggingSettings) IsValid() *AppError {
	if err := cfs.NotificationSettings.IsValid(); err != nil {
		return err
	}

	if err := cfs.ReviewerSettings.IsValid(); err != nil {
		return err
	}

	if err := cfs.AdditionalSettings.IsValid(); err != nil {
		return err
	}

	return nil
}
