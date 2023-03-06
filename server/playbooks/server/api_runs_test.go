package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunCreation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	incompletePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		ChannelMode: client.PlaybookRunLinkExistingChannel,
		ChannelID:   "",
	})
	require.NoError(t, err)

	t.Run("dialog requests", func(t *testing.T) {
		for name, tc := range map[string]struct {
			dialogRequest   model.SubmitDialogRequest
			expected        func(t *testing.T, result *http.Response, err error)
			permissionsPrep func()
		}{
			"valid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"valid from post": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPublicChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"somone else's user id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.AdminUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			"missing playbook id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: "noesnotexist",
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
			"no permissions to postid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPrivateChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "no permissions",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
			"no permissions to playbook": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.PrivatePlaybookNoMembers.ID,
						app.DialogFieldNameKey:       "not happening",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusForbidden, result.StatusCode)
				},
			},
			"no permissions to private channels": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				permissionsPrep: func() {
					e.Permissions.RemovePermissionFromRole(model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusForbidden, result.StatusCode)
				},
			},
			"request userid doesn't match": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.AdminUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "bad userid",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			"invalid: missing channelid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: incompletePlaybookID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)

				if tc.permissionsPrep != nil {
					defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
					defer func() {
						e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
					}()
					tc.permissionsPrep()
				}

				result, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/dialog", dialogRequestBytes, "")
				tc.expected(t, result, err)
			})
		}
	})

	t.Run("create valid run", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
	})

	t.Run("create valid run without playbook", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
	})

	t.Run("can't without owner", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No owner",
			OwnerUserID: "",
			TeamID:      e.BasicTeam.Id,
		})
		assert.Error(t, err)
	})

	t.Run("can't without team", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.Error(t, err)
	})

	t.Run("missing name", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.Error(t, err)
	})

	t.Run("archived playbook", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.ArchivedPlaybook.ID,
		})
		assert.Error(t, err)
	})

	t.Run("create valid run using playbook with due dates", func(t *testing.T) {
		durations := []int64{
			4 * time.Hour.Milliseconds(),      // 4 hours
			30 * time.Minute.Milliseconds(),   // 30 min
			4 * 24 * time.Hour.Milliseconds(), // 4 days
		}

		// create playbook with relative due dates
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Public: true,
			Title:  "PB",
			TeamID: e.BasicTeam.Id,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:   "Do this1",
							DueDate: durations[0],
						},
						{
							Title:   "Do this2",
							DueDate: durations[1],
						},
					},
				},
				{
					Title: "B",
					Items: []client.ChecklistItem{
						{
							Title:   "Do this1",
							DueDate: durations[2],
						},
						{
							Title: "Do this2",
						},
					},
				},
			},
		})
		assert.NoError(t, err)

		now := model.GetMillis()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "With due dates",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		// compare date with 10^4 precision because run creation might take more than a second
		assert.Equal(t, (now+durations[0])/10000, run.Checklists[0].Items[0].DueDate/10000)
		assert.Equal(t, (now+durations[1])/10000, run.Checklists[0].Items[1].DueDate/10000)
		assert.Equal(t, (now+durations[2])/10000, run.Checklists[1].Items[0].DueDate/10000)
		assert.Zero(t, run.Checklists[1].Items[1].DueDate)
	})
}

func TestCreateRunInExistingChannel(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// create playbook
	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Public:      true,
		Title:       "PB",
		TeamID:      e.BasicTeam.Id,
		ChannelMode: client.PlaybookRunLinkExistingChannel,
		ChannelID:   e.BasicPublicChannel.Id,
	})
	assert.NoError(t, err)

	t.Run("create a run", func(t *testing.T) {
		// create a run, pass the channel id from the playbook configuration
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   e.BasicPublicChannel.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
	})

	t.Run("no access to the linked channel", func(t *testing.T) {
		// create a run, pass the channel id from the playbook configuration
		run, err := e.PlaybooksClient2.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   e.BasicPublicChannel.Id,
		})

		// PlaybooksClient2 is not a channel member, so should not be able to start a run
		assert.Error(t, err)
		assert.Nil(t, run)
	})

	t.Run("create a run, pass a channel different from the playbook configs", func(t *testing.T) {
		// create private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(&model.Channel{
			DisplayName: "test_private",
			Name:        "test_private",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(e.T, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(privateChannel.Id, e.RegularUser.Id)
		require.NoError(e.T, err)

		// create a run, pass the channel id different from the playbook configs
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   privateChannel.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		assert.Equal(t, privateChannel.Id, run.ChannelID)
	})

	t.Run("create a run using dialog requests", func(t *testing.T) {
		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: playbookID,
				app.DialogFieldNameKey:       "run number 1",
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		assert.NoError(t, err)

		result, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/dialog", dialogRequestBytes, "")

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, result.StatusCode)

		url, err := result.Location()
		assert.NoError(t, err)
		runID := url.Path[strings.LastIndex(url.Path, "/")+1:]
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
		assert.NoError(t, err)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
	})
}

func TestCreateInvalidRuns(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("fails if description is longer than 4096", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			Description: strings.Repeat("A", 4097),
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
		assert.Nil(t, run)
	})
}

func TestRunRetrieval(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("by channel id", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), e.BasicRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, e.BasicRun.ID, run.ID)
	})

	t.Run("by channel id not found", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), model.NewId())
		require.Error(t, err)
		require.Nil(t, run)
	})

	t.Run("empty list", func(t *testing.T) {
		list, err := e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam2.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 0)
	})

	t.Run("filters", func(t *testing.T) {
		endedRun, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Anouther Run",
			TeamID:      e.BasicTeam.Id,
			OwnerUserID: e.AdminUser.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), endedRun.ID)
		require.NoError(t, err)

		list, err := e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 2)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:   e.BasicTeam.Id,
			Statuses: []client.Status{client.StatusInProgress},
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 1)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:  e.BasicTeam.Id,
			OwnerID: e.RegularUser.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 1)
	})

	t.Run("checklist autocomplete", func(t *testing.T) {
		resp, err := e.ServerClient.DoAPIRequest("GET", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/checklist-autocomplete?channel_id="+e.BasicPrivateChannel.Id, "", "")
		assert.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("can't get cross team", func(t *testing.T) {
		_, err := e.PlaybooksClientNotInTeam.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("can't list cross team", func(t *testing.T) {
		list, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(list.Items), 1)
		list2, err2 := e.PlaybooksClientNotInTeam.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		assert.NoError(t, err2)
		assert.Len(t, list2.Items, 0)
	})
}

func TestRunPostStatusUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("post an update", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		assert.NoError(t, err)
	})

	t.Run("creates a reminder post", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 1)
		assert.NoError(t, err)

		// wait for the scheduler to run the job
		time.Sleep(2 * time.Second)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 1*time.Second, run.PreviousReminder)
		assert.NotEmpty(t, run.ReminderPostID)
		assert.NoError(t, err)

		// post created with expected props
		post, _, err := e.ServerClient.GetPost(run.ReminderPostID, "")
		assert.NoError(t, err)
		assert.Equal(t, run.ID, post.GetProp("playbookRunId"))
		assert.Equal(t, e.RegularUser.Username, post.GetProp("targetUsername"))
	})

	t.Run("poar an update with empty message", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "  \t  \r ", 600)
		assert.Error(t, err)
	})

	t.Run("no permissions to run", func(t *testing.T) {
		_, _, err := e.ServerAdminClient.AddChannelMember(e.BasicRun.ChannelID, e.RegularUser2.Id)
		require.NoError(t, err)
		err = e.PlaybooksClient2.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("test no permissions to broadcast channel", func(t *testing.T) {
		// Create a run with a private channel in the broadcast channels
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Poison broadcast channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Update should work even when we don't have access to private broadcast channel
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), run.ID, "update", 600)
		assert.NoError(t, err)
	})
}

func TestChecklistManagement(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createNewRunWithNoChecklists := func(t *testing.T) *client.PlaybookRun {
		t.Helper()

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		return run
	}

	t.Run("checklist creation - success: empty checklist", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid, empty checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Make sure the new checklist is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, title, editedRun.Checklists[0].Title)
	})

	t.Run("checklist creation - failure: no permissions", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid, empty checklist
		err := e.PlaybooksClient2.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: []client.ChecklistItem{},
		})
		require.Error(t, err)
	})

	t.Run("checklist creation - success: checklist with items", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid checklist with some items
		items := []client.ChecklistItem{
			{
				Title:       "First",
				Description: "",
			},
			{
				Title:       "Second",
				Description: "Description",
			},
		}
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: items,
		})
		require.NoError(t, err)

		// Make sure the new checklist is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, title, editedRun.Checklists[0].Title)
		require.Equal(t, "First", editedRun.Checklists[0].Items[0].Title)
		require.Equal(t, "Second", editedRun.Checklists[0].Items[1].Title)
		require.Equal(t, "Description", editedRun.Checklists[0].Items[1].Description)
	})

	t.Run("checklist creation - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Try to create a new checklist with no title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "",
			Items: []client.ChecklistItem{},
		})
		require.Error(t, err)

		// Make sure that the checklist was not added
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 0)
	})

	t.Run("checklist renaming - success", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := "New Title"

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Rename the checklist to a new title
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist's title has changed
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, newTitle, editedRun.Checklists[0].Title)
	})

	t.Run("checklist renaming - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := ""

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Try to rename the checklist to an empty title
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.Error(t, err)
	})

	t.Run("checklist renaming - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		newTitle := "New Title"

		// Try to rename a checklist that does not exist (negative number)
		err := e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, -1, newTitle)
		require.Error(t, err)

		// Try to rename a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, len(run.Checklists), newTitle)
		require.Error(t, err)
	})

	t.Run("checklist removal - success: result in no checklists", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		require.Len(t, run.Checklists, 0)

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was created
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)

		// Remove the recently created checklist
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 0)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was removed
		editedRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 0)
	})

	t.Run("checklist removal - success: still some checklists", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create two valid checklists
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "First checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Second checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklists were created
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 2)

		// Remove the last checklist
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 1)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was removed
		editedRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, "First checklist", editedRun.Checklists[0].Title)
	})

	t.Run("checklist removal - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Try to remove a checklist that does not exist (negative number)
		err := e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, -1)
		require.Error(t, err)

		// Try to rename a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 0)
		require.Error(t, err)

		// Create a checklist so that there is at least one
		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Second checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that there is one checklist
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)

		// Try to remove a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 1)
		require.Error(t, err)
	})

	t.Run("checklist adding - success", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem
		itemTitle := "New echo item"
		command := "/echo hi!"
		description := "A very complicated checklist item."
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, 0, client.ChecklistItem{
			Title:       itemTitle,
			Command:     command,
			Description: description,
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklistItem is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Len(t, editedRun.Checklists[0].Items, 1)
		require.Equal(t, itemTitle, editedRun.Checklists[0].Items[0].Title)
		require.Equal(t, command, editedRun.Checklists[0].Items[0].Command)
		require.Equal(t, description, editedRun.Checklists[0].Items[0].Description)
	})

	t.Run("checklist adding - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem with an invalid title
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, 0, client.ChecklistItem{
			Title: "",
		})
		require.Error(t, err)
	})

	t.Run("checklist adding - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem -- to an invalid checklist number (negative)
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, -1, client.ChecklistItem{
			Title: "New echo item",
		})
		require.Error(t, err)

		// Add the new checklistItem -- to an invalid checklist number (non-existent)
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, len(run.Checklists)+1, client.ChecklistItem{
			Title: "New echo item",
		})
		require.Error(t, err)
	})

	type ExpectedError struct{ StatusCode int }

	moveItemTests := []struct {
		Title              string
		Checklists         [][]string
		SourceChecklistIdx int
		SourceItemIdx      int
		DestChecklistIdx   int
		DestItemIdx        int
		ExpectedItemTitles [][]string
		ExpectedError      *ExpectedError
	}{
		{
			"One checklist with two items - move the first item",
			[][]string{{"00", "01"}},
			0, 0, 0, 1,
			[][]string{{"01", "00"}},
			nil,
		},
		{
			"One checklist with two items - move the second item",
			[][]string{{"00", "01"}},
			0, 1, 0, 0,
			[][]string{{"01", "00"}},
			nil,
		},
		{
			"One checklist with three items - move the first item to the second position",
			[][]string{{"00", "01", "02"}},
			0, 0, 0, 1,
			[][]string{{"01", "00", "02"}},
			nil,
		},
		{
			"One checklist with three items - move the second item to the first position",
			[][]string{{"00", "01", "02"}},
			0, 1, 0, 0,
			[][]string{{"01", "00", "02"}},
			nil,
		},
		{
			"One checklist with three items - move the first item to the last position",
			[][]string{{"00", "01", "02"}},
			0, 0, 0, 2,
			[][]string{{"01", "02", "00"}},
			nil,
		},
		{
			"Multiple checklists - move from one to another",
			[][]string{{"10", "11", "12"}, {"00", "01", "02"}},
			0, 1, 1, 0,
			[][]string{{"00", "02"}, {"01", "10", "11", "12"}},
			nil,
		},
		{
			"Multiple checklists - move to an empty checklist",
			[][]string{{}, {"00", "01"}},
			0, 0, 1, 0,
			[][]string{{"01"}, {"00"}},
			nil,
		},
		{
			"Multiple checklists - leave the original checklist empty",
			[][]string{{"10"}, {"00"}},
			0, 0, 1, 1,
			[][]string{{}, {"10", "00"}},
			nil,
		},
		{
			"One checklist - invalid source checklist: greater than length of checklists",
			[][]string{{"00"}},
			1, 0, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source checklist: negative number",
			[][]string{{"00"}},
			-1, 0, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest checklist: greater than length of items",
			[][]string{{"00"}},
			0, 0, 1, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest checklist: negative number",
			[][]string{{"00"}},
			0, 0, -1, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source item: greater than length of items",
			[][]string{{"00"}},
			0, 1, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source item: negative number",
			[][]string{{"00"}},
			0, -1, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest item: greater than length of items",
			[][]string{{"00"}},
			0, 0, 0, 1,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest item: negative number",
			[][]string{{"00"}},
			0, 0, 0, -1,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
	}

	for _, test := range moveItemTests {
		t.Run(test.Title, func(t *testing.T) {
			// Create a new empty run
			run := createNewRunWithNoChecklists(t)

			// Add the specified checklists: note that we need to iterate backwards because CreateChecklist prepends new checklists
			for i := len(test.Checklists) - 1; i >= 0; i-- {
				// Generate the items for this checklist
				checklist := test.Checklists[i]
				items := make([]client.ChecklistItem, 0, len(checklist))
				for _, title := range checklist {
					items = append(items, client.ChecklistItem{Title: title})
				}

				// Create the checklist with the defined items
				err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
					Title: "Checklist",
					Items: items,
				})
				require.NoError(t, err)
			}

			// Move the item from its source to its destination
			err := e.PlaybooksClient.PlaybookRuns.MoveChecklistItem(context.Background(), run.ID, test.SourceChecklistIdx, test.SourceItemIdx, test.DestChecklistIdx, test.DestItemIdx)

			// If an error is expected, check that it's the one we expect
			if test.ExpectedError != nil {
				requireErrorWithStatusCode(t, err, test.ExpectedError.StatusCode)
				return
			}

			// If no error is expected, retrieve the run again
			require.NoError(t, err)
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
			require.NoError(t, err)

			// And check that the new checklists are ordered as specified by the test data
			for checklistIdx, actualChecklist := range run.Checklists {
				expectedItemTitles := test.ExpectedItemTitles[checklistIdx]
				require.Len(t, actualChecklist.Items, len(expectedItemTitles))

				for itemIdx, actualItem := range actualChecklist.Items {
					require.Equal(t, expectedItemTitles[itemIdx], actualItem.Title)
				}
			}
		})
	}

	moveChecklistTests := []struct {
		Title              string
		Checklists         []string
		SourceChecklistIdx int
		DestChecklistIdx   int
		ExpectedChecklists []string
		ExpectedError      *ExpectedError
	}{
		{
			"Move checklist to the same position",
			[]string{"0"},
			0, 0,
			[]string{"0"},
			nil,
		},
		{
			"Swap two checklists, moving the first one",
			[]string{"1", "0"},
			0, 1,
			[]string{"1", "0"},
			nil,
		},
		{
			"Swap two checklists, moving the second one",
			[]string{"1", "0"},
			1, 0,
			[]string{"1", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to second ",
			[]string{"2", "1", "0"},
			0, 1,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to third",
			[]string{"2", "1", "0"},
			0, 2,
			[]string{"1", "2", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to first",
			[]string{"2", "1", "0"},
			1, 0,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to third",
			[]string{"2", "1", "0"},
			1, 2,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to first",
			[]string{"2", "1", "0"},
			2, 0,
			[]string{"2", "0", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to second",
			[]string{"2", "1", "0"},
			2, 1,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Wrong destination index - greater than length of list",
			[]string{"2", "1", "0"},
			0, 5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong destination index - negative",
			[]string{"2", "1", "0"},
			0, -5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - greater than length of list",
			[]string{"2", "1", "0"},
			5, 0,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - negative",
			[]string{"2", "1", "0"},
			-5, 0,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
	}

	for _, test := range moveChecklistTests {
		t.Run(test.Title, func(t *testing.T) {
			// Create a new empty run
			run := createNewRunWithNoChecklists(t)

			// Add the specified checklists: note that we need to iterate backwards because CreateChecklist prepends new checklists
			for i := len(test.Checklists) - 1; i >= 0; i-- {
				err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
					Title: test.Checklists[i],
				})
				require.NoError(t, err)
			}

			// Move the checklist from its source to its destination
			err := e.PlaybooksClient.PlaybookRuns.MoveChecklist(context.Background(), run.ID, test.SourceChecklistIdx, test.DestChecklistIdx)

			// If an error is expected, check that it's the one we expect
			if test.ExpectedError != nil {
				requireErrorWithStatusCode(t, err, test.ExpectedError.StatusCode)
				return
			}

			// If no error is expected, retrieve the run again
			require.NoError(t, err)
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
			require.NoError(t, err)

			// And check that the new checklists are ordered as specified by the test data
			for checklistIdx, actualChecklist := range run.Checklists {
				require.Equal(t, test.ExpectedChecklists[checklistIdx], actualChecklist.Title)
			}
		})
	}
}

func TestChecklisFailTooLarge(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("checklist creation - failure: too large checklist", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "My regular title",
			Items: []client.ChecklistItem{
				{Title: "Item title", Description: strings.Repeat("A", (256*1024)+1)},
			},
		})
		require.Error(t, err)
	})
}

func TestRunGetStatusUpdates(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public - get no updates", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		assert.NoError(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("public - get 2 updates as participant", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
	})

	t.Run("public - get 2 updates as viewer", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[1].AuthorUserName)
	})

	t.Run("public - fails because not in team", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClientNotInTeam.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.Error(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("private - get no updates", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		assert.NoError(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("private - get 2 updates as participant", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[1].AuthorUserName)
	})

	t.Run("private - get 2 updates as viewer", func(t *testing.T) {
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(e.T, err)

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
	})

	t.Run("private - fails because not in playbook members", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.Error(t, err)
		assert.Len(t, statusUpdates, 0)
	})
}

func TestRequestUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("private - no viewer access ", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.Error(t, err)

		err = e.PlaybooksClientNotInTeam.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUserNotInTeam.Id)
		assert.Error(t, err)
	})

	t.Run("private - viewer access ", func(t *testing.T) {
		privatePlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(e.T, err)

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		assert.NoError(t, err)

		// No access, RegularUser2 is not a Viewer
		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.Error(t, err)

		// Add RegularUser2 as a Viewer
		privatePlaybook.Members = append(privatePlaybook.Members, client.PlaybookMember{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}})
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *privatePlaybook)
		assert.NoError(t, err)

		// Gained Viewer access
		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.NoError(t, err)

		// Assert that timeline event is created
		privateRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), privateRun.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, privateRun.TimelineEvents)
		lastEvent := privateRun.TimelineEvents[len(privateRun.TimelineEvents)-1]
		assert.Equal(t, client.StatusUpdateRequested, lastEvent.EventType)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.SubjectUserID)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.CreatorUserID)
		assert.NotZero(t, lastEvent.PostID)
		assert.Equal(t, "@playbooksuser2 requested a status update", lastEvent.Summary)
	})

	t.Run("public - viewer access ", func(t *testing.T) {
		publicRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), publicRun.ID, e.RegularUser2.Id)
		assert.NoError(t, err)

		// Assert that timeline event is created
		publicRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), publicRun.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, publicRun.TimelineEvents)
		lastEvent := publicRun.TimelineEvents[len(publicRun.TimelineEvents)-1]
		assert.Equal(t, client.StatusUpdateRequested, lastEvent.EventType)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.SubjectUserID)
		assert.Equal(t, "@playbooksuser2 requested a status update", lastEvent.Summary)

		err = e.PlaybooksClientNotInTeam.PlaybookRuns.RequestUpdate(context.Background(), publicRun.ID, e.RegularUserNotInTeam.Id)
		assert.Error(t, err)
	})
}

func TestReminderReset(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("reminder reset - timeline event created", func(t *testing.T) {
		payload := client.ReminderResetPayload{
			NewReminderSeconds: 100,
		}
		err := e.PlaybooksClient.Reminders.Reset(context.Background(), e.BasicRun.ID, payload)
		assert.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 100*time.Second, run.PreviousReminder)
		assert.NoError(t, err)

		statusSnoozed := make([]client.TimelineEvent, 0)
		for _, te := range run.TimelineEvents {
			if te.EventType == "status_update_snoozed" {
				statusSnoozed = append(statusSnoozed, te)
			}
		}
		require.Len(t, statusSnoozed, 1)
	})

	t.Run("reminder reset - reminder post created", func(t *testing.T) {
		payload := client.ReminderResetPayload{
			NewReminderSeconds: 1,
		}
		err := e.PlaybooksClient.Reminders.Reset(context.Background(), e.BasicRun.ID, payload)
		assert.NoError(t, err)

		// wait for scheduler to run the job
		time.Sleep(2 * time.Second)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 1*time.Second, run.PreviousReminder)
		assert.NotEmpty(t, run.ReminderPostID)
		assert.NoError(t, err)

		// post created with expected props
		post, _, err := e.ServerClient.GetPost(run.ReminderPostID, "")
		assert.NoError(t, err)
		assert.Equal(t, run.ID, post.GetProp("playbookRunId"))
		assert.Equal(t, e.RegularUser.Username, post.GetProp("targetUsername"))
	})
}

func TestChecklisItem_SetAssignee(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	addSimpleChecklistToTun := func(t *testing.T, runID string) *client.PlaybookRun {
		checklist := client.Checklist{
			Title: "Test Checklist",
			Items: []client.ChecklistItem{
				{
					Title: "Test Item",
				},
			},
		}

		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), runID, checklist)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
		require.NoError(t, err)
		require.Len(t, run.Checklists, 1)
		require.Len(t, run.Checklists[0].Items, 1)
		return run
	}

	t.Run("set assignee and participant", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// assignee is not set and user is not participant (before)
		require.Empty(t, run.Checklists[0].Items[0].AssigneeID)
		require.Len(t, run.ParticipantIDs, 1)
		require.NotContains(t, run.ParticipantIDs, e.RegularUser2.Id)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser2.Id)
		require.NoError(t, err)

		// assignee is not set and user is not participant (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser2.Id, run.Checklists[0].Items[0].AssigneeID)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id)
	})

	t.Run("set and unset", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)

		// unset assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, "")
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "", run.Checklists[0].Items[0].AssigneeID)
	})

	t.Run("idempotent action", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)

		// unset assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)
	})
}

func TestChecklisItem_SetCommand(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)
	require.Len(t, run.Checklists, 0)

	checklist := client.Checklist{
		Title: "Test Checklist",
		Items: []client.ChecklistItem{
			{
				Title: "Test Item",
			},
		},
	}

	err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, checklist)
	require.NoError(t, err)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(t, err)
	require.Len(t, run.Checklists, 1)
	require.Len(t, run.Checklists[0].Items, 1)

	t.Run("set command", func(t *testing.T) {
		// command and commandlastrun are not set (before)
		require.Empty(t, run.Checklists[0].Items[0].CommandLastRun)
		require.Empty(t, run.Checklists[0].Items[0].Command)

		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook todo")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.Equal(t, int64(0), run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("run command", func(t *testing.T) {
		// command and commandlastrun are not set (before)
		require.Empty(t, run.Checklists[0].Items[0].CommandLastRun)

		// run command
		err = e.PlaybooksClient.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.NotZero(t, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("rerun command", func(t *testing.T) {
		lastRun := run.Checklists[0].Items[0].CommandLastRun

		// rerun command
		err = e.PlaybooksClient.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Less(t, lastRun, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("set a the same command", func(t *testing.T) {
		lastRun := run.Checklists[0].Items[0].CommandLastRun

		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook todo")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.Equal(t, lastRun, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("set a different command", func(t *testing.T) {
		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook finish")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook finish", run.Checklists[0].Items[0].Command)
		require.Zero(t, run.Checklists[0].Items[0].CommandLastRun)
	})
}

func TestGetOwners(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	ownerFromUser := func(u *model.User) client.OwnerInfo {
		return client.OwnerInfo{
			UserID:    u.Id,
			Username:  u.Username,
			FirstName: u.FirstName,
			LastName:  u.LastName,
			Nickname:  u.Nickname,
		}
	}

	_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)

	_, err = e.PlaybooksClient2.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser2.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)

	fullOwner1 := ownerFromUser(e.RegularUser)
	fullOwner2 := ownerFromUser(e.RegularUser2)
	partialOwner1 := fullOwner1
	partialOwner1.FirstName = ""
	partialOwner1.LastName = ""
	partialOwner2 := fullOwner2
	partialOwner2.FirstName = ""
	partialOwner2.LastName = ""
	for _, tc := range []struct {
		Name         string
		ShowFullName bool
		Client       *client.Client
		MustContain  []client.OwnerInfo
	}{
		{
			Name:         "showfullname set to true",
			ShowFullName: true,
			Client:       e.PlaybooksClient,
			MustContain:  []client.OwnerInfo{fullOwner1, fullOwner2},
		},
		{
			Name:         "showfullname set to false",
			ShowFullName: false,
			Client:       e.PlaybooksClient,
			MustContain:  []client.OwnerInfo{partialOwner1, partialOwner2},
		},
		{
			Name:         "showfullname set to false and sysadmin",
			ShowFullName: false,
			Client:       e.PlaybooksAdminClient,
			MustContain:  []client.OwnerInfo{fullOwner1, fullOwner2},
		},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			cfg := e.Srv.Config()
			cfg.PrivacySettings.ShowFullName = model.NewBool(tc.ShowFullName)
			_, _, err = e.ServerAdminClient.UpdateConfig(cfg)
			require.NoError(t, err)

			owners, err := tc.Client.PlaybookRuns.GetOwners(context.Background())
			require.NoError(t, err)
			require.Len(t, owners, len(tc.MustContain))
			for _, mc := range tc.MustContain {
				require.Contains(t, owners, mc)
			}
		})
	}
}
