// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	t.Run("unlicenced servers can't create a private playbook", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("create public playbook, unlicensed with zero pre-existing playbooks in the team, should succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	t.Run("create public playbook, unlicensed with one pre-existing playbook in the team, should succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	e.SetE10Licence()

	t.Run("create playbook, e10 licenced with one pre-existing playbook in the team, should now succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	t.Run("e10 licenced servers can't create private playbooks", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test3",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	e.SetE20Licence()

	t.Run("e20 licenced servers can create private playbooks", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test4",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		assert.Nil(t, err)
	})

	t.Run("create playbook with no permissions to broadcast channel", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:               "test5",
			TeamID:              e.BasicTeam.Id,
			BroadcastChannelIDs: []string{e.BasicPrivateChannel.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("archived playbooks cannot be updated or used to create new runs", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test6 - to be archived",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)

		playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
		assert.Nil(t, err)

		// Make sure we /can/ update
		playbook.Title = "New Title!"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		assert.Nil(t, err)

		err = e.PlaybooksClient.Playbooks.Archive(context.Background(), id)
		assert.Nil(t, err)

		// Test that we cannot update an archived playbook
		playbook.Title = "Another title"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		// Test that we cannot use an archived playbook to start a new run
		_, err = e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  id,
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("playbooks can be searched by title", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 1 -- all access",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 2 -- only regular user access",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 3 -- strange string: hümberdångle",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 4 -- team 2 string: よこそ",
			TeamID: e.BasicTeam2.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		playbookResults, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 4, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest 2",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümber",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "よこそ",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 2, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümberdå",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)
	})

	t.Run("archived playbooks can be retrieved", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "ArchiveTest 1 -- not archived",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "ArchiveTest 2 -- archived",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)
		err = e.PlaybooksClient.Playbooks.Archive(context.Background(), id)
		assert.NoError(t, err)

		playbookResults, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ArchiveTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam:   "ArchiveTest",
			WithArchived: true,
		})
		assert.Nil(t, err)
		assert.Equal(t, 2, playbookResults.TotalCount)

	})

	t.Run("create playbook with valid user list", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:          "pre-assigned-test1",
			TeamID:         e.BasicTeam.Id,
			Public:         true,
			InvitedUserIDs: []string{e.RegularUser.Id},
		})
		assert.Nil(t, err)
	})

	t.Run("create playbook with pre-assigned task, valid user list, and invitations enabled", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "pre-assigned-test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:      "Do this1",
							AssigneeID: e.RegularUser.Id,
						},
					},
				},
			},
			InvitedUserIDs:     []string{e.RegularUser.Id},
			InviteUsersEnabled: true,
		})
		assert.Nil(t, err)
	})
}

func TestCreateInvalidPlaybook(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	t.Run("fails if pre-assigned task is added but invitations are disabled", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "fail-pre-assigned-test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:      "Do this1",
							AssigneeID: e.RegularUser.Id,
						},
					},
				},
			},
			InvitedUserIDs: []string{e.RegularUser.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Empty(t, id)
	})

	t.Run("fails if pre-assigned task is added but existing invite user list is missing assignee", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "fail-pre-assigned-test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:      "Do this1",
							AssigneeID: e.RegularUser.Id,
						},
					},
				},
			},
			InviteUsersEnabled: true,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Empty(t, id)
	})

	t.Run("fails if pre-assigned task is added but assignee is missing in invite user list", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "fail-pre-assigned-test3",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:      "Do this1",
							AssigneeID: e.RegularUser.Id,
						},
					},
				},
			},
			InvitedUserIDs:     []string{e.RegularUser2.Id},
			InviteUsersEnabled: true,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Empty(t, id)
	})

	t.Run("fails if json is larger than 256K", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "checklist",
					Items: []client.ChecklistItem{
						{Description: strings.Repeat("A", (256*1024)+1)},
					},
				},
			},
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
		assert.Empty(t, id)
	})

	t.Run("fails if title is longer than 1024", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  strings.Repeat("A", 1025),
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
		assert.Empty(t, id)
	})
}

func TestPlaybooksRetrieval(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("get playbook", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		assert.Equal(t, result.ID, e.BasicPlaybook.ID)
	})

	t.Run("get multiple playbooks", func(t *testing.T) {
		actualList, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
		require.NoError(t, err)
		assert.Greater(t, len(actualList.Items), 0)
	})
}

func TestPlaybookUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook properties", func(t *testing.T) {
		e.BasicPlaybook.Description = "This is the updated description"
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})

	t.Run("update playbook no permissions to broadcast", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update playbook without chaning existing broadcast channel", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

		e.BasicPlaybook.Description = "unrelated update"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})

	t.Run("fails if pre-assigned task is added but invitations are disabled", func(t *testing.T) {
		e.BasicPlaybook.InvitedUserIDs = []string{e.RegularUser2.Id}
		e.BasicPlaybook.Checklists = []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:      "Do this1",
						AssigneeID: e.RegularUser2.Id,
					},
				},
			},
		}

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("fails if pre-assigned task is added but existing invite user list is missing assignee", func(t *testing.T) {
		e.BasicPlaybook.InviteUsersEnabled = true
		e.BasicPlaybook.Checklists = []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:      "Do this1",
						AssigneeID: e.RegularUser.Id,
					},
				},
			},
		}

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("fails if pre-assigned task is added but assignee is missing in updated invite user list", func(t *testing.T) {
		e.BasicPlaybook.InviteUsersEnabled = true
		e.BasicPlaybook.InvitedUserIDs = []string{e.RegularUser2.Id}
		e.BasicPlaybook.Checklists = []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:      "Do this1",
						AssigneeID: e.RegularUser.Id,
					},
				},
			},
		}

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update playbook with pre-assigned task, valid invite user list, and invitations enabled", func(t *testing.T) {
		e.BasicPlaybook.InviteUsersEnabled = true
		e.BasicPlaybook.InvitedUserIDs = []string{e.RegularUser.Id}
		e.BasicPlaybook.Checklists = []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:      "Do this1",
						AssigneeID: e.RegularUser.Id,
					},
				},
			},
		}

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})

	t.Run("update playbook with valid invite user list", func(t *testing.T) {
		e.BasicPlaybook.InvitedUserIDs = append(e.BasicPlaybook.InvitedUserIDs, e.RegularUser2.Id)

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})

	t.Run("fails if invite user list is updated but is missing pre-assigned users", func(t *testing.T) {
		e.BasicPlaybook.InvitedUserIDs = []string{}

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("fails if invitations are getting disabled but there are pre-assigned users", func(t *testing.T) {
		e.BasicPlaybook.InviteUsersEnabled = false

		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update playbook with too many webhoooks", func(t *testing.T) {
		urls := []string{}
		for i := 0; i < 65; i++ {
			urls = append(urls, "http://localhost/"+strconv.Itoa(i))
		}
		e.BasicPlaybook.WebhookOnCreationEnabled = true
		e.BasicPlaybook.WebhookOnCreationURLs = urls
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})
}

func TestPlaybookUpdateCrossTeam(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook properties not in team public playbook", func(t *testing.T) {
		e.BasicPlaybook.Description = "This is the updated description"
		err := e.PlaybooksClientNotInTeam.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("lost acccess to playbook", func(t *testing.T) {
		e.BasicPlaybook.Description = "This is the updated description"
		e.BasicPlaybook.Members = append(e.BasicPlaybook.Members,
			client.PlaybookMember{
				UserID: e.RegularUserNotInTeam.Id,
				Roles:  []string{app.PlaybookRoleMember},
			})
		uperr := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, uperr)
		err := e.PlaybooksClientNotInTeam.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update playbook properties in team public playbook", func(t *testing.T) {
		e.BasicPlaybook.Description = "This is the updated description"
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})
}

func TestPlaybooksSort(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()

	playbookAID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "A",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	playbookBID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "B",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "B",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
			{
				Title: "B",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookBID,
	})
	require.NoError(t, err)
	playbookCID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "C",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookCID,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookCID,
	})
	require.NoError(t, err)

	testData := []struct {
		testName           string
		sortField          client.Sort
		sortDirection      client.SortDirection
		expectedList       []string
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with invalid sort field",
			sortField:          "test",
			sortDirection:      "",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'sort' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with invalid sort direction",
			sortField:          "",
			sortDirection:      "test",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'direction' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with no sort fields",
			sortField:          "",
			sortDirection:      "",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=asc",
			sortField:          client.SortByTitle,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=desc",
			sortField:          client.SortByTitle,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=asc",
			sortField:          client.SortByStages,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=desc",
			sortField:          client.SortByStages,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=asc",
			sortField:          client.SortBySteps,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=desc",
			sortField:          client.SortBySteps,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=asc",
			sortField:          client.SortByRuns,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=desc",
			sortField:          client.SortByRuns,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			actualList, err := e.PlaybooksAdminClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{
				Sort:      data.sortField,
				Direction: data.sortDirection,
			})

			if data.expectedErr == nil {
				require.NoError(t, err)
				require.Equal(t, len(data.expectedList), len(actualList.Items))
				for i, item := range actualList.Items {
					assert.Equal(t, data.expectedList[i], item.ID)
				}
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}

}

func TestPlaybooksPaging(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()

	_, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test1",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test2",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test3",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	testData := []struct {
		testName           string
		page               int
		perPage            int
		expectedErr        error
		expectedStatusCode int
		expectedTotalCount int
		expectedPageCount  int
		expectedHasMore    bool
		expectedNumItems   int
	}{
		{
			testName:           "get playbooks with negative page values",
			page:               -1,
			perPage:            -1,
			expectedErr:        errors.New("bad parameter"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with page=0 per_page=0",
			page:               0,
			perPage:            0,
			expectedTotalCount: 3,
			expectedPageCount:  1,
			expectedHasMore:    false,
			expectedNumItems:   3,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=0 per_page=3",
			page:               0,
			perPage:            3,
			expectedTotalCount: 3,
			expectedPageCount:  1,
			expectedHasMore:    false,
			expectedNumItems:   3,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=0 per_page=2",
			page:               0,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    true,
			expectedNumItems:   2,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=1 per_page=2",
			page:               1,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   1,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=2 per_page=2",
			page:               2,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   0,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=9999 per_page=2",
			page:               9999,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   0,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			actualList, err := e.PlaybooksAdminClient.Playbooks.List(context.Background(), e.BasicTeam.Id, data.page, data.perPage, client.PlaybookListOptions{})

			if data.expectedErr == nil {
				require.NoError(t, err)
				assert.Equal(t, data.expectedTotalCount, actualList.TotalCount)
				assert.Equal(t, data.expectedPageCount, actualList.PageCount)
				assert.Equal(t, data.expectedHasMore, actualList.HasMore)
				assert.Len(t, actualList.Items, data.expectedNumItems)
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}
}

func getPlaybookIDsList(playbooks []client.Playbook) []string {
	ids := []string{}
	for _, pb := range playbooks {
		ids = append(ids, pb.ID)
	}

	return ids
}

func TestPlaybooksPermissions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("test no permissions to create", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookCreate.Id, model.TeamUserRoleId)
		e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookCreate.Id, model.TeamUserRoleId)

		resultPublic, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Equal(t, "", resultPublic)

		resultPrivate, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Equal(t, "", resultPrivate)

	})

	t.Run("permissions to get private playbook", func(t *testing.T) {
		_, err := e.PlaybooksClient2.Playbooks.Get(context.Background(), e.BasicPrivatePlaybook.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("list playbooks", func(t *testing.T) {
		t.Run("user in private", func(t *testing.T) {
			results, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook, *e.BasicPrivatePlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user in private list all", func(t *testing.T) {
			results, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook, *e.BasicPrivatePlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user not in private", func(t *testing.T) {
			results, err := e.PlaybooksClient2.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user not in private list all", func(t *testing.T) {
			results, err := e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("not in team", func(t *testing.T) {
			_, err := e.PlaybooksClientNotInTeam.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})
	})

	t.Run("update playbook", func(t *testing.T) {
		e.BasicPlaybook.Description = "updated"

		t.Run("user not in private", func(t *testing.T) {
			err := e.PlaybooksClient2.Playbooks.Update(context.Background(), *e.BasicPrivatePlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("public with no permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("public with permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			assert.NoError(t, err)
		})

		e.BasicPrivatePlaybook.Description = "updated"
		t.Run("private with no permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPrivatePlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("private with permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPrivatePlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPrivatePlaybook)
			assert.NoError(t, err)
		})

	})

	oldMembers := e.BasicPlaybook.Members

	t.Run("update playbook members", func(t *testing.T) {
		e.BasicPlaybook.Members = append(e.BasicPlaybook.Members, client.PlaybookMember{UserID: "testuser", Roles: []string{model.PlaybookMemberRoleId}})

		t.Run("without permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)
			e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookManageMembers.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("with permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageMembers.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			assert.NoError(t, err)
		})

		e.BasicPlaybook.Members = []client.PlaybookMember{}
		t.Run("with permissions removal", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageMembers.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			assert.NoError(t, err)
		})
	})

	e.BasicPlaybook.Members = oldMembers
	err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
	require.NoError(t, err)

	t.Run("update playbook roles", func(t *testing.T) {
		e.BasicPlaybook.Members[len(e.BasicPlaybook.Members)-1].Roles = append(e.BasicPlaybook.Members[len(e.BasicPlaybook.Members)-1].Roles, model.PlaybookAdminRoleId)

		t.Run("without permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageMembers.Id, model.PlaybookMemberRoleId)
			e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookManageRoles.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("with permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageMembers.Id, model.PlaybookMemberRoleId)
			e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookManageRoles.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			assert.NoError(t, err)
		})
	})

}

func TestPlaybooksConversions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public to private conversion", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			e.SetE20Licence()
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookMakePrivate.Id, model.PlaybookMemberRoleId)

		e.BasicPlaybook.Public = false
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookMakePrivate.Id, model.PlaybookMemberRoleId)

		t.Run("E0", func(t *testing.T) {
			e.RemoveLicence()

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("E10", func(t *testing.T) {
			e.SetE10Licence()

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("E20", func(t *testing.T) {
			e.SetE20Licence()

			err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			require.NoError(t, err)
		})
	})

	t.Run("private to public conversion", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookMakePublic.Id, model.PlaybookMemberRoleId)

		e.BasicPlaybook.Public = true
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		e.Permissions.AddPermissionToRole(model.PermissionPrivatePlaybookMakePublic.Id, model.PlaybookMemberRoleId)

		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

	})
}

func TestPlaybooksImportExport(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.CreateBasicPublicPlaybook()

	t.Run("Export", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.Export(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		var exportedPlaybook app.Playbook
		err = json.Unmarshal(result, &exportedPlaybook)
		require.NoError(t, err)
		assert.Equal(t, e.BasicPlaybook.Title, exportedPlaybook.Title)
	})

	t.Run("Import", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.Export(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		newPlaybookID, err := e.PlaybooksClient.Playbooks.Import(context.Background(), result, e.BasicTeam.Id)
		require.NoError(t, err)
		newPlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), newPlaybookID)
		require.NoError(t, err)

		assert.Equal(t, e.BasicPlaybook.Title, newPlaybook.Title)
		assert.NotEqual(t, e.BasicPlaybook.ID, newPlaybook.ID)
	})
}

func TestPlaybooksDuplicate(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()
	e.CreateBasicPlaybook()

	t.Run("Duplicate", func(t *testing.T) {
		newID, err := e.PlaybooksClient.Playbooks.Duplicate(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.NotEqual(t, e.BasicPlaybook.ID, newID)

		duplicatedPlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), newID)
		require.NoError(t, err)

		assert.Equal(t, "Copy of "+e.BasicPlaybook.Title, duplicatedPlaybook.Title)
		assert.Equal(t, e.BasicPlaybook.Description, duplicatedPlaybook.Description)
		assert.Equal(t, e.BasicPlaybook.TeamID, duplicatedPlaybook.TeamID)
	})
}

func TestAddPostToTimeline(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	dialogRequest := model.SubmitDialogRequest{
		TeamId: e.BasicTeam.Id,
		UserId: e.RegularUser.Id,
		State:  fmt.Sprintf(`{"post_id": "%s"}`, e.BasicPublicChannelPost.Id),
		Submission: map[string]interface{}{
			app.DialogFieldPlaybookRunKey: e.BasicRun.ID,
			app.DialogFieldSummary:        "a summary",
		},
	}

	// Build the payload for the dialog
	dialogRequestBytes, err := json.Marshal(dialogRequest)
	require.NoError(t, err)

	t.Run("unlicensed server", func(t *testing.T) {
		// Make sure there is no license
		e.RemoveLicence()

		// Post the request with the dialog payload and verify it is not allowed
		resp, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/add-to-timeline-dialog", dialogRequestBytes, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("E10 server", func(t *testing.T) {
		// Set an E10 license
		e.SetE10Licence()

		// Post the request with the dialog payload and verify it is allowed
		_, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/add-to-timeline-dialog", dialogRequestBytes, "")
		require.NoError(t, err)
	})

	t.Run("E20 server", func(t *testing.T) {
		// Set an E20 license
		e.SetE20Licence()

		// Post the request with the dialog payload and verify it is allowed
		_, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/runs/add-to-timeline-dialog", dialogRequestBytes, "")
		require.NoError(t, err)
	})
}

func TestPlaybookStats(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()
	e.CreateBasicPlaybook()

	t.Run("unlicensed server", func(t *testing.T) {
		// Make sure there is no license
		e.RemoveLicence()

		// Verify that retrieving stats is not allowed
		_, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), e.BasicPlaybook.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("E10 server", func(t *testing.T) {
		// Set an E10 license
		e.SetE10Licence()

		// Verify that ertrieving stats is not allowed
		_, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), e.BasicPlaybook.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("E20 server", func(t *testing.T) {
		// Set an E20 license
		e.SetE20Licence()

		// Verify that retrieving stats is allowed
		_, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
	})
}

func TestPlaybookGetAutoFollows(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	p1ID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test1",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	err = e.PlaybooksClient.Playbooks.AutoFollow(context.Background(), p1ID, e.RegularUser.Id)
	require.NoError(t, err)

	p2ID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test2",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	err = e.PlaybooksClient.Playbooks.AutoFollow(context.Background(), p2ID, e.RegularUser.Id)
	require.NoError(t, err)
	err = e.PlaybooksClient2.Playbooks.AutoFollow(context.Background(), p2ID, e.RegularUser2.Id)
	require.NoError(t, err)

	p3ID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test3",
		TeamID: e.BasicTeam2.Id,
		Public: false,
	})
	require.NoError(t, err)

	testCases := []struct {
		testName           string
		playbookID         string
		expectedError      int
		expectedTotalCount int
		expectedFollowers  []string
		client             *client.Client
	}{
		{
			testName:           "Public playbook without followers",
			client:             e.PlaybooksClient,
			playbookID:         e.BasicPlaybook.ID,
			expectedTotalCount: 0,
			expectedFollowers:  []string{},
		},
		{
			testName:           "Private playbook without followers",
			client:             e.PlaybooksClient,
			playbookID:         e.BasicPrivatePlaybook.ID,
			expectedTotalCount: 0,
			expectedFollowers:  []string{},
		},
		{
			testName:           "Public playbook with 1 follower",
			client:             e.PlaybooksClient,
			playbookID:         p1ID,
			expectedTotalCount: 1,
			expectedFollowers:  []string{e.RegularUser.Id},
		},
		{
			testName:           "Public playbook with 2 followers",
			client:             e.PlaybooksClient,
			playbookID:         p2ID,
			expectedTotalCount: 2,
			expectedFollowers:  []string{e.RegularUser.Id, e.RegularUser2.Id},
		},
		{
			testName:      "Playbook does not exist",
			client:        e.PlaybooksClient,
			playbookID:    "fake playbook id",
			expectedError: http.StatusNotFound,
		},
		{
			testName:      "Playbook belongs to other team",
			client:        e.PlaybooksClient,
			playbookID:    p3ID,
			expectedError: http.StatusForbidden,
		},
		{
			testName:      "Playbook in same team but user lacks permission",
			client:        e.PlaybooksClient2,
			playbookID:    e.BasicPrivatePlaybook.ID,
			expectedError: http.StatusForbidden,
		},
	}

	for _, c := range testCases {
		t.Run(c.testName, func(t *testing.T) {
			res, err := c.client.Playbooks.GetAutoFollows(context.Background(), c.playbookID)
			if c.expectedError != 0 {
				requireErrorWithStatusCode(t, err, c.expectedError)
			} else {
				require.NoError(t, err)
				require.Equal(t, c.expectedTotalCount, len(res))
				require.Equal(t, c.expectedFollowers, res)
			}
		})

	}

}

func TestPlaybookChecklistCleanup(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook", func(t *testing.T) {
		e.BasicPlaybook.Checklists = []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:            "title1",
						AssigneeModified: 101,
						State:            "Closed",
						StateModified:    102,
						CommandLastRun:   103,
					},
				},
			},
		}
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		actual := []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:            "title1",
						AssigneeModified: 0,
						State:            "",
						StateModified:    0,
						CommandLastRun:   0,
					},
				},
			},
		}
		require.Equal(t, pb.Checklists, actual)
	})

	t.Run("create playbook", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:            "title1",
							AssigneeModified: 101,
							State:            "Closed",
							StateModified:    102,
							CommandLastRun:   103,
						},
					},
				},
			}})
		require.NoError(t, err)
		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
		require.NoError(t, err)
		actual := []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title:            "title1",
						AssigneeModified: 0,
						State:            "",
						StateModified:    0,
						CommandLastRun:   0,
					},
				},
			},
		}
		require.Equal(t, pb.Checklists, actual)
	})
}
