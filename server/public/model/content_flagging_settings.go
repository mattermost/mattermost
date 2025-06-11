// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ContentFlaggingEvent string

const (
	EventFlagged          ContentFlaggingEvent = "flagged"
	EventAssigned                              = "assigned"
	EventContentRemoved                        = "removed"
	EventContentDismissed                      = "dismissed"
)

type NotificationTarget string

const (
	TargetReviewers NotificationTarget = "reviewers"
	TargetAuthor                       = "author"
	TargetReporter                     = "reporter"
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
		rs.TeamAdminsAsReviewers = NewPointer(false)
	}
}

type ContentFlaggingSettings struct {
	EnableContentFlagging *bool
	NotificationSettings  *ContentFlaggingNotificationSettings
	ReviewerSettings      *ReviewerSettings
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

	cfs.NotificationSettings.SetDefault()
	cfs.ReviewerSettings.SetDefault()
}
