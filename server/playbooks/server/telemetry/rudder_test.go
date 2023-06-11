// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"

	rudder "github.com/rudderlabs/analytics-go"
	"github.com/stretchr/testify/require"
)

var (
	diagnosticID       = "dummy_diagnostic_id"
	pluginVersion      = "dummy_plugin_version"
	serverVersion      = "dummy_server_version"
	dummyPlaybookRunID = "dummy_playbook_run_id"
	dummyUserID        = "dummy_user_id"
)

func TestNewRudder(t *testing.T) {
	r, err := NewRudder("dummy_key", "dummy_url", diagnosticID, serverVersion)
	require.Equal(t, r.diagnosticID, diagnosticID)
	require.Equal(t, r.serverVersion, serverVersion)
	require.NoError(t, err)
}

type rudderPayload struct {
	MessageID string
	SentAt    time.Time
	Batch     []struct {
		MessageID  string
		UserID     string
		Event      string
		Timestamp  time.Time
		Properties map[string]interface{}
	}
	Context struct {
		Library struct {
			Name    string
			Version string
		}
	}
}

func setupRudder(t *testing.T, data chan<- rudderPayload) (*RudderTelemetry, *httptest.Server) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var p rudderPayload
		err = json.Unmarshal(body, &p)
		require.NoError(t, err)

		data <- p
	}))

	writeKey := "dummy_key"
	client, err := rudder.NewWithConfig(writeKey, server.URL, rudder.Config{
		BatchSize: 1,
		Interval:  1 * time.Millisecond,
		Verbose:   true,
	})
	require.NoError(t, err)

	return &RudderTelemetry{
		client:        client,
		diagnosticID:  diagnosticID,
		pluginVersion: pluginVersion,
		serverVersion: serverVersion,
		writeKey:      writeKey,
		dataPlaneURL:  server.URL,
		enabled:       true,
	}, server
}

var dummyPlaybookRun = &app.PlaybookRun{
	ID:             "id",
	Name:           "name",
	Summary:        "description",
	OwnerUserID:    "owner_user_id",
	ReporterUserID: "reporter_user_id",
	TeamID:         "team_id",
	ChannelID:      "channel_id_1",
	CreateAt:       1234,
	EndAt:          5678,
	DeleteAt:       9999,
	PostID:         "post_id",
	PlaybookID:     "playbookID1",
	ParticipantIDs: []string{"owner_user_id", "dummy_user_id"},
	Type:           app.RunTypePlaybook,
	Checklists: []app.Checklist{
		{
			Title: "Checklist",
			Items: []app.ChecklistItem{
				{
					ID:               "task_id_1",
					Title:            "Test Item",
					State:            "",
					StateModified:    1234,
					AssigneeID:       "assignee_id",
					AssigneeModified: 5678,
					Command:          "command",
					CommandLastRun:   100000,
					Description:      "description",
					DueDate:          100000000000,
				},
			},
		},
		{
			Title: "Checklist 2",
			Items: []app.ChecklistItem{
				{Title: "Test Item 2"},
				{Title: "Test Item 3"},
			},
		},
	},
	StatusPosts: []app.StatusPost{
		{ID: "status_post_1"},
		{ID: "status_post_2"},
	},
	PreviousReminder: 5 * time.Second,
	TimelineEvents: []app.TimelineEvent{
		{ID: "timeline_event_1"},
		{ID: "timeline_event_2"},
		{ID: "timeline_event_3"},
	},
}

var dummyTask = dummyPlaybookRun.Checklists[0].Items[0]

func assertPayload(t *testing.T, actual rudderPayload, expectedEvent string, expectedAction string) {
	t.Helper()

	playbookRunFromProperties := func(properties map[string]interface{}) *app.PlaybookRun {
		require.Contains(t, properties, telemetryKeyPlaybookRunID)
		require.Contains(t, properties, "HasDescription")
		require.Contains(t, properties, "CommanderUserID")
		require.Contains(t, properties, "ReporterUserID")
		require.Contains(t, properties, "TeamID")
		require.Contains(t, properties, "ChannelID")
		require.Contains(t, properties, "CreateAt")
		require.Contains(t, properties, "EndAt")
		require.Contains(t, properties, "DeleteAt")
		require.Contains(t, properties, "PostID")
		require.Contains(t, properties, "PlaybookID")
		require.Contains(t, properties, "NumChecklists")
		require.Contains(t, properties, "TotalChecklistItems")
		require.Contains(t, properties, "NumStatusPosts")
		require.Contains(t, properties, "CurrentStatus")
		require.Contains(t, properties, "PreviousReminder")
		require.Contains(t, properties, "NumTimelineEvents")

		return &app.PlaybookRun{
			ID:               properties[telemetryKeyPlaybookRunID].(string),
			Name:             dummyPlaybookRun.Name, // not included in the tracked event
			Summary:          dummyPlaybookRun.Summary,
			OwnerUserID:      properties["CommanderUserID"].(string),
			ReporterUserID:   properties["ReporterUserID"].(string),
			TeamID:           properties["TeamID"].(string),
			CreateAt:         int64(properties["CreateAt"].(float64)),
			EndAt:            int64(properties["EndAt"].(float64)),
			DeleteAt:         int64(properties["DeleteAt"].(float64)),
			ChannelID:        "channel_id_1",
			PostID:           properties["PostID"].(string),
			PlaybookID:       dummyPlaybookRun.PlaybookID,
			Checklists:       dummyPlaybookRun.Checklists, // not included as self in tracked event
			StatusPosts:      dummyPlaybookRun.StatusPosts,
			PreviousReminder: time.Duration((properties["PreviousReminder"]).(float64)),
			TimelineEvents:   dummyPlaybookRun.TimelineEvents,
			ParticipantIDs:   []string{"owner_user_id", "dummy_user_id"},
			Type:             app.RunTypePlaybook,
		}
	}

	require.Len(t, actual.Batch, 1)
	require.Equal(t, diagnosticID, actual.Batch[0].UserID)
	require.Equal(t, expectedEvent, actual.Batch[0].Event)

	properties := actual.Batch[0].Properties
	require.Equal(t, expectedAction, properties["Action"])
	require.Contains(t, properties, "ServerVersion")
	require.Equal(t, properties["ServerVersion"], serverVersion)
	require.Contains(t, properties, "PluginVersion")
	require.Equal(t, properties["PluginVersion"], pluginVersion)

	if expectedEvent == eventPlaybookRun && expectedAction == actionCreate {
		require.Contains(t, properties, "Public")
	}

	if expectedEvent == eventPlaybookRun && (expectedAction == actionCreate || expectedAction == actionEnd || expectedAction == actionRestore) {
		require.Equal(t, dummyPlaybookRun, playbookRunFromProperties(properties))
	} else {
		require.Contains(t, properties, telemetryKeyPlaybookRunID)
		require.Equal(t, properties[telemetryKeyPlaybookRunID], dummyPlaybookRunID)
		require.Contains(t, properties, "UserActualID")
		require.Equal(t, properties["UserActualID"], dummyUserID)
	}
}

func TestRudderTelemetry(t *testing.T) {
	data := make(chan rudderPayload)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	for name, tc := range map[string]struct {
		ExpectedEvent  string
		ExpectedAction string
		FuncToTest     func()
	}{
		"create playbook run": {eventPlaybookRun, actionCreate, func() {
			rudderClient.CreatePlaybookRun(dummyPlaybookRun, dummyUserID, true)
		}},
		"end playbook run": {eventPlaybookRun, actionEnd, func() {
			rudderClient.FinishPlaybookRun(dummyPlaybookRun, dummyUserID)
		}},
		"restore playbook run": {eventPlaybookRun, actionRestore, func() {
			rudderClient.RestorePlaybookRun(dummyPlaybookRun, dummyUserID)
		}},
		"add checklist item": {eventTasks, actionAddTask, func() {
			rudderClient.AddTask(dummyPlaybookRunID, dummyUserID, dummyTask)
		}},
		"remove checklist item": {eventTasks, actionRemoveTask, func() {
			rudderClient.RemoveTask(dummyPlaybookRunID, dummyUserID, dummyTask)
		}},
		"rename checklist item": {eventTasks, actionRenameTask, func() {
			rudderClient.RenameTask(dummyPlaybookRunID, dummyUserID, dummyTask)
		}},
		"modify checked checklist item": {eventTasks, actionModifyTaskState, func() {
			rudderClient.ModifyCheckedState(dummyPlaybookRunID, dummyUserID, dummyTask, true)
		}},
		"move checklist item": {eventTasks, actionMoveTask, func() {
			rudderClient.MoveTask(dummyPlaybookRunID, dummyUserID, dummyTask)
		}},
	} {
		t.Run(name, func(t *testing.T) {
			tc.FuncToTest()

			select {
			case payload := <-data:
				assertPayload(t, payload, tc.ExpectedEvent, tc.ExpectedAction)
			case <-time.After(time.Second * 1):
				require.Fail(t, "Did not receive Event message")
			}
		})
	}
}

func TestDisableTelemetry(t *testing.T) {
	t.Run("disable client", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		err := rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreatePlaybookRun(dummyPlaybookRun, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("disable client is idempotent", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		err := rudderClient.Disable()
		require.NoError(t, err)

		err = rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreatePlaybookRun(dummyPlaybookRun, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("re-disable client", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		// Make sure it's enabled before disabling
		err := rudderClient.Enable()
		require.NoError(t, err)

		err = rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreatePlaybookRun(dummyPlaybookRun, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("re-enable client", func(t *testing.T) {
		// The default timeout in a new Rudder client is 5s. When enabling a
		// disabled client, the config is reset to these defaults.
		// We could replace the client directly in the test, but that kind of
		// defeats the purpose of testing Enable.
		if testing.Short() {
			t.Skip("Skipping re-enable client test: takes at least 6 seconds")
		}

		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		// Make sure it's disabled before enabling
		err := rudderClient.Disable()
		require.NoError(t, err)

		err = rudderClient.Enable()
		require.NoError(t, err)

		rudderClient.CreatePlaybookRun(dummyPlaybookRun, dummyUserID, true)

		select {
		case payload := <-data:
			assertPayload(t, payload, eventPlaybookRun, actionCreate)
		case <-time.After(time.Second * 6):
			require.Fail(t, "Did not receive Event message")
		}
	})
}

func TestPlaybookProperties(t *testing.T) {
	var dummyPlaybook = app.Playbook{
		ID:                      "id",
		Title:                   "title",
		Description:             "description",
		TeamID:                  "team_id",
		CreatePublicPlaybookRun: true,
		CreateAt:                1234,
		DeleteAt:                9999,
		NumStages:               2,
		NumSteps:                3,
		Checklists: []app.Checklist{
			{
				Title: "Checklist",
				Items: []app.ChecklistItem{
					{
						ID:               "task_id_1",
						Title:            "Test Item",
						State:            "",
						StateModified:    1234,
						AssigneeID:       "assignee_id",
						AssigneeModified: 5678,
						Command:          "command",
						CommandLastRun:   100000,
						Description:      "description",
					},
				},
			},
			{
				Title: "Checklist 2",
				Items: []app.ChecklistItem{
					{Title: "Test Item 2"},
					{Title: "Test Item 3"},
				},
			},
		},
		Members:                     []app.PlaybookMember{{}, {}},
		ReminderMessageTemplate:     "reminder_message_template",
		ReminderTimerDefaultSeconds: 1000,
		InvitedUserIDs:              []string{"invited_user_id_1", "invited_user_id_2"},
		InvitedGroupIDs:             []string{"invited_group_id_1", "invited_group_id_2"},
		InviteUsersEnabled:          true,
		DefaultOwnerID:              "default_owner_id",
		DefaultOwnerEnabled:         false,
		BroadcastChannelIDs:         []string{"broadcast_channel_id"},
		BroadcastEnabled:            true,
		WebhookOnCreationURLs:       []string{"webhook_on_creation_url_1", "webhook_on_creation_url_2"},
		WebhookOnCreationEnabled:    false,
		SignalAnyKeywordsEnabled:    true,
		SignalAnyKeywords:           []string{"SEV1, SEV2"},
		ChannelNameTemplate:         "channel_name_template",
		Metrics: []app.PlaybookMetricConfig{{
			ID:          "metricid",
			PlaybookID:  "id",
			Title:       "metric 1",
			Description: "this is a descr",
			Type:        "Duration",
			Target:      null.IntFrom(12345),
		}},
	}

	properties := playbookProperties(dummyPlaybook, dummyUserID)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":                dummyUserID,
		"PlaybookID":                  dummyPlaybook.ID,
		"HasDescription":              true,
		"TeamID":                      dummyPlaybook.TeamID,
		"IsPublic":                    dummyPlaybook.CreatePublicPlaybookRun,
		"CreateAt":                    dummyPlaybook.CreateAt,
		"DeleteAt":                    dummyPlaybook.DeleteAt,
		"NumChecklists":               len(dummyPlaybook.Checklists),
		"TotalChecklistItems":         3,
		"NumSlashCommands":            1,
		"NumMembers":                  2,
		"UsesReminderMessageTemplate": true,
		"ReminderTimerDefaultSeconds": dummyPlaybook.ReminderTimerDefaultSeconds,
		"NumInvitedUserIDs":           len(dummyPlaybook.InvitedUserIDs),
		"NumInvitedGroupIDs":          len(dummyPlaybook.InvitedGroupIDs),
		"InviteUsersEnabled":          dummyPlaybook.InviteUsersEnabled,
		"DefaultCommanderID":          dummyPlaybook.DefaultOwnerID,
		"DefaultCommanderEnabled":     dummyPlaybook.DefaultOwnerEnabled,
		"BroadcastChannelIDs":         dummyPlaybook.BroadcastChannelIDs,
		"BroadcastEnabled":            dummyPlaybook.BroadcastEnabled, //nolint
		"NumWebhookOnCreationURLs":    2,
		"WebhookOnCreationEnabled":    dummyPlaybook.WebhookOnCreationEnabled,
		"SignalAnyKeywordsEnabled":    dummyPlaybook.SignalAnyKeywordsEnabled,
		"NumSignalAnyKeywords":        len(dummyPlaybook.SignalAnyKeywords),
		"HasChannelNameTemplate":      true,
		"NumMetrics":                  1,
	}

	require.Equal(t, expectedProperties, properties)
}

func TestPlaybookRunPropertiesParticipant(t *testing.T) {
	properties := playbookRunProperties(dummyPlaybookRun, dummyUserID)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":                         dummyUserID,
		"UserActualRole":                       "participant",
		telemetryKeyPlaybookRunID:              dummyPlaybookRun.ID,
		"HasDescription":                       true,
		"CommanderUserID":                      dummyPlaybookRun.OwnerUserID,
		"ReporterUserID":                       dummyPlaybookRun.ReporterUserID,
		"TeamID":                               dummyPlaybookRun.TeamID,
		"ChannelID":                            dummyPlaybookRun.ChannelID,
		"CreateAt":                             dummyPlaybookRun.CreateAt,
		"EndAt":                                dummyPlaybookRun.EndAt,
		"DeleteAt":                             dummyPlaybookRun.DeleteAt, //nolint
		"PostID":                               dummyPlaybookRun.PostID,
		"PlaybookID":                           dummyPlaybookRun.PlaybookID,
		"NumChecklists":                        2,
		"TotalChecklistItems":                  3,
		"ChecklistItemsWithDueDate":            1,
		"NumStatusPosts":                       2,
		"CurrentStatus":                        dummyPlaybookRun.CurrentStatus,
		"PreviousReminder":                     dummyPlaybookRun.PreviousReminder,
		"NumTimelineEvents":                    len(dummyPlaybookRun.TimelineEvents),
		"StatusUpdateBroadcastChannelsEnabled": dummyPlaybookRun.StatusUpdateBroadcastChannelsEnabled,
		"StatusUpdateBroadcastWebhooksEnabled": dummyPlaybookRun.StatusUpdateBroadcastWebhooksEnabled,
	}

	require.Equal(t, expectedProperties, properties)
}

func TestPlaybookRunPropertiesViewer(t *testing.T) {
	properties := playbookRunProperties(dummyPlaybookRun, "other_user_id")

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":                         "other_user_id",
		"UserActualRole":                       "viewer",
		telemetryKeyPlaybookRunID:              dummyPlaybookRun.ID,
		"HasDescription":                       true,
		"CommanderUserID":                      dummyPlaybookRun.OwnerUserID,
		"ReporterUserID":                       dummyPlaybookRun.ReporterUserID,
		"TeamID":                               dummyPlaybookRun.TeamID,
		"ChannelID":                            dummyPlaybookRun.ChannelID,
		"CreateAt":                             dummyPlaybookRun.CreateAt,
		"EndAt":                                dummyPlaybookRun.EndAt,
		"DeleteAt":                             dummyPlaybookRun.DeleteAt, //nolint
		"PostID":                               dummyPlaybookRun.PostID,
		"PlaybookID":                           dummyPlaybookRun.PlaybookID,
		"NumChecklists":                        2,
		"TotalChecklistItems":                  3,
		"ChecklistItemsWithDueDate":            1,
		"NumStatusPosts":                       2,
		"CurrentStatus":                        dummyPlaybookRun.CurrentStatus,
		"PreviousReminder":                     dummyPlaybookRun.PreviousReminder,
		"NumTimelineEvents":                    len(dummyPlaybookRun.TimelineEvents),
		"StatusUpdateBroadcastChannelsEnabled": dummyPlaybookRun.StatusUpdateBroadcastChannelsEnabled,
		"StatusUpdateBroadcastWebhooksEnabled": dummyPlaybookRun.StatusUpdateBroadcastWebhooksEnabled,
	}

	require.Equal(t, expectedProperties, properties)
}

func TestTaskProperties(t *testing.T) {
	properties := taskProperties(dummyPlaybookRunID, dummyUserID, dummyTask)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		telemetryKeyPlaybookRunID: dummyPlaybookRunID,
		"UserActualID":            dummyUserID,
		"TaskID":                  dummyTask.ID,
		"State":                   dummyTask.State,
		"AssigneeID":              dummyTask.AssigneeID,
		"HasCommand":              true,
		"CommandLastRun":          dummyTask.CommandLastRun,
		"HasDescription":          true,
		"HasDueDate":              true,
	}

	require.Equal(t, expectedProperties, properties)
}

func TestRunActionProperties(t *testing.T) {
	dummyTriggerType := "dummy_trigger_type"
	dummyActionType := "dummy_action_type"
	numBroadcasts := 7
	properties := runActionProperties(dummyPlaybookRun, dummyUserID, dummyTriggerType, dummyActionType, numBroadcasts)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":  dummyUserID,
		"TriggerType":   dummyTriggerType,
		"ActionType":    dummyActionType,
		"NumBroadcasts": numBroadcasts,
		"PlaybookID":    dummyPlaybookRun.PlaybookID,
		"PlaybookRunID": dummyPlaybookRun.ID,
	}

	require.Equal(t, expectedProperties, properties)
}
