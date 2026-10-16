// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
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
					e.Permissions.RemovePermissionFromRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
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
			// Dialog with empty playbook and no channel fails (channel required for runs without playbook - MM-67648/MM-66249)
			"empty playbook ID without channel fails": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: "", // Empty playbook ID
						app.DialogFieldNameKey:       "Standalone Run",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					// Client returns error for 4xx; no channel in dialog yields 403 (RunCreate) or 400 (Option A)
					require.Error(t, err)
					require.NotNil(t, result)
					assert.True(t, result.StatusCode == http.StatusForbidden || result.StatusCode == http.StatusBadRequest, "expected 403 or 400")
				},
			},
			"valid playbook ID creates RunTypePlaybook": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID, // Valid playbook ID
						app.DialogFieldNameKey:       "Playbook Run",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)

					// Get the created run ID from the Location header
					url, err := result.Location()
					require.NoError(t, err)
					runID := url.Path[strings.LastIndex(url.Path, "/")+1:]

					// Verify the run was created with the correct type
					run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
					require.NoError(t, err)
					assert.Equal(t, app.RunTypePlaybook, run.Type, "Run with playbook ID should have RunTypePlaybook")
					assert.Equal(t, e.BasicPlaybook.ID, run.PlaybookID, "Run should have the correct playbook ID")
					assert.NotEmpty(t, run.ChannelID, "Run should have a channel ID")
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)

				if tc.permissionsPrep != nil {
					defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
					defer func() {
						e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
					}()
					tc.permissionsPrep()
				}

				result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", string(dialogRequestBytes), nil)
				tc.expected(t, result, err)
			})
		}
	})

	// Checklist creation: run_create is not required; gate is permission to post in channel.
	// Remove run_create from team_user so these tests validate that behavior.
	t.Run("checklist creation without run_create", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionRunCreate.Id, model.TeamUserRoleId)

		t.Run("create run without playbook with ChannelID", func(t *testing.T) {
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
				Name:        "Channel checklist",
				OwnerUserID: e.RegularUser.Id,
				TeamID:      e.BasicTeam.Id,
				ChannelID:   e.BasicPublicChannel.Id,
				PlaybookID:  "",
			})
			require.NoError(t, err)
			require.NotNil(t, run)
			assert.Equal(t, app.RunTypeChannelChecklist, run.Type)
			assert.Empty(t, run.PlaybookID)
			assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
		})

		t.Run("create valid run without playbook", func(t *testing.T) {
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
				Name:        "No playbook",
				OwnerUserID: e.RegularUser.Id,
				TeamID:      e.BasicTeam.Id,
				ChannelID:   e.BasicPublicChannel.Id,
				PlaybookID:  "",
			})
			require.NoError(t, err)
			require.NotNil(t, run)
			assert.Equal(t, app.RunTypeChannelChecklist, run.Type, "Run without playbook ID should have RunTypeChannelChecklist")
			assert.Empty(t, run.PlaybookID)
			assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
		})
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
		assert.Equal(t, app.RunTypePlaybook, run.Type, "Run with playbook ID should have RunTypePlaybook")
		assert.Equal(t, e.BasicPlaybook.ID, run.PlaybookID)
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

		// Verify user was not promoted to admin
		member, _, err := e.ServerAdminClient.GetChannelMember(context.Background(), e.BasicPublicChannel.Id, e.RegularUser.Id, "")
		require.NoError(t, err)
		assert.NotContains(t, member.Roles, model.ChannelAdminRoleId)

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
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "test_private",
			Name:        "test_private",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(e.T, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
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

		result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", string(dialogRequestBytes), nil)

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

	t.Run("fails if summary is longer than 4096", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			Summary:     strings.Repeat("A", 4097),
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
		assert.Nil(t, run)
	})

	t.Run("checklist title way too long", func(t *testing.T) {
		run := e.BasicRun
		require.Len(t, run.Checklists, 0)

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: strings.Repeat("T", 257*1024),
			Items: []client.ChecklistItem{},
		})
		t.Logf("Error: %v", err)
		require.Error(t, err)
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
		require.NoError(t, err)
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
		require.NoError(t, err)
		require.Len(t, list.Items, 2)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:   e.BasicTeam.Id,
			Statuses: []client.Status{client.StatusInProgress},
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:  e.BasicTeam.Id,
			OwnerID: e.RegularUser.Id,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
	})

	t.Run("checklist autocomplete", func(t *testing.T) {
		resp, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "GET", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/checklist-autocomplete?channel_id="+e.BasicPrivateChannel.Id, "", nil)
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

	t.Run("filter by channel id", func(t *testing.T) {
		// Create another run to verify filtering works
		otherRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Another run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotEqual(t, e.BasicRun.ChannelID, otherRun.ChannelID)

		// We need to make sure the user has permission to the channel to test the filter
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicRun.ChannelID, e.RegularUser.Id)
		require.NoError(t, err)

		// Test filtering by channel_id
		list, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:    e.BasicTeam.Id,
			ChannelID: e.BasicRun.ChannelID,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, e.BasicRun.ID, list.Items[0].ID)

		// Skip test with non-existent channel_id as it requires permissions to the channel
		// which we can't add for a non-existent channel

		// Test channel_id filter with no permission
		// Make sure user2 is on the team
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicTeam.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		// Try to filter by a channel the user doesn't have access to
		_, err = e.PlaybooksClient2.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:    e.BasicTeam.Id,
			ChannelID: e.BasicPrivateChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		// Clean up to not affect other tests
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), otherRun.ID)
		require.NoError(t, err)
	})
}

func TestRunPostStatusUpdateDialog(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("post an update", func(t *testing.T) {
		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldMessageKey:           "someupdate",
				app.DialogFieldReminderInSecondsKey: "100000",
				app.DialogFieldFinishRun:            false,
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		require.NoError(t, err)

		result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/"+e.BasicRun.ID+"/update-status-dialog", string(dialogRequestBytes), nil)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, result.StatusCode)
	})

	t.Run("no permissions to team", func(t *testing.T) {
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)

		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldMessageKey:           "someupdate",
				app.DialogFieldReminderInSecondsKey: "100000",
				app.DialogFieldFinishRun:            false,
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		require.NoError(t, err)

		result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/"+e.BasicRun.ID+"/update-status-dialog", string(dialogRequestBytes), nil)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, result.StatusCode)

		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
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
		post, _, err := e.ServerClient.GetPost(context.Background(), run.ReminderPostID, "")
		assert.NoError(t, err)
		assert.Equal(t, run.ID, post.GetProp("playbookRunId"))
		assert.Equal(t, e.RegularUser.Username, post.GetProp("targetUsername"))
	})

	t.Run("poar an update with empty message", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "  \t  \r ", 600)
		assert.Error(t, err)
	})

	t.Run("no permissions to run", func(t *testing.T) {
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
	})

	t.Run("no permissions to run", func(t *testing.T) {
		_, _, err := e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicRun.ChannelID, e.RegularUser2.Id)
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

	t.Run("checklist renaming - failure: run is finished", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := "New Title"

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Finish the run
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Try to rename the checklist in the finished run
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.Error(t, err)
		require.Contains(t, err.Error(), "already ended")
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

func TestIgnoreKeywords(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	botID := e.Srv.Config().PluginSettings.Plugins[manifest.Id]["BotUserID"].(string)

	t.Run("no permission to channel", func(t *testing.T) {
		// Create a bot post in the private channel
		botPost := &model.Post{
			UserId:    botID,
			ChannelId: e.BasicPrivateChannel.Id,
			Message:   "test message",
			Props: model.StringInterface{
				"attachments": []*model.SlackAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id: "ignoreKeywordsButton",
							},
						},
					},
				},
			},
		}
		botPost, err := e.Srv.Store().Post().Save(e.Context, botPost)
		require.NoError(t, err)

		// Create post action request
		req := &model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			Context: map[string]interface{}{
				"post_id": botPost.Id,
			},
			PostId: botPost.Id,
		}

		// Convert request to JSON
		reqBytes, err := json.Marshal(req)
		require.NoError(t, err)

		// Make the request
		result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/signal/keywords/ignore-thread", string(reqBytes), nil)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, result.StatusCode)
	})

	t.Run("has permission to channel", func(t *testing.T) {
		// Add user to private channel
		_, _, err := e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicPrivateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create a bot post in the private channel
		botPost := &model.Post{
			UserId:    botID,
			ChannelId: e.BasicPrivateChannel.Id,
			Message:   "test message",
			Props: model.StringInterface{
				"attachments": []*model.SlackAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id: "ignoreKeywordsButton",
							},
						},
					},
				},
			},
		}
		botPost, err = e.Srv.Store().Post().Save(e.Context, botPost)
		require.NoError(t, err)

		// Create post action request
		req := &model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			Context: map[string]interface{}{
				"post_id": botPost.Id,
			},
			PostId: botPost.Id,
		}

		// Convert request to JSON
		reqBytes, err := json.Marshal(req)
		require.NoError(t, err)

		// Make the request
		result, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/signal/keywords/ignore-thread", string(reqBytes), nil)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, result.StatusCode)
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
		post, _, err := e.ServerClient.GetPost(context.Background(), run.ReminderPostID, "")
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

	t.Run("can't run if not member", func(t *testing.T) {
		// run command
		err = e.PlaybooksClient2.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.Error(t, err)
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

func TestGetByChannelID(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("single run in channel", func(t *testing.T) {
		// Create a run
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Single run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Get the run by channel ID
		retrievedRun, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), run.ChannelID)
		require.NoError(t, err)
		require.NotNil(t, retrievedRun)
		require.Equal(t, run.ID, retrievedRun.ID)
	})

	t.Run("multiple runs in channel", func(t *testing.T) {
		// Create a channel
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Multiple Runs Channel",
			Name:        "multiple-runs-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), channel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create first run with specific channel
		run1, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "First run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   channel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run1)
		require.Equal(t, channel.Id, run1.ChannelID)

		// Create second run with same channel
		run2, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Second run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   channel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run2)
		require.Equal(t, channel.Id, run2.ChannelID)

		// Try to get run by channel ID - should fail with multiple runs
		_, err = e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), channel.Id)
		require.Error(t, err)
		require.Contains(t, err.Error(), "multiple runs in the channel")
	})

	t.Run("no run in channel", func(t *testing.T) {
		// Create a channel with no runs
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Empty Channel",
			Name:        "empty-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Try to get run by channel ID - should fail with not found
		_, err = e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), channel.Id)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Not found")
	})

	t.Run("With access to channel cannot access private playbook", func(t *testing.T) {
		// Create a private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Private Channel",
			Name:        "private-channel",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create run in private channel, private playbook
		privatePlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run in private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
			ChannelID:   privateChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Equal(t, privateChannel.Id, run.ChannelID)

		// Try to get run by channel ID with a user who doesn't have access to channel or private playbook
		run, err = e.PlaybooksClient2.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.Error(t, err)
		require.Nil(t, run)
	})

	t.Run("no access to channel, public playbook", func(t *testing.T) {
		// Create a private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Private Channel-two",
			Name:        "private-channel-two",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create run in private channel
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run in private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   privateChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Equal(t, privateChannel.Id, run.ChannelID)

		// Try to get run by channel ID with a user who doesn't have access to channel
		// Should be able to access public playbook
		run, err = e.PlaybooksClient2.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.NoError(t, err)
		require.NotNil(t, run)
	})

	t.Run("guest user cannot access public playbook run", func(t *testing.T) {
		// Create a run with a public playbook
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Public run for guest test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		e.CreateGuest()
		// Try to get run by channel ID with a guest user
		_, err = e.PlaybooksClientGuest.PlaybookRuns.GetByChannelID(context.Background(), run.ChannelID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Not found")
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
			cfg.PrivacySettings.ShowFullName = model.NewPointer(tc.ShowFullName)
			_, _, err = e.ServerAdminClient.UpdateConfig(context.Background(), cfg)
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

func TestUpdatePlaybookRun(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update run name", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Run Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		originalName := testRun.Name
		newName := "Updated Run Name"

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)

		// Verify the update persisted
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, newName, run.Name)
		require.NotEqual(t, originalName, run.Name)
	})

	t.Run("update run name with empty string fails", func(t *testing.T) {
		emptyName := ""
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &emptyName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run name with whitespace-only string fails", func(t *testing.T) {
		whitespaceName := "   \t  "
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &whitespaceName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run name with name exceeding 64 characters succeeds", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		longName := strings.Repeat("a", 65) // 65 characters
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &longName,
		})
		require.NoError(t, err)
		require.Equal(t, longName, updatedRun.Name)
	})

	t.Run("update finished run name fails", func(t *testing.T) {
		// Create and finish a run
		finishedRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run to finish",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), finishedRun.ID)
		require.NoError(t, err)

		newName := "Cannot update finished run"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), finishedRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run without name field returns existing run", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		originalName := testRun.Name

		// Update without name field
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, originalName, updatedRun.Name)
	})

	t.Run("update run summary", func(t *testing.T) {
		// Create a fresh run
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Equal(t, "", testRun.Summary) // Initially empty

		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		newSummary := "## Incident Summary\n\nThis is a test description."
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &newSummary,
		})
		require.NoError(t, err)
		require.Equal(t, newSummary, updatedRun.Summary)
		require.Greater(t, updatedRun.SummaryModifiedAt, oldSummaryModifiedAt)

		// Verify persistence
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, newSummary, run.Summary)
	})

	t.Run("update run name and summary together", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		newName := "Updated Name"
		newSummary := "Updated description"
		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name:    &newName,
			Summary: &newSummary,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)
		require.Equal(t, newSummary, updatedRun.Summary)
		require.Greater(t, updatedRun.SummaryModifiedAt, oldSummaryModifiedAt)
	})

	t.Run("update run with empty summary succeeds", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			Summary:     "Initial description",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Equal(t, "Initial description", testRun.Summary)

		emptySummary := ""
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &emptySummary,
		})
		require.NoError(t, err)
		require.Equal(t, "", updatedRun.Summary)

		// Verify persistence
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, "", run.Summary)
	})

	t.Run("update run summary trims whitespace", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		summaryWithWhitespace := "  Test description  \n\t"
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &summaryWithWhitespace,
		})
		require.NoError(t, err)
		require.Equal(t, "Test description", updatedRun.Summary)
	})

	t.Run("update finished run summary fails", func(t *testing.T) {
		// Create and finish a run
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run to finish",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), testRun.ID)
		require.NoError(t, err)

		newSummary := "Updated description for finished run"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &newSummary,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update name only does not change SummaryModifiedAt", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		newName := "Updated Name"
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)
		require.Equal(t, oldSummaryModifiedAt, updatedRun.SummaryModifiedAt) // Should NOT change
	})

	t.Run("no permissions to update run", func(t *testing.T) {
		// Remove user from team to revoke permissions
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)

		newName := "Should fail"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		// Restore team membership
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
	})
}

func TestRunGetMetadata(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public - get metadata as participant", func(t *testing.T) {
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, metadata.ChannelName)
		assert.NotEmpty(t, metadata.ChannelDisplayName)
		assert.NotEmpty(t, metadata.TeamName)
	})

	t.Run("public - get metadata as non-member should hide channel info but include num participants", func(t *testing.T) {
		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.ChannelName)
		assert.Empty(t, metadata.ChannelDisplayName)
		assert.Zero(t, metadata.TotalPosts)
		assert.NotZero(t, metadata.NumParticipants) // Participants count should be included
		assert.NotEmpty(t, metadata.TeamName)       // Team name should still be available
	})

	t.Run("public - fails because not in team", func(t *testing.T) {
		metadata, err := e.PlaybooksClientNotInTeam.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.Error(t, err)
		assert.Nil(t, metadata)
	})

	t.Run("private channel - get metadata as participant", func(t *testing.T) {
		// Create a run with private channel
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, metadata.ChannelName)
		assert.NotEmpty(t, metadata.ChannelDisplayName)
		assert.NotZero(t, metadata.NumParticipants)
		assert.NotEmpty(t, metadata.TeamName)
	})

	t.Run("private channel - get metadata as non-member should hide channel info but include participants", func(t *testing.T) {
		// Create private playbook and run
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

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// RegularUser2 is a playbook member but not channel member
		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.ChannelName)
		assert.Empty(t, metadata.ChannelDisplayName)
		assert.Zero(t, metadata.TotalPosts)
		assert.NotZero(t, metadata.NumParticipants) // Number of participants should be included
		assert.NotEmpty(t, metadata.TeamName)       // Team name should still be available
	})

	t.Run("private channel - not a member of playbook", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.Error(t, err)
		assert.Nil(t, metadata)
	})

	t.Run("invalid run ID", func(t *testing.T) {
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), "invalid_id")
		require.Error(t, err)
		assert.Nil(t, metadata)
	})
	t.Run("metadata filtering for different user roles", func(t *testing.T) {
		// Create a private playbook
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Private Playbook for Metadata Test",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		// Create a playbook run with a private channel
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private Run for Metadata Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// 1. Test as channel member (owner) - should see all metadata
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		require.NotEmpty(t, metadata.ChannelName)
		require.NotEmpty(t, metadata.ChannelDisplayName)
		require.NotEmpty(t, metadata.TeamName)
		// Total posts might be 0 at creation, but the field should exist
		require.Zero(t, metadata.TotalPosts)

		// Add RegularUser2 as a playbook member so they can access the run but not the channel
		playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(t, err)
		playbook.Members = append(playbook.Members, client.PlaybookMember{
			UserID: e.RegularUser2.Id,
			Roles:  []string{app.PlaybookRoleMember},
		})
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		require.NoError(t, err)

		// 2. Test as non-channel member but with run access
		metadata, err = e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		// These fields should be empty/zero for non-channel members
		require.Empty(t, metadata.ChannelName)
		require.Empty(t, metadata.ChannelDisplayName)
		require.Zero(t, metadata.TotalPosts)
		// But team name should still be available
		require.NotEmpty(t, metadata.TeamName)
		// Followers should be accessible regardless of channel membership
		require.NotNil(t, metadata.Followers)

		// 3. Test with system admin - should still follow permission rules
		metadata, err = e.PlaybooksAdminClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		// Admin should have all info since they are a playbook member with channel access
		require.NotEmpty(t, metadata.ChannelName)
		require.NotEmpty(t, metadata.ChannelDisplayName)
		require.NotEmpty(t, metadata.TeamName)
	})

	t.Run("unable to access run metadata without permissions", func(t *testing.T) {
		// Create a private playbook with no members other than creator
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Restricted Private Playbook",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		// Create a run
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Restricted Private Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// Test as non-member - should not be able to access metadata at all
		_, err = e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.Error(t, err)
	})
}

// TestGuestCannotAccessPrivateChannelTasks tests that guests cannot access
// tasks from runs linked to private channels they don't have membership in.
// MM-65795
func TestGuestCannotAccessPrivateChannelTasks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.CreateGuest()

	// Create a private channel that the guest is NOT a member of
	privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		TeamId:      e.BasicTeam.Id,
		Name:        "private-test-channel",
		DisplayName: "Private Test Channel",
		Type:        model.ChannelTypePrivate,
	})
	require.NoError(t, err)

	// Create a public playbook (guests should not see runs from it if they're not in the channel)
	publicPlaybook, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Public Playbook for Guest Test",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Checklists: []client.Checklist{
			{
				Title: "Test Checklist",
				Items: []client.ChecklistItem{
					{
						Title: "Sensitive Task",
					},
				},
			},
		},
	})
	require.NoError(t, err)

	// Create a run in the private channel that the guest is not a member of
	run, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run in Private Channel",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  publicPlaybook,
		ChannelID:   privateChannel.Id,
	})
	require.NoError(t, err)

	t.Run("guest cannot access run data through GetPlaybookRuns", func(t *testing.T) {
		// Guest should not see the run as they are not a member of the channel
		runs, err := e.PlaybooksClientGuest.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Verify the run from the private channel is not in the results
		for _, r := range runs.Items {
			assert.NotEqual(t, run.ID, r.ID, "Guest should not see run from private channel they are not a member of")
		}
	})

	t.Run("guest cannot access run in private channel even if they know the channel ID", func(t *testing.T) {
		// Try to get the run by channel ID - should fail with 404 (not 403) to avoid leaking channel existence
		_, err := e.PlaybooksClientGuest.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.Error(t, err, "Guest should not be able to access run in private channel")
		// Note: Returns 404 instead of 403 to avoid information disclosure about private channel existence
	})

	t.Run("guest cannot access run when channel is deleted or invalid", func(t *testing.T) {
		// Create another private channel
		anotherPrivateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Name:        "private-to-delete",
			DisplayName: "Private Channel To Delete",
			Type:        model.ChannelTypePrivate,
		})
		require.NoError(t, err)

		// Create a run in this channel
		runWithDeletedChannel, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with Channel to be Deleted",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  publicPlaybook,
			ChannelID:   anotherPrivateChannel.Id,
		})
		require.NoError(t, err)

		// Delete the channel (this tests the edge case where ChannelId might reference a non-existent channel)
		_, err = e.ServerAdminClient.DeleteChannel(context.Background(), anotherPrivateChannel.Id)
		require.NoError(t, err)

		// Guest should still not be able to access the run even though the channel is deleted
		// The permission check should handle NULL/invalid channel IDs gracefully
		runs, err := e.PlaybooksClientGuest.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Verify the run with the deleted channel is not in the results
		for _, r := range runs.Items {
			assert.NotEqual(t, runWithDeletedChannel.ID, r.ID, "Guest should not see run when associated channel is deleted")
		}

		// Also test direct access by run ID should fail
		_, err = e.PlaybooksClientGuest.PlaybookRuns.Get(context.Background(), runWithDeletedChannel.ID)
		require.Error(t, err, "Guest should not be able to directly access run with deleted channel")
	})
}

// TestMemberCannotCreateRunWithoutPlaybookIDToBypassPermissions tests that members
// cannot bypass run creation permissions by omitting the playbook_id.
// MM-66249
func TestMemberCannotCreateRunWithoutPlaybookIDToBypassPermissions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Get the default team member role
	roles, _, err := e.ServerAdminClient.GetRolesByNames(context.Background(), []string{"team_user"})
	require.NoError(t, err)
	require.Len(t, roles, 1)

	memberRole := roles[0]

	// Store original permissions for cleanup
	originalPermissions := memberRole.Permissions

	// Remove run_create permission
	updatedPermissions := []string{}
	for _, perm := range memberRole.Permissions {
		if perm != model.PermissionRunCreate.Id {
			updatedPermissions = append(updatedPermissions, perm)
		}
	}

	_, _, err = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
		Permissions: &updatedPermissions,
	})
	require.NoError(t, err)

	// Clean up: restore permissions after test
	defer func() {
		_, _, _ = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
			Permissions: &originalPermissions,
		})
	}()

	t.Run("member cannot create run without playbook_id and without channel_id", func(t *testing.T) {
		// No playbook and no channel: blocked (MM-66249 - no orphan runs; MM-67648 Option A requires channel)
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run without playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  "",
			// No ChannelID - should fail with 403 (current) or 400 (Option A)
		})
		require.Error(t, err)
	})

	t.Run("member CAN still create run with playbook_id if they have playbook-level permission", func(t *testing.T) {
		// Even with team-level run_create removed, playbook-level permissions still work
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err, "Playbook-level permissions should still allow run creation")
	})

	t.Run("member CAN create run without playbook when providing ChannelID", func(t *testing.T) {
		// MM-67648: With ChannelID, channel permissions gate access; no run_create needed
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Channel checklist",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			ChannelID:   e.BasicPublicChannel.Id,
			PlaybookID:  "",
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, app.RunTypeChannelChecklist, run.Type)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
	})

	t.Run("member cannot create checklist in channel where they cannot post", func(t *testing.T) {
		// Create a channel but do not add RegularUser; they won't have CreatePost there.
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "No-post channel",
			Name:        "no-post-channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		// Do not add RegularUser to the channel.
		_, err = e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Checklist in channel I cannot post to",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			ChannelID:   channel.Id,
			PlaybookID:  "",
		})
		require.Error(t, err, "creating a checklist in a channel where the user cannot post should fail")
	})
}

// TestCrossTeamRunCreationPermission verifies that a user cannot bypass team-level
// run_create permissions by referencing a playbook from a different team.
// MM-67867
func TestCrossTeamRunCreationPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Remove run_create from the default team_user role so that team-level
	// permission is absent; only playbook-level membership grants run_create.
	roles, _, err := e.ServerAdminClient.GetRolesByNames(context.Background(), []string{model.TeamUserRoleId})
	require.NoError(t, err)
	require.Len(t, roles, 1)
	memberRole := roles[0]
	originalPermissions := memberRole.Permissions

	updatedPermissions := []string{}
	for _, perm := range memberRole.Permissions {
		if perm != model.PermissionRunCreate.Id {
			updatedPermissions = append(updatedPermissions, perm)
		}
	}
	_, _, err = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
		Permissions: &updatedPermissions,
	})
	require.NoError(t, err)
	defer func() {
		_, _, _ = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
			Permissions: &originalPermissions,
		})
	}()

	t.Run("same-team run creation still works via playbook membership", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Same-team run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
	})

	t.Run("cross-team run creation is blocked without target team permission", func(t *testing.T) {
		// BasicPlaybook belongs to BasicTeam. RegularUser has playbook-level
		// run_create via membership. But BasicTeam2 has no team-level run_create
		// (removed above) and no playbook-level grant, so this must fail.
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Cross-team run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam2.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.Error(t, err, "should not be able to create a run in a team where user lacks run_create permission")
	})
}

// TestCrossTeamRunCreationWithPermission verifies that cross-team run creation
// succeeds when the user has run_create permission in the target team.
// By default team_user does not have run_create (it lives on playbook_member),
// so we grant it before any run creation to avoid role-cache timing issues.
// MM-67867
func TestCrossTeamRunCreationWithPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Grant run_create at the team level before any run operations so the
	// server's role cache is primed before the plugin checks permissions.
	defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
	defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	e.Permissions.AddPermissionToRole(t, model.PermissionRunCreate.Id, model.TeamUserRoleId)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Cross-team run with team-level permission",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam2.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err, "cross-team run creation should succeed when user has run_create in the target team")
	require.NotNil(t, run)
	assert.Equal(t, e.BasicTeam2.Id, run.TeamID)
}
