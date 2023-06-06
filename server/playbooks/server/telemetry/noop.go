// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
)

// NoopTelemetry satisfies the Telemetry interface with no-op implementations.
type NoopTelemetry struct {
}

// Enable does nothing, returning always nil.
func (t *NoopTelemetry) Enable() error {
	return nil
}

// Disable does nothing, returning always nil.
func (t *NoopTelemetry) Disable() error {
	return nil
}

// Page does nothing
func (t *NoopTelemetry) Page(name app.TelemetryPage, properties map[string]interface{}) {
}

// Track does nothing
func (t *NoopTelemetry) Track(name app.TelemetryTrack, properties map[string]interface{}) {
}

// CreatePlaybookRun does nothing
func (t *NoopTelemetry) CreatePlaybookRun(*app.PlaybookRun, string, bool) {
}

// EndPlaybookRun does nothing
func (t *NoopTelemetry) FinishPlaybookRun(*app.PlaybookRun, string) {
}

// RestorePlaybookRun does nothing
func (t *NoopTelemetry) RestorePlaybookRun(*app.PlaybookRun, string) {
}

// RestartPlaybookRun does nothing
func (t *NoopTelemetry) RestartPlaybookRun(*app.PlaybookRun, string) {
}

// UpdateStatus does nothing
func (t *NoopTelemetry) UpdateStatus(*app.PlaybookRun, string) {
}

// FrontendTelemetryForPlaybookRun does nothing
func (t *NoopTelemetry) FrontendTelemetryForPlaybookRun(*app.PlaybookRun, string, string) {
}

// AddPostToTimeline does nothing
func (t *NoopTelemetry) AddPostToTimeline(*app.PlaybookRun, string) {
}

// RemoveTimelineEvent does nothing
func (t *NoopTelemetry) RemoveTimelineEvent(*app.PlaybookRun, string) {
}

// AddTask does nothing.
func (t *NoopTelemetry) AddTask(string, string, app.ChecklistItem) {
}

// RemoveTask does nothing.
func (t *NoopTelemetry) RemoveTask(string, string, app.ChecklistItem) {
}

// RenameTask does nothing.
func (t *NoopTelemetry) RenameTask(string, string, app.ChecklistItem) {
}

// SkipChecklist does nothing.
func (t *NoopTelemetry) SkipChecklist(string, string, app.Checklist) {
}

// RestoreChecklist does nothing.
func (t *NoopTelemetry) RestoreChecklist(string, string, app.Checklist) {
}

// SkipTask does nothing.
func (t *NoopTelemetry) SkipTask(string, string, app.ChecklistItem) {
}

// RestoreTask does nothing.
func (t *NoopTelemetry) RestoreTask(string, string, app.ChecklistItem) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(string, string, app.ChecklistItem, bool) {
}

// SetAssignee does nothing.
func (t *NoopTelemetry) SetAssignee(string, string, app.ChecklistItem) {
}

// MoveChecklist does nothing.
func (t *NoopTelemetry) MoveChecklist(string, string, app.Checklist) {
}

// MoveTask does nothing.
func (t *NoopTelemetry) MoveTask(string, string, app.ChecklistItem) {
}

// CreatePlaybook does nothing.
func (t *NoopTelemetry) CreatePlaybook(app.Playbook, string) {
}

// ImportPlaybook does nothing.
func (t *NoopTelemetry) ImportPlaybook(app.Playbook, string) {
}

// UpdatePlaybook does nothing.
func (t *NoopTelemetry) UpdatePlaybook(app.Playbook, string) {
}

// DeletePlaybook does nothing.
func (t *NoopTelemetry) DeletePlaybook(app.Playbook, string) {
}

// RestorePlaybook does nothing either.
func (t *NoopTelemetry) RestorePlaybook(app.Playbook, string) {
}

// ChangeOwner does nothing
func (t *NoopTelemetry) ChangeOwner(*app.PlaybookRun, string) {
}

// RunTaskSlashCommand does nothing
func (t *NoopTelemetry) RunTaskSlashCommand(string, string, app.ChecklistItem) {
}

// AddChecklist does nothing
func (t *NoopTelemetry) AddChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

// RemoveChecklist does nothing
func (t *NoopTelemetry) RemoveChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

// RenameChecklist does nothing
func (t *NoopTelemetry) RenameChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

func (t *NoopTelemetry) UpdateRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

func (t *NoopTelemetry) PublishRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

// StartTrial does nothing.
func (t *NoopTelemetry) StartTrial(userID string, action string) {
}

// NotifyAdmins does nothing.
func (t *NoopTelemetry) NotifyAdmins(userID string, action string) {
}

// FrontendTelemetryForPlaybook does nothing.
func (t *NoopTelemetry) FrontendTelemetryForPlaybook(playbook app.Playbook, userID, action string) {
}

// FrontendTelemetryForPlaybookTemplate does nothing.
func (t *NoopTelemetry) FrontendTelemetryForPlaybookTemplate(templateName string, userID, action string) {
}

// ChangeDigestSettings does nothing
func (t *NoopTelemetry) ChangeDigestSettings(userID string, old app.DigestNotificationSettings, new app.DigestNotificationSettings) {
}

// Follow tracks userID following a playbook run.
func (t *NoopTelemetry) Follow(playbookRun *app.PlaybookRun, userID string) {
}

// Unfollow tracks userID following a playbook run.
func (t *NoopTelemetry) Unfollow(playbookRun *app.PlaybookRun, userID string) {
}

// AutoFollowPlaybook tracks the auto-follow of a playbook.
func (t *NoopTelemetry) AutoFollowPlaybook(playbook app.Playbook, userID string) {
}

// AutoUnfollowPlaybook tracks the auto-unfollow of a playbook.
func (t *NoopTelemetry) AutoUnfollowPlaybook(playbook app.Playbook, userID string) {
}

// RunChannelAction does nothing
func (t *NoopTelemetry) RunChannelAction(action app.GenericChannelAction, userID string) {
}

// UpdateChannelAction does nothing
func (t *NoopTelemetry) UpdateChannelAction(action app.GenericChannelAction, userID string) {
}

// RunAction does nothing
func (t *NoopTelemetry) RunAction(playbookRun *app.PlaybookRun, userID, triggerType, actionType string, numBroadcasts int) {
}

// FavoriteItem does nothing
func (t *NoopTelemetry) FavoriteItem(item app.CategoryItem, userID string) {
}

// UnfavoriteItem does nothing
func (t *NoopTelemetry) UnfavoriteItem(item app.CategoryItem, userID string) {
}
