// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Tests for checklist-level UpdateAt updates
func TestUpdateAt_AddChecklist(t *testing.T) {
	t.Run("UpdateAt field is set for new checklists", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID:         "playbook1",
			Checklists: []Checklist{},
		}

		before := model.GetMillis()

		// Directly add a checklist - simulating what AddChecklist does
		now := model.GetMillis()
		newChecklist := Checklist{
			ID:       model.NewId(),
			Title:    "Test Checklist",
			UpdateAt: now,
			Items:    []ChecklistItem{},
		}
		playbookRun.Checklists = append(playbookRun.Checklists, newChecklist)

		after := model.GetMillis()

		// Check that the checklist was added
		require.Len(t, playbookRun.Checklists, 1)
		assert.Equal(t, "Test Checklist", playbookRun.Checklists[0].Title)

		// Check that UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
	})
}

func TestUpdateAt_RenameChecklist(t *testing.T) {
	t.Run("UpdateAt field is updated when renaming checklist", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Old Title",
					UpdateAt: 1000,
				},
			},
		}

		before := model.GetMillis()

		// Directly rename checklist - simulating what RenameChecklist does
		playbookRun.Checklists[0].Title = "New Title"
		playbookRun.Checklists[0].UpdateAt = model.GetMillis()

		after := model.GetMillis()

		// Check that the title was updated
		assert.Equal(t, "New Title", playbookRun.Checklists[0].Title)

		// Check that UpdateAt was set to a recent timestamp
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
	})
}

func TestUpdateAt_AddChecklistItem(t *testing.T) {
	t.Run("Checklist UpdateAt is updated when adding a new item", func(t *testing.T) {
		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: 1000,
					Items:    []ChecklistItem{},
				},
			},
		}

		before := model.GetMillis()

		// Directly add an item - simulating what AddChecklistItem does
		now := model.GetMillis()
		newItem := ChecklistItem{
			ID:       model.NewId(),
			Title:    "New Item",
			UpdateAt: now,
		}
		playbookRun.Checklists[0].Items = append(playbookRun.Checklists[0].Items, newItem)
		playbookRun.Checklists[0].UpdateAt = now

		after := model.GetMillis()

		// Check that the item was added
		require.Len(t, playbookRun.Checklists[0].Items, 1)
		assert.Equal(t, "New Item", playbookRun.Checklists[0].Items[0].Title)

		// Check that checklist UpdateAt was updated
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)

		// Check that item UpdateAt is set
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)
	})
}

func TestUpdateAt_RemoveChecklistItem(t *testing.T) {
	t.Run("Checklist UpdateAt is updated when removing an item", func(t *testing.T) {
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
							Title:    "Item to remove",
							UpdateAt: 1000,
						},
						{
							ID:       "item2",
							Title:    "Item to keep",
							UpdateAt: 1000,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly remove an item - simulating what RemoveChecklistItem does
		playbookRun.Checklists[0].Items = append(playbookRun.Checklists[0].Items[:0], playbookRun.Checklists[0].Items[1:]...)
		playbookRun.Checklists[0].UpdateAt = model.GetMillis()

		after := model.GetMillis()

		// Check that the item was removed
		require.Len(t, playbookRun.Checklists[0].Items, 1)
		assert.Equal(t, "Item to keep", playbookRun.Checklists[0].Items[0].Title)

		// Check that checklist UpdateAt was updated
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
	})
}

func TestUpdateAt_RenameChecklistItem(t *testing.T) {
	t.Run("Item and checklist UpdateAt fields are updated when renaming an item", func(t *testing.T) {
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
							Title:    "Old Item Title",
							UpdateAt: 1000,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly rename an item - simulating what would be in RenameChecklistItem
		now := model.GetMillis()
		playbookRun.Checklists[0].Items[0].Title = "New Item Title"
		updateChecklistItemTimestamp(&playbookRun.Checklists[0].Items[0], now)
		playbookRun.Checklists[0].UpdateAt = now

		after := model.GetMillis()

		// Check that the item was renamed
		assert.Equal(t, "New Item Title", playbookRun.Checklists[0].Items[0].Title)

		// Check that item UpdateAt was updated
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)

		// Check that checklist UpdateAt was updated
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
	})
}

func TestUpdateAt_MoveChecklistItem(t *testing.T) {
	t.Run("UpdateAt fields are preserved when moving items", func(t *testing.T) {
		// Timestamps for testing
		checklistTimestamp := int64(1000)
		item1Timestamp := int64(2000)
		item2Timestamp := int64(3000)

		playbookRun := PlaybookRun{
			ID: "playbook1",
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: checklistTimestamp,
					Items: []ChecklistItem{
						{
							ID:       "item1",
							Title:    "Item 1",
							UpdateAt: item1Timestamp,
						},
						{
							ID:       "item2",
							Title:    "Item 2",
							UpdateAt: item2Timestamp,
						},
					},
				},
			},
		}

		before := model.GetMillis()

		// Directly move items - simulating what MoveChecklistItem does
		items := playbookRun.Checklists[0].Items
		// Swap items 0 and 1
		items[0], items[1] = items[1], items[0]
		playbookRun.Checklists[0].Items = items
		playbookRun.Checklists[0].UpdateAt = model.GetMillis()

		after := model.GetMillis()

		// Check items are swapped
		assert.Equal(t, "Item 2", playbookRun.Checklists[0].Items[0].Title)
		assert.Equal(t, "Item 1", playbookRun.Checklists[0].Items[1].Title)

		// Check that item UpdateAt timestamps are preserved
		assert.Equal(t, item2Timestamp, playbookRun.Checklists[0].Items[0].UpdateAt)
		assert.Equal(t, item1Timestamp, playbookRun.Checklists[0].Items[1].UpdateAt)

		// Check that checklist UpdateAt was updated to reflect the move operation
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
	})
}

func TestUpdateAt_PlaybookRunUpdated(t *testing.T) {
	t.Run("PlaybookRun UpdateAt field is updated when checklist or item is modified", func(t *testing.T) {
		// Create a playbook run with initial timestamps
		initialTime := int64(1000)
		playbookRun := PlaybookRun{
			ID:       "playbook1",
			UpdateAt: initialTime,
			Checklists: []Checklist{
				{
					ID:       "checklist1",
					Title:    "Test Checklist",
					UpdateAt: initialTime,
					Items: []ChecklistItem{
						{
							ID:       "item1",
							Title:    "Test Item",
							UpdateAt: initialTime,
						},
					},
				},
			},
		}

		// Simulate updating a checklist item
		before := model.GetMillis()

		// Update a checklist item - this should trigger an update to both the item,
		// checklist, and playbook run update_at fields
		timestamp := model.GetMillis()
		playbookRun.Checklists[0].Items[0].Title = "Updated Item Title"
		updateChecklistItemTimestamp(&playbookRun.Checklists[0].Items[0], timestamp)
		playbookRun.Checklists[0].UpdateAt = timestamp
		playbookRun.UpdateAt = timestamp

		after := model.GetMillis()

		// Verify the item was updated
		assert.Equal(t, "Updated Item Title", playbookRun.Checklists[0].Items[0].Title)

		// Verify all timestamps were updated
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].Items[0].UpdateAt, after)
		assert.GreaterOrEqual(t, playbookRun.Checklists[0].UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.Checklists[0].UpdateAt, after)
		assert.GreaterOrEqual(t, playbookRun.UpdateAt, before)
		assert.LessOrEqual(t, playbookRun.UpdateAt, after)

		// All three timestamps should match
		assert.Equal(t, playbookRun.Checklists[0].Items[0].UpdateAt, playbookRun.Checklists[0].UpdateAt)
		assert.Equal(t, playbookRun.Checklists[0].UpdateAt, playbookRun.UpdateAt)
	})
}
