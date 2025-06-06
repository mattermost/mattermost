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

type ContentFlaggingSettings struct {
	NotificationSettings *ContentFlaggingNotificationSettings
}

func (cfs *ContentFlaggingSettings) SetDefault() {
	if cfs.NotificationSettings == nil {
		cfs.NotificationSettings = &ContentFlaggingNotificationSettings{
			EventTargetMapping: make(map[ContentFlaggingEvent][]NotificationTarget),
		}
	}

	cfs.NotificationSettings.SetDefault()
}
