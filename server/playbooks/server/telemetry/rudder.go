// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"sync"

	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"

	"github.com/pkg/errors"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend.
type RudderTelemetry struct {
	client        rudder.Client
	diagnosticID  string
	pluginVersion string
	serverVersion string
	writeKey      string
	dataPlaneURL  string
	enabled       bool
	mutex         sync.RWMutex
}

// Unique strings that identify each of the tracked events
const (
	eventPlaybookRun               = "incident"
	actionCreate                   = "create"
	actionImport                   = "import"
	actionEnd                      = "end"
	actionRestart                  = "restart"
	actionChangeOwner              = "change_commander"
	actionUpdateStatus             = "update_status"
	actionAddTimelineEventFromPost = "add_timeline_event_from_post"
	actionUpdateRetrospective      = "update_retrospective"
	actionPublishRetrospective     = "publish_retrospective"
	actionRemoveTimelineEvent      = "remove_timeline_event"
	actionFollow                   = "follow"
	actionUnfollow                 = "unfollow"

	eventTasks                = "tasks"
	actionAddTask             = "add_task"
	actionRemoveTask          = "remove_task"
	actionRenameTask          = "rename_task"
	actionSkipTask            = "skip_task"
	actionRestoreTask         = "restore_task"
	actionModifyTaskState     = "modify_task_state"
	actionMoveTask            = "move_task"
	actionSetAssigneeForTask  = "set_assignee_for_task"
	actionRunTaskSlashCommand = "run_task_slash_command"

	eventChecklists        = "checklists"
	actionAddChecklist     = "add_checklist"
	actionRemoveChecklist  = "remove_checklist"
	actionRenameChecklist  = "rename_checklist"
	actionMoveChecklist    = "move_checklist"
	actionSkipChecklist    = "skip_checklist"
	actionRestoreChecklist = "restore_checklist"

	eventPlaybook      = "playbook"
	actionUpdate       = "update"
	actionDelete       = "delete"
	actionRestore      = "restore"
	actionAutoFollow   = "auto_follow"
	actionAutoUnfollow = "auto_unfollow"

	eventFrontend = "frontend"

	eventNotifyAdmins = "notify_admins"

	eventStartTrial = "start_trial"

	// telemetryKeyPlaybookRunID records the legacy name used to identify a playbook run via telemetry.
	telemetryKeyPlaybookRunID = "IncidentID"

	eventSettings = "settings"
	actionDigest  = "digest"

	eventChannelAction        = "channel_action"
	actionRunChannelAction    = "run_channel_action"
	actionChannelActionUpdate = "update_channel_action"

	eventRunAction  = "playbookrun_action"
	actionRunAction = "run_playbookrun_action"

	eventSidebarCategory     = "lhs_category"
	actionFavoriteRun        = "favorite_run"
	actionUnfavoriteRun      = "unfavorite_run"
	actionFavoritePlaybook   = "favorite_playbook"
	actionUnfavoritePlaybook = "unfavorite_playbook"
)

// Migrated
// actionRunActionsUpdate = "update_playbookrun_actions" => playbookrun_update_actions

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID. The
// version of the server is also sent with every event tracked.
// If either diagnosticID or serverVersion are empty, an error is returned.
func NewRudder(dataPlaneURL, writeKey, diagnosticID, serverVersion string) (*RudderTelemetry, error) {
	if diagnosticID == "" {
		return nil, errors.New("diagnosticID should not be empty")
	}

	if serverVersion == "" {
		return nil, errors.New("serverVersion should not be empty")
	}

	client, err := rudder.NewWithConfig(writeKey, dataPlaneURL, rudder.Config{})
	if err != nil {
		return nil, err
	}

	// Continue to emit the pluginVersion for backwards compatibility, but just set it to
	// the server version given we're permanently part of the monorepo now.
	pluginVersion := serverVersion

	return &RudderTelemetry{
		client:        client,
		diagnosticID:  diagnosticID,
		pluginVersion: pluginVersion,
		serverVersion: serverVersion,
		writeKey:      writeKey,
		dataPlaneURL:  dataPlaneURL,
		enabled:       true,
	}, nil
}

// trackOld is the generic tracker for events to rudderstack that is backwards compatible with
// old events (string based instead of enum).
//
// All new and migrated events should use Track/Page instead. This should be removed after
// event migration is complete
func (t *RudderTelemetry) trackOld(name string, properties map[string]interface{}) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if !t.enabled {
		return
	}

	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	_ = t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      name,
		Properties: properties,
	})
}

// Track is the generic tracker for events to rudderstack
func (t *RudderTelemetry) Track(name app.TelemetryTrack, properties map[string]interface{}) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if !t.enabled {
		return
	}

	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	_ = t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      name.String(),
		Properties: properties,
	})
}

// Page is the generic tracker for pageviews to rudderstack
func (t *RudderTelemetry) Page(name app.TelemetryPage, properties map[string]interface{}) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if !t.enabled {
		return
	}

	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	_ = t.client.Enqueue(rudder.Page{
		UserId:     t.diagnosticID,
		Name:       name.String(),
		Properties: properties,
	})
}

func tasksWithDueDate(list app.Checklist) int {
	count := 0
	for _, item := range list.Items {
		if item.DueDate > 0 {
			count++
		}
	}
	return count
}

func playbookRunProperties(playbookRun *app.PlaybookRun, userID string) map[string]interface{} {
	totalChecklistItems := 0
	itemsWithDueDate := 0
	for _, checklist := range playbookRun.Checklists {
		totalChecklistItems += len(checklist.Items)
		itemsWithDueDate += tasksWithDueDate(checklist)
	}

	role := "viewer"
	for _, p := range playbookRun.ParticipantIDs {
		if p == userID {
			role = "participant"
			break
		}
	}

	return map[string]interface{}{
		"UserActualID":                         userID,
		"UserActualRole":                       role,
		telemetryKeyPlaybookRunID:              playbookRun.ID,
		"HasDescription":                       playbookRun.Summary != "",
		"CommanderUserID":                      playbookRun.OwnerUserID,
		"ReporterUserID":                       playbookRun.ReporterUserID,
		"TeamID":                               playbookRun.TeamID,
		"ChannelID":                            playbookRun.ChannelID,
		"CreateAt":                             playbookRun.CreateAt,
		"EndAt":                                playbookRun.EndAt,
		"DeleteAt":                             playbookRun.DeleteAt, //nolint
		"PostID":                               playbookRun.PostID,
		"PlaybookID":                           playbookRun.PlaybookID,
		"NumChecklists":                        len(playbookRun.Checklists),
		"TotalChecklistItems":                  totalChecklistItems,
		"ChecklistItemsWithDueDate":            itemsWithDueDate,
		"NumStatusPosts":                       len(playbookRun.StatusPosts),
		"CurrentStatus":                        playbookRun.CurrentStatus,
		"PreviousReminder":                     playbookRun.PreviousReminder,
		"NumTimelineEvents":                    len(playbookRun.TimelineEvents),
		"StatusUpdateBroadcastChannelsEnabled": playbookRun.StatusUpdateBroadcastChannelsEnabled,
		"StatusUpdateBroadcastWebhooksEnabled": playbookRun.StatusUpdateBroadcastWebhooksEnabled,
	}
}

// CreatePlaybookRun tracks the creation of the playbook run passed.
func (t *RudderTelemetry) CreatePlaybookRun(playbookRun *app.PlaybookRun, userID string, public bool) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionCreate
	properties["Public"] = public
	t.trackOld(eventPlaybookRun, properties)
}

// FinishPlaybookRun tracks the end of the playbook run passed.
func (t *RudderTelemetry) FinishPlaybookRun(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionEnd
	t.trackOld(eventPlaybookRun, properties)
}

// RestorePlaybookRun tracks the restoration of the playbook run.
func (t *RudderTelemetry) RestorePlaybookRun(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionRestore
	t.trackOld(eventPlaybookRun, properties)
}

// RestartPlaybookRun tracks the restart of the playbook run.
func (t *RudderTelemetry) RestartPlaybookRun(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionRestart
	t.trackOld(eventPlaybookRun, properties)
}

// ChangeOwner tracks changes in owner
func (t *RudderTelemetry) ChangeOwner(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionChangeOwner
	t.trackOld(eventPlaybookRun, properties)
}

func (t *RudderTelemetry) UpdateStatus(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionUpdateStatus
	properties["ReminderTimerSeconds"] = int(playbookRun.PreviousReminder)
	t.trackOld(eventPlaybookRun, properties)
}

func (t *RudderTelemetry) FrontendTelemetryForPlaybookRun(playbookRun *app.PlaybookRun, userID, action string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = action
	t.trackOld(eventFrontend, properties)
}

// AddPostToTimeline tracks userID creating a timeline event from a post.
func (t *RudderTelemetry) AddPostToTimeline(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionAddTimelineEventFromPost
	t.trackOld(eventPlaybookRun, properties)
}

// RemoveTimelineEvent tracks userID removing a timeline event.
func (t *RudderTelemetry) RemoveTimelineEvent(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionRemoveTimelineEvent
	t.trackOld(eventPlaybookRun, properties)
}

// Follow tracks userID following a playbook run.
func (t *RudderTelemetry) Follow(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionFollow
	t.trackOld(eventPlaybookRun, properties)
}

// Unfollow tracks userID following a playbook run.
func (t *RudderTelemetry) Unfollow(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionUnfollow
	t.trackOld(eventPlaybookRun, properties)
}

func taskProperties(playbookRunID, userID string, task app.ChecklistItem) map[string]interface{} {
	return map[string]interface{}{
		telemetryKeyPlaybookRunID: playbookRunID,
		"UserActualID":            userID,
		"TaskID":                  task.ID,
		"State":                   task.State,
		"AssigneeID":              task.AssigneeID,
		"HasCommand":              task.Command != "",
		"CommandLastRun":          task.CommandLastRun,
		"HasDescription":          task.Description != "",
		"HasDueDate":              task.DueDate > 0,
	}
}

// AddTask tracks the creation of a new checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) AddTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionAddTask
	t.trackOld(eventTasks, properties)
}

// RemoveTask tracks the removal of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RemoveTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRemoveTask
	t.trackOld(eventTasks, properties)
}

// RenameTask tracks the update of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RenameTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRenameTask
	t.trackOld(eventTasks, properties)
}

// SkipChecklist tracks the skipping of a checklist by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) SkipChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionSkipChecklist
	t.trackOld(eventChecklists, properties)
}

// RestoreChecklist tracks the restoring of a checklist by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RestoreChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionRestoreChecklist
	t.trackOld(eventChecklists, properties)
}

// SkipTask tracks the skipping of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) SkipTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionSkipTask
	t.trackOld(eventTasks, properties)
}

// RestoreTask tracks the restoring of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RestoreTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRestoreTask
	t.trackOld(eventTasks, properties)
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) ModifyCheckedState(playbookRunID, userID string, task app.ChecklistItem, wasOwner bool) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionModifyTaskState
	properties["NewState"] = task.State
	properties["WasCommander"] = wasOwner
	properties["WasAssignee"] = task.AssigneeID == userID
	t.trackOld(eventTasks, properties)
}

// SetAssignee tracks the changing of an assignee on an item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) SetAssignee(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionSetAssigneeForTask
	t.trackOld(eventTasks, properties)
}

// MoveTask tracks the movement of checklist items by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) MoveTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionMoveTask
	t.trackOld(eventTasks, properties)
}

// RunTaskSlashCommand tracks the execution of a slash command on a checklist item.
func (t *RudderTelemetry) RunTaskSlashCommand(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRunTaskSlashCommand
	t.trackOld(eventTasks, properties)
}

func checklistProperties(playbookRunID, userID string, checklist app.Checklist) map[string]interface{} {
	return map[string]interface{}{
		telemetryKeyPlaybookRunID: playbookRunID,
		"UserActualID":            userID,
		"ChecklistID":             checklist.ID,
		"ChecklistNumItems":       len(checklist.Items),
	}
}

// AddChecklist tracks the creation of a new checklist.
func (t *RudderTelemetry) AddChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionAddChecklist
	t.trackOld(eventChecklists, properties)
}

// RemoveChecklist tracks the removal of a checklist.
func (t *RudderTelemetry) RemoveChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionRemoveChecklist
	t.trackOld(eventChecklists, properties)
}

// RenameChecklist tracks the renaming of a checklist
func (t *RudderTelemetry) RenameChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionRenameChecklist
	t.trackOld(eventChecklists, properties)
}

// MoveChecklist tracks the movement of a checklist
func (t *RudderTelemetry) MoveChecklist(playbookRunID, userID string, checklist app.Checklist) {
	properties := checklistProperties(playbookRunID, userID, checklist)
	properties["Action"] = actionMoveChecklist
	t.trackOld(eventChecklists, properties)
}

func (t *RudderTelemetry) UpdateRetrospective(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionUpdateRetrospective
	t.trackOld(eventTasks, properties)
}

func (t *RudderTelemetry) PublishRetrospective(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionPublishRetrospective
	properties["NumMetrics"] = len(playbookRun.MetricsData)
	t.trackOld(eventTasks, properties)
}

func playbookProperties(playbook app.Playbook, userID string) map[string]interface{} {
	totalChecklistItems := 0
	totalChecklistItemsWithCommands := 0
	for _, checklist := range playbook.Checklists {
		totalChecklistItems += len(checklist.Items)
		for _, item := range checklist.Items {
			if item.Command != "" {
				totalChecklistItemsWithCommands++
			}
		}
	}

	return map[string]interface{}{
		"UserActualID":                userID,
		"PlaybookID":                  playbook.ID,
		"HasDescription":              playbook.Description != "",
		"TeamID":                      playbook.TeamID,
		"IsPublic":                    playbook.CreatePublicPlaybookRun,
		"CreateAt":                    playbook.CreateAt,
		"DeleteAt":                    playbook.DeleteAt,
		"NumChecklists":               len(playbook.Checklists),
		"TotalChecklistItems":         totalChecklistItems,
		"NumSlashCommands":            totalChecklistItemsWithCommands,
		"NumMembers":                  len(playbook.Members),
		"UsesReminderMessageTemplate": playbook.ReminderMessageTemplate != "",
		"ReminderTimerDefaultSeconds": playbook.ReminderTimerDefaultSeconds,
		"NumInvitedUserIDs":           len(playbook.InvitedUserIDs),
		"NumInvitedGroupIDs":          len(playbook.InvitedGroupIDs),
		"InviteUsersEnabled":          playbook.InviteUsersEnabled,
		"DefaultCommanderID":          playbook.DefaultOwnerID,
		"DefaultCommanderEnabled":     playbook.DefaultOwnerEnabled,
		"BroadcastChannelIDs":         playbook.BroadcastChannelIDs,
		"BroadcastEnabled":            playbook.BroadcastEnabled, //nolint
		"NumWebhookOnCreationURLs":    len(playbook.WebhookOnCreationURLs),
		"WebhookOnCreationEnabled":    playbook.WebhookOnCreationEnabled,
		"SignalAnyKeywordsEnabled":    playbook.SignalAnyKeywordsEnabled,
		"NumSignalAnyKeywords":        len(playbook.SignalAnyKeywords),
		"HasChannelNameTemplate":      playbook.ChannelNameTemplate != "",
		"NumMetrics":                  len(playbook.Metrics),
	}
}

func playbookTemplateProperties(templateName string, userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
		"TemplateName": templateName,
	}
}

// CreatePlaybook tracks the creation of a playbook.
func (t *RudderTelemetry) CreatePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionCreate
	t.trackOld(eventPlaybook, properties)
}

// ImportPlaybook tracks the import of a playbook.
func (t *RudderTelemetry) ImportPlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionImport
	t.trackOld(eventPlaybook, properties)
}

// UpdatePlaybook tracks the update of a playbook.
func (t *RudderTelemetry) UpdatePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionUpdate
	t.trackOld(eventPlaybook, properties)
}

// DeletePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) DeletePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionDelete
	t.trackOld(eventPlaybook, properties)
}

// RestorePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) RestorePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionRestore
	t.trackOld(eventPlaybook, properties)
}

// AutoFollowPlaybook tracks the auto-follow of a playbook.
func (t *RudderTelemetry) AutoFollowPlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionAutoFollow
	t.trackOld(eventPlaybook, properties)
}

// AutoUnfollowPlaybook tracks the auto-unfollow of a playbook.
func (t *RudderTelemetry) AutoUnfollowPlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionAutoUnfollow
	t.trackOld(eventPlaybook, properties)
}

// FrontendTelemetryForPlaybook tracks an event originating from the frontend
func (t *RudderTelemetry) FrontendTelemetryForPlaybook(playbook app.Playbook, userID, action string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = action
	t.trackOld(eventFrontend, properties)
}

// FrontendTelemetryForPlaybookTemplate tracks a playbook template event originating from the frontend
func (t *RudderTelemetry) FrontendTelemetryForPlaybookTemplate(templateName string, userID, action string) {
	properties := playbookTemplateProperties(templateName, userID)
	properties["Action"] = action
	t.trackOld(eventFrontend, properties)
}

func commonProperties(userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
	}
}

func (t *RudderTelemetry) StartTrial(userID string, action string) {
	properties := commonProperties(userID)
	properties["Action"] = action
	t.trackOld(eventStartTrial, properties)
}

func (t *RudderTelemetry) NotifyAdmins(userID string, action string) {
	properties := commonProperties(userID)
	properties["Action"] = action
	t.trackOld(eventNotifyAdmins, properties)
}

// Enable creates a new client to track all future events. It does nothing if
// a client is already enabled.
func (t *RudderTelemetry) Enable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if t.enabled {
		return nil
	}

	newClient, err := rudder.NewWithConfig(t.writeKey, t.dataPlaneURL, rudder.Config{})
	if err != nil {
		return errors.Wrap(err, "creating a new Rudder client in Enable failed")
	}

	t.client = newClient
	t.enabled = true
	return nil
}

// Disable disables telemetry for all future events. It does nothing if the
// client is already disabled.
func (t *RudderTelemetry) Disable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if !t.enabled {
		return nil
	}

	if err := t.client.Close(); err != nil {
		return errors.Wrap(err, "closing the Rudder client in Disable failed")
	}

	t.enabled = false
	return nil
}

func digestSettingsProperties(userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
	}
}

// ChangeDigestSettings tracks when a user changes one of the digest settings
func (t *RudderTelemetry) ChangeDigestSettings(userID string, old app.DigestNotificationSettings, new app.DigestNotificationSettings) {
	properties := digestSettingsProperties(userID)
	properties["Action"] = actionDigest
	properties["OldDisableDailyDigest"] = old.DisableDailyDigest
	properties["NewDisableDailyDigest"] = new.DisableDailyDigest
	properties["OldDisableWeeklyDigest"] = old.DisableWeeklyDigest
	properties["NewDisableWeeklyDigest"] = new.DisableWeeklyDigest
	t.trackOld(eventSettings, properties)
}

func channelActionProperties(action app.GenericChannelAction, userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
		"ChannelID":    action.ChannelID,
		"ActionType":   action.ActionType,
		"TriggerType":  action.TriggerType,
	}
}

func (t *RudderTelemetry) RunChannelAction(action app.GenericChannelAction, userID string) {
	properties := channelActionProperties(action, userID)
	properties["Action"] = actionRunChannelAction
	t.trackOld(eventChannelAction, properties)
}

// UpdateRunActions tracks actions settings update
func (t *RudderTelemetry) UpdateChannelAction(action app.GenericChannelAction, userID string) {
	properties := channelActionProperties(action, userID)
	properties["Action"] = actionChannelActionUpdate
	t.trackOld(eventChannelAction, properties)
}

func runActionProperties(playbookRun *app.PlaybookRun, userID, triggerType, actionType string, numBroadcasts int) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID":  userID,
		"ActionType":    actionType,
		"TriggerType":   triggerType,
		"NumBroadcasts": numBroadcasts,
		"PlaybookRunID": playbookRun.ID,
		"PlaybookID":    playbookRun.PlaybookID,
	}
}

// RunAction tracks the run actions, i.e., status broadcast action
func (t *RudderTelemetry) RunAction(playbookRun *app.PlaybookRun, userID, triggerType, actionType string, numBroadcasts int) {
	properties := runActionProperties(playbookRun, userID, triggerType, actionType, numBroadcasts)
	properties["Action"] = actionRunAction
	t.trackOld(eventRunAction, properties)
}

// FavoriteItem tracks run favoriting of an item. Item can be run or a playbook
func (t *RudderTelemetry) FavoriteItem(item app.CategoryItem, userID string) {
	properties := map[string]interface{}{}
	properties["UserActualID"] = userID
	switch item.Type {
	case app.PlaybookItemType:
		properties["PlaybookID"] = item.ItemID
		properties["Action"] = actionFavoritePlaybook
	case app.RunItemType:
		properties["PlaybookRunID"] = item.ItemID
		properties["Action"] = actionFavoriteRun
	}
	t.trackOld(eventSidebarCategory, properties)
}

// UnfavoriteItem tracks run unfavoriting of an item. Item can be run or a playbook
func (t *RudderTelemetry) UnfavoriteItem(item app.CategoryItem, userID string) {
	properties := map[string]interface{}{}
	properties["UserActualID"] = userID
	switch item.Type {
	case app.PlaybookItemType:
		properties["PlaybookID"] = item.ItemID
		properties["Action"] = actionUnfavoritePlaybook
	case app.RunItemType:
		properties["PlaybookRunID"] = item.ItemID
		properties["Action"] = actionUnfavoriteRun
	}
	t.trackOld(eventSidebarCategory, properties)
}
