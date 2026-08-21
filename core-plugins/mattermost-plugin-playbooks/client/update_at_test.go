// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlaybookRunUpdateAtSerialization(t *testing.T) {
	// Create a PlaybookRun with UpdateAt field set
	now := time.Now().UnixMilli()
	run := PlaybookRun{
		ID:       "test-id",
		Name:     "Test Run",
		CreateAt: now - 1000, // 1 second earlier
		UpdateAt: now,
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(run)
	require.NoError(t, err, "Failed to marshal PlaybookRun to JSON")

	// Validate that UpdateAt field is included in the JSON
	jsonStr := string(jsonData)
	assert.Contains(t, jsonStr, `"update_at":`, "JSON should contain update_at field")
	assert.Contains(t, jsonStr, `"create_at":`, "JSON should contain create_at field")

	// Deserialize from JSON
	var decodedRun PlaybookRun
	err = json.Unmarshal(jsonData, &decodedRun)
	require.NoError(t, err, "Failed to unmarshal PlaybookRun from JSON")

	// Validate the UpdateAt field was preserved
	assert.Equal(t, run.UpdateAt, decodedRun.UpdateAt, "UpdateAt field should be preserved after serialization/deserialization")
	assert.Equal(t, now, decodedRun.UpdateAt, "UpdateAt value should be preserved")
}

func TestChecklistUpdateAtSerialization(t *testing.T) {
	// Create a Checklist with UpdateAt field set
	now := time.Now().UnixMilli()
	checklist := Checklist{
		ID:       "test-checklist-id",
		Title:    "Test Checklist",
		UpdateAt: now,
		Items:    []ChecklistItem{},
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(checklist)
	require.NoError(t, err, "Failed to marshal Checklist to JSON")

	// Validate that UpdateAt field is included in the JSON
	jsonStr := string(jsonData)
	assert.Contains(t, jsonStr, `"update_at":`, "JSON should contain update_at field")

	// Deserialize from JSON
	var decodedChecklist Checklist
	err = json.Unmarshal(jsonData, &decodedChecklist)
	require.NoError(t, err, "Failed to unmarshal Checklist from JSON")

	// Validate the UpdateAt field was preserved
	assert.Equal(t, checklist.UpdateAt, decodedChecklist.UpdateAt, "UpdateAt field should be preserved after serialization/deserialization")
	assert.Equal(t, now, decodedChecklist.UpdateAt, "UpdateAt value should be preserved")
}

func TestChecklistItemUpdateAtSerialization(t *testing.T) {
	// Create a ChecklistItem with UpdateAt field set
	now := time.Now().UnixMilli()
	item := ChecklistItem{
		ID:       "test-item-id",
		Title:    "Test Item",
		UpdateAt: now,
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(item)
	require.NoError(t, err, "Failed to marshal ChecklistItem to JSON")

	// Validate that UpdateAt field is included in the JSON
	jsonStr := string(jsonData)
	assert.Contains(t, jsonStr, `"update_at":`, "JSON should contain update_at field")

	// Deserialize from JSON
	var decodedItem ChecklistItem
	err = json.Unmarshal(jsonData, &decodedItem)
	require.NoError(t, err, "Failed to unmarshal ChecklistItem from JSON")

	// Validate the UpdateAt field was preserved
	assert.Equal(t, item.UpdateAt, decodedItem.UpdateAt, "UpdateAt field should be preserved after serialization/deserialization")
	assert.Equal(t, now, decodedItem.UpdateAt, "UpdateAt value should be preserved")
}

func TestNestedUpdateAtSerialization(t *testing.T) {
	// Create a nested structure to test the complete serialization path
	now := time.Now().UnixMilli()

	// Create a checklist item with UpdateAt
	item := ChecklistItem{
		ID:       "test-item-id",
		Title:    "Test Item",
		UpdateAt: now,
	}

	// Create a checklist with the item
	checklist := Checklist{
		ID:       "test-checklist-id",
		Title:    "Test Checklist",
		UpdateAt: now + 1000, // 1 second later
		Items:    []ChecklistItem{item},
	}

	// Create a PlaybookRun with the checklist
	run := PlaybookRun{
		ID:         "test-run-id",
		Name:       "Test Run",
		CreateAt:   now - 1000, // 1 second earlier
		UpdateAt:   now + 2000, // 2 seconds later
		Checklists: []Checklist{checklist},
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(run)
	require.NoError(t, err, "Failed to marshal nested structure to JSON")

	// Deserialize from JSON
	var decodedRun PlaybookRun
	err = json.Unmarshal(jsonData, &decodedRun)
	require.NoError(t, err, "Failed to unmarshal nested structure from JSON")

	// Validate the UpdateAt fields were preserved at all levels
	assert.Equal(t, run.UpdateAt, decodedRun.UpdateAt, "Run UpdateAt should be preserved")
	require.Len(t, decodedRun.Checklists, 1, "Should have one checklist")
	assert.Equal(t, checklist.UpdateAt, decodedRun.Checklists[0].UpdateAt, "Checklist UpdateAt should be preserved")
	require.Len(t, decodedRun.Checklists[0].Items, 1, "Should have one checklist item")
	assert.Equal(t, item.UpdateAt, decodedRun.Checklists[0].Items[0].UpdateAt, "ChecklistItem UpdateAt should be preserved")
}
