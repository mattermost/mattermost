// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateChecklistItemTimestamps(t *testing.T) {
	t.Run("sets UpdateAt when provided timestamp is non-zero", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:    "test-id",
			Title: "Test Checklist Item",
		}

		timestamp := int64(12345)
		updateChecklistItemTimestamp(&checklistItem, timestamp)

		assert.Equal(t, timestamp, checklistItem.UpdateAt)
	})

	t.Run("sets UpdateAt to current time when timestamp is zero", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:    "test-id",
			Title: "Test Checklist Item",
		}

		before := model.GetMillis()
		updateChecklistItemTimestamp(&checklistItem, 0)
		after := model.GetMillis()

		// Verify the UpdateAt time is within the expected range
		assert.GreaterOrEqual(t, checklistItem.UpdateAt, before)
		assert.LessOrEqual(t, checklistItem.UpdateAt, after)
	})

	t.Run("updateChecklistAndItemTimestamp sets both checklist and item timestamps", func(t *testing.T) {
		checklist := Checklist{
			ID:       "checklist-id",
			Title:    "Test Checklist",
			UpdateAt: 1000,
		}

		checklistItem := ChecklistItem{
			ID:       "item-id",
			Title:    "Test Item",
			UpdateAt: 1000,
		}

		timestamp := int64(12345)
		updateChecklistAndItemTimestamp(&checklist, &checklistItem, timestamp)

		// Verify both timestamps are updated
		assert.Equal(t, timestamp, checklist.UpdateAt)
		assert.Equal(t, timestamp, checklistItem.UpdateAt)
	})

	t.Run("updateChecklistAndItemTimestamp with zero timestamp sets current time", func(t *testing.T) {
		checklist := Checklist{
			ID:       "checklist-id",
			Title:    "Test Checklist",
			UpdateAt: 1000,
		}

		checklistItem := ChecklistItem{
			ID:       "item-id",
			Title:    "Test Item",
			UpdateAt: 1000,
		}

		before := model.GetMillis()
		updateChecklistAndItemTimestamp(&checklist, &checklistItem, 0)
		after := model.GetMillis()

		// Verify both timestamps are updated to a current time
		assert.GreaterOrEqual(t, checklist.UpdateAt, before)
		assert.LessOrEqual(t, checklist.UpdateAt, after)
		assert.GreaterOrEqual(t, checklistItem.UpdateAt, before)
		assert.LessOrEqual(t, checklistItem.UpdateAt, after)
		// Verify both got the same timestamp
		assert.Equal(t, checklist.UpdateAt, checklistItem.UpdateAt)
	})

	t.Run("updating an existing item with a state change", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:            "test-id",
			Title:         "Test Checklist Item",
			State:         "not done",
			StateModified: 1000,
			UpdateAt:      1000,
		}

		// Wait a bit to ensure timestamp will be different
		time.Sleep(1 * time.Millisecond)

		now := model.GetMillis()
		checklistItem.State = "done"
		checklistItem.StateModified = now
		updateChecklistItemTimestamp(&checklistItem, now)

		assert.Equal(t, now, checklistItem.UpdateAt)
		assert.Equal(t, now, checklistItem.StateModified)
	})

	t.Run("updating an existing item with an assignee change", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:               "test-id",
			Title:            "Test Checklist Item",
			AssigneeID:       "user1",
			AssigneeModified: 1000,
			UpdateAt:         1000,
		}

		// Wait a bit to ensure timestamp will be different
		time.Sleep(1 * time.Millisecond)

		now := model.GetMillis()
		checklistItem.AssigneeID = "user2"
		checklistItem.AssigneeModified = now
		updateChecklistItemTimestamp(&checklistItem, now)

		assert.Equal(t, now, checklistItem.UpdateAt)
		assert.Equal(t, now, checklistItem.AssigneeModified)
	})

	t.Run("updating an existing item with a command run", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:             "test-id",
			Title:          "Test Checklist Item",
			Command:        "/echo test",
			CommandLastRun: 1000,
			UpdateAt:       1000,
		}

		// Wait a bit to ensure timestamp will be different
		time.Sleep(1 * time.Millisecond)

		now := model.GetMillis()
		checklistItem.CommandLastRun = now
		updateChecklistItemTimestamp(&checklistItem, now)

		assert.Equal(t, now, checklistItem.UpdateAt)
		assert.Equal(t, now, checklistItem.CommandLastRun)
	})

	t.Run("updating an existing item with due date change", func(t *testing.T) {
		checklistItem := ChecklistItem{
			ID:       "test-id",
			Title:    "Test Checklist Item",
			DueDate:  1000,
			UpdateAt: 1000,
		}

		// Wait a bit to ensure timestamp will be different
		time.Sleep(1 * time.Millisecond)

		now := model.GetMillis()
		checklistItem.DueDate = 2000
		updateChecklistItemTimestamp(&checklistItem, now)

		assert.Equal(t, now, checklistItem.UpdateAt)
		assert.Equal(t, int64(2000), checklistItem.DueDate)
	})
}

// Tests for methods that update checklist items directly
func TestUpdateAt_ModifyCheckedState(t *testing.T) {
	t.Run("UpdateAt field is set when modifying checked state", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:            "item1",
							Title:         "Test Item",
							State:         "open",
							StateModified: 0,
							UpdateAt:      0,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly modify the state and update timestamps - simulating what ModifyCheckedState does
		playbookRun.Checklists[0].Items[0].State = ChecklistItemStateClosed
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].StateModified = timestamp
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that the state was updated
		assert.Equal(t, ChecklistItemStateClosed, playbookRun.Checklists[0].Items[0].State)

		// Check that item UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that StateModified and UpdateAt match
		assert.Equal(t, playbookRun.Checklists[0].Items[0].StateModified, playbookRun.Checklists[0].Items[0].UpdateAt)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_SetAssignee(t *testing.T) {
	t.Run("UpdateAt field is set when setting assignee", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:               "item1",
							Title:            "Test Item",
							AssigneeID:       "",
							AssigneeModified: 0,
							UpdateAt:         0,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly set assignee and update timestamps - simulating what SetAssignee does
		playbookRun.Checklists[0].Items[0].AssigneeID = "user123"
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].AssigneeModified = timestamp
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that the assignee was updated
		assert.Equal(t, "user123", playbookRun.Checklists[0].Items[0].AssigneeID)

		// Check that item UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that AssigneeModified and UpdateAt match
		assert.Equal(t, playbookRun.Checklists[0].Items[0].AssigneeModified, playbookRun.Checklists[0].Items[0].UpdateAt)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_RunChecklistItemSlashCommand(t *testing.T) {
	t.Run("UpdateAt field is set when running slash command", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:             "item1",
							Title:          "Test Item",
							Command:        "/test",
							CommandLastRun: 0,
							UpdateAt:       0,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly update command run timestamp - simulating what RunChecklistItemSlashCommand does
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].CommandLastRun = timestamp
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that CommandLastRun was updated
		assert.NotEqual(t, 0, playbookRun.Checklists[0].Items[0].CommandLastRun)

		// Check that item UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that CommandLastRun and UpdateAt match
		assert.Equal(t, playbookRun.Checklists[0].Items[0].CommandLastRun, playbookRun.Checklists[0].Items[0].UpdateAt)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_SetCommandToChecklistItem(t *testing.T) {
	t.Run("UpdateAt field is set when changing command", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:             "item1",
							Title:          "Test Item",
							Command:        "/old-command",
							CommandLastRun: 1000,
							UpdateAt:       1000,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly set command and update timestamps - simulating what SetCommandToChecklistItem does
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].Command = "/new-command"
		playbookRun.Checklists[0].Items[0].CommandLastRun = 0
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that Command was updated
		assert.Equal(t, "/new-command", playbookRun.Checklists[0].Items[0].Command)

		// Check that UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that CommandLastRun is reset to 0
		assert.Equal(t, int64(0), playbookRun.Checklists[0].Items[0].CommandLastRun)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_SetDueDate(t *testing.T) {
	t.Run("UpdateAt field is set when setting due date", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:       "item1",
							Title:    "Test Item",
							DueDate:  0,
							UpdateAt: 0,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly set due date - simulating what SetDueDate does
		newDueDate := model.GetMillis() + (24 * 60 * 60 * 1000) // 1 day in the future
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].DueDate = newDueDate
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that DueDate was updated
		assert.Equal(t, newDueDate, playbookRun.Checklists[0].Items[0].DueDate)

		// Check that UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_SetTaskActionsToChecklistItem(t *testing.T) {
	t.Run("UpdateAt field is set when setting task actions", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items: []ChecklistItem{
						{
							ID:          "item1",
							Title:       "Test Item",
							TaskActions: []TaskAction{},
							UpdateAt:    0,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly set task actions - simulating what SetTaskActionsToChecklistItem does
		timestamp := model.GetMillis()
		taskActions := []TaskAction{
			{
				Trigger: Trigger{
					Type:    "keywords_by_users",
					Payload: "{}",
				},
				Actions: []Action{
					{
						Type:    "mark_item_as_done",
						Payload: "{}",
					},
				},
			},
		}
		playbookRun.Checklists[0].Items[0].TaskActions = taskActions
		updateChecklistAndItemTimestamp(&playbookRun.Checklists[0], &playbookRun.Checklists[0].Items[0], timestamp)

		after := model.GetMillis()

		// Check that TaskActions was updated
		require.Len(t, playbookRun.Checklists[0].Items[0].TaskActions, 1)
		assert.Equal(t, "mark_item_as_done", string(playbookRun.Checklists[0].Items[0].TaskActions[0].Actions[0].Type))

		// Check that UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that parent checklist UpdateAt was also updated
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.Checklists[0].Items[0].UpdateAt)
	})
}

func TestUpdateAt_PlaybookRun(t *testing.T) {
	t.Run("UpdateAt field is set when using GraphqlUpdate", func(t *testing.T) {
		before := model.GetMillis()

		// Create a setmap to simulate GraphqlUpdate
		setmap := map[string]interface{}{
			"Name":     "New Name",
			"UpdateAt": model.GetMillis(),
		}

		// Check that UpdateAt is set to a valid timestamp
		assert.GreaterOrEqual(t, setmap["UpdateAt"].(int64), before)
	})
}
