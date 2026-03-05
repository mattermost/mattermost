// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"slices"
)

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

var ContentFlaggingDefaultReasons = []string{
	"Inappropriate content",
	"Sensitive data",
	"Security concern",
	"Harassment or abuse",
	"Spam or phishing",
}

type ContentFlaggingNotificationSettings struct {
	EventTargetMapping map[ContentFlaggingEvent][]NotificationTarget
}

func (cfs *ContentFlaggingNotificationSettings) SetDefaults() {
	if cfs.EventTargetMapping == nil {
		cfs.EventTargetMapping = make(map[ContentFlaggingEvent][]NotificationTarget)
	}

	if _, exists := cfs.EventTargetMapping[EventFlagged]; !exists {
		cfs.EventTargetMapping[EventFlagged] = []NotificationTarget{TargetReviewers}
	} else {
		// Ensure TargetReviewers is always included for EventFlagged
		if !slices.Contains(cfs.EventTargetMapping[EventFlagged], TargetReviewers) {
			cfs.EventTargetMapping[EventFlagged] = append(cfs.EventTargetMapping[EventFlagged], TargetReviewers)
		}
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
	// Reviewers must be notified when content is flagged
	// Disabling this option is not allowed in the UI, so this check is for safety and consistency.

	// Only valid events and targets are allowed
	for event, targets := range cfs.EventTargetMapping {
		if event != EventFlagged && event != EventAssigned && event != EventContentRemoved && event != EventContentDismissed {
			return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.invalid_event", nil, "", http.StatusBadRequest)
		}

		for _, target := range targets {
			if target != TargetReviewers && target != TargetAuthor && target != TargetReporter {
				return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.invalid_target", nil, fmt.Sprintf("target: %s", target), http.StatusBadRequest)
			}
		}
	}

	if len(cfs.EventTargetMapping[EventFlagged]) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", nil, "", http.StatusBadRequest)
	}

	// Search for the TargetReviewers in the EventFlagged event
	reviewerFound := slices.Contains(cfs.EventTargetMapping[EventFlagged], TargetReviewers)
	if !reviewerFound {
		return NewAppError("Config.IsValid", "model.config.is_valid.notification_settings.reviewer_flagged_notification_disabled", nil, "", http.StatusBadRequest)
	}

	return nil
}

type TeamReviewerSetting struct {
	Enabled     *bool
	ReviewerIds []string
}

type ReviewerSettings struct {
	CommonReviewers         *bool
	SystemAdminsAsReviewers *bool
	TeamAdminsAsReviewers   *bool
}

func (rs *ReviewerSettings) SetDefaults() {
	if rs.CommonReviewers == nil {
		rs.CommonReviewers = NewPointer(true)
	}

	if rs.SystemAdminsAsReviewers == nil {
		rs.SystemAdminsAsReviewers = NewPointer(false)
	}

	if rs.TeamAdminsAsReviewers == nil {
		rs.TeamAdminsAsReviewers = NewPointer(true)
	}
}

type AdditionalContentFlaggingSettings struct {
	Reasons                 *[]string
	ReporterCommentRequired *bool
	ReviewerCommentRequired *bool
	HideFlaggedContent      *bool
}

func (acfs *AdditionalContentFlaggingSettings) SetDefaults() {
	if acfs.Reasons == nil {
		acfs.Reasons = &ContentFlaggingDefaultReasons
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

type ContentFlaggingSettingsBase struct {
	EnableContentFlagging *bool
	NotificationSettings  *ContentFlaggingNotificationSettings
	AdditionalSettings    *AdditionalContentFlaggingSettings
}

func (cfs *ContentFlaggingSettingsBase) SetDefaults() {
	if cfs.EnableContentFlagging == nil {
		cfs.EnableContentFlagging = NewPointer(false)
	}

	if cfs.NotificationSettings == nil {
		cfs.NotificationSettings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: make(map[ContentFlaggingEvent][]NotificationTarget),
		}
	}

	if cfs.AdditionalSettings == nil {
		cfs.AdditionalSettings = &AdditionalContentFlaggingSettings{}
	}

	cfs.NotificationSettings.SetDefaults()
	cfs.AdditionalSettings.SetDefaults()
}

func (cfs *ContentFlaggingSettingsBase) IsValid() *AppError {
	if err := cfs.NotificationSettings.IsValid(); err != nil {
		return err
	}

	if err := cfs.AdditionalSettings.IsValid(); err != nil {
		return err
	}

	return nil
}

type ContentFlaggingSettings struct {
	ContentFlaggingSettingsBase
	ReviewerSettings *ReviewerSettings
}

func (cfs *ContentFlaggingSettings) SetDefaults() {
	cfs.ContentFlaggingSettingsBase.SetDefaults()

	if cfs.ReviewerSettings == nil {
		cfs.ReviewerSettings = &ReviewerSettings{}
	}

	cfs.ReviewerSettings.SetDefaults()
}

func (cfs *ContentFlaggingSettings) IsValid() *AppError {
	return cfs.ContentFlaggingSettingsBase.IsValid()
}

type ContentFlaggingReportingConfig struct {
	Reasons                   *[]string `json:"reasons"`
	ReporterCommentRequired   *bool     `json:"reporter_comment_required"`
	ReviewerCommentRequired   *bool     `json:"reviewer_comment_required"`
	NotifyReporterOnDismissal *bool     `json:"notify_reporter_on_dismissal,omitempty"`
	NotifyReporterOnRemoval   *bool     `json:"notify_reporter_on_removal,omitempty"`
}

type ReviewerIDsSettings struct {
	CommonReviewerIds    []string
	TeamReviewersSetting map[string]*TeamReviewerSetting
}

func (rs *ReviewerIDsSettings) SetDefaults() {
	if rs.CommonReviewerIds == nil {
		rs.CommonReviewerIds = []string{}
	}

	if rs.TeamReviewersSetting == nil {
		rs.TeamReviewersSetting = map[string]*TeamReviewerSetting{}
	}
}
