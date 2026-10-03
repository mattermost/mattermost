// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPlaybookRun_MarshalJSON(t *testing.T) {
	t.Run("marshal pointer", func(t *testing.T) {
		testPlaybookRun := &PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		resultStr := string(result)

		// Check that critical slice fields are initialized to empty arrays, not null
		require.Contains(t, resultStr, "\"checklists\":[]", "checklists should be empty array")
		require.Contains(t, resultStr, "\"status_posts\":[]", "status_posts should be empty array")
		require.Contains(t, resultStr, "\"invited_user_ids\":[]", "invited_user_ids should be empty array")
		require.Contains(t, resultStr, "\"timeline_events\":[]", "timeline_events should be empty array")
		require.Contains(t, resultStr, "\"participant_ids\":[]", "participant_ids should be empty array")
		require.Contains(t, resultStr, "\"metrics_data\":[]", "metrics_data should be empty array")

		// ItemsOrder should be null when no checklists exist
		require.Contains(t, resultStr, "\"items_order\":null", "items_order should be null when no checklists")
	})

	t.Run("marshal value", func(t *testing.T) {
		testPlaybookRun := PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		resultStr := string(result)

		// Check that critical slice fields are initialized to empty arrays, not null
		require.Contains(t, resultStr, "\"checklists\":[]", "checklists should be empty array")
		require.Contains(t, resultStr, "\"status_posts\":[]", "status_posts should be empty array")
		require.Contains(t, resultStr, "\"invited_user_ids\":[]", "invited_user_ids should be empty array")
		require.Contains(t, resultStr, "\"timeline_events\":[]", "timeline_events should be empty array")
		require.Contains(t, resultStr, "\"participant_ids\":[]", "participant_ids should be empty array")
		require.Contains(t, resultStr, "\"metrics_data\":[]", "metrics_data should be empty array")

		// ItemsOrder should be null when no checklists exist
		require.Contains(t, resultStr, "\"items_order\":null", "items_order should be null when no checklists")
	})
}

func TestPlaybookRunFilterOptions_Clone(t *testing.T) {
	options := PlaybookRunFilterOptions{
		TeamID:        "team_id",
		Page:          1,
		PerPage:       10,
		Sort:          SortByID,
		Direction:     DirectionAsc,
		Statuses:      []string{"InProgress", "Finished"},
		OwnerID:       "owner_id",
		ParticipantID: "participant_id",
		SearchTerm:    "search_term",
		PlaybookID:    "playbook_id",
	}
	marshalledOptions, err := json.Marshal(options)
	require.NoError(t, err)

	clone := options.Clone()
	clone.TeamID = "team_id_clone"
	clone.Page = 2
	clone.PerPage = 20
	clone.Sort = SortByName
	clone.Direction = DirectionDesc
	clone.Statuses[0] = "Finished"
	clone.OwnerID = "owner_id_clone"
	clone.ParticipantID = "participant_id_clone"
	clone.SearchTerm = "search_term_clone"
	clone.PlaybookID = "playbook_id_clone"

	var unmarshalledOptions PlaybookRunFilterOptions
	err = json.Unmarshal(marshalledOptions, &unmarshalledOptions)
	require.NoError(t, err)
	require.Equal(t, options, unmarshalledOptions)
	require.NotEqual(t, clone, unmarshalledOptions)
}

func TestDetectChangedFields(t *testing.T) {
	t.Run("nil runs", func(t *testing.T) {
		// Test with nil runs
		changes := DetectChangedFields(nil, nil)
		require.Nil(t, changes)

		// Test with one nil run
		prev := &PlaybookRun{ID: "run1"}
		changes = DetectChangedFields(prev, nil)
		require.Nil(t, changes)

		changes = DetectChangedFields(nil, prev)
		require.Nil(t, changes)
	})

	t.Run("no changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}
		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}

		changes := DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("scalar field changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}
		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1 Updated", // Changed
			Summary:     "New Summary",   // Changed
			OwnerUserID: "user1",
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "New Summary", changes["summary"])
	})

	t.Run("array field changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2"},
			InvitedUserIDs:      []string{"user3"},
			BroadcastChannelIDs: []string{"channel1"},
		}
		curr := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2", "user3"}, // Added user3
			InvitedUserIDs:      []string{"user3"},                   // No change
			BroadcastChannelIDs: []string{"channel1", "channel2"},    // Added channel2
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)
		require.ElementsMatch(t, []string{"user1", "user2", "user3"}, changes["participant_ids"])
		require.ElementsMatch(t, []string{"channel1", "channel2"}, changes["broadcast_channel_ids"])
	})

	t.Run("array field with different order but same elements", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2", "user3"},
			InvitedUserIDs:      []string{"user4", "user5"},
			BroadcastChannelIDs: []string{"channel1", "channel2"},
		}
		curr := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user3", "user1", "user2"}, // Same users but different order
			InvitedUserIDs:      []string{"user5", "user4"},          // Same users but different order
			BroadcastChannelIDs: []string{"channel2", "channel1"},    // Same channels but different order
		}

		// StringSetsEqual should treat these as equal since order doesn't matter
		changes := DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("status posts changes", func(t *testing.T) {
		prevPost := StatusPost{
			ID:       "post1",
			CreateAt: 100,
			DeleteAt: 0,
		}

		// Same post but different delete time
		currPost := StatusPost{
			ID:       "post1",
			CreateAt: 100,
			DeleteAt: 200, // Changed
		}

		prev := &PlaybookRun{
			ID:          "run1",
			StatusPosts: []StatusPost{prevPost},
		}
		curr := &PlaybookRun{
			ID:          "run1",
			StatusPosts: []StatusPost{currPost},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		statusPosts, ok := changes["status_posts"].([]StatusPost)
		require.True(t, ok)
		require.Len(t, statusPosts, 1)
		require.Equal(t, int64(200), statusPosts[0].DeleteAt)
	})

	t.Run("timeline events changes", func(t *testing.T) {
		prevEvent := TimelineEvent{
			ID:        "event1",
			CreateAt:  100,
			DeleteAt:  0,
			EventType: "type1",
			Summary:   "summary1",
		}

		// Added new event
		curr := &PlaybookRun{
			ID: "run1",
			TimelineEvents: []TimelineEvent{
				prevEvent,
				{
					ID:        "event2",
					CreateAt:  200,
					DeleteAt:  0,
					EventType: "type2",
					Summary:   "summary2",
				},
			},
		}
		prev := &PlaybookRun{
			ID:             "run1",
			TimelineEvents: []TimelineEvent{prevEvent},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		events, ok := changes["timeline_events"].([]TimelineEvent)
		require.True(t, ok)
		require.Len(t, events, 1)
		require.Equal(t, "event2", events[0].ID)
		require.Equal(t, "type2", string(events[0].EventType))
		require.Equal(t, "summary2", events[0].Summary)
	})

	t.Run("metrics data changes", func(t *testing.T) {
		// Create a dummy value for Value field
		dummyValue1 := RunMetricData{}.Value // get zero value
		dummyValue2 := RunMetricData{}.Value // get zero value

		// Set valid values through struct initialization
		prevMetric := RunMetricData{
			MetricConfigID: "metric1",
			Value:          dummyValue1,
		}

		// Changed value - we'll update just the MetricConfigID for simplicity
		currMetric := RunMetricData{
			MetricConfigID: "metric2", // Changed
			Value:          dummyValue2,
		}

		prev := &PlaybookRun{
			ID:          "run1",
			MetricsData: []RunMetricData{prevMetric},
		}
		curr := &PlaybookRun{
			ID:          "run1",
			MetricsData: []RunMetricData{currMetric},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		metrics, ok := changes["metrics_data"].([]RunMetricData)
		require.True(t, ok)
		require.Len(t, metrics, 1)
		require.Equal(t, "metric2", metrics[0].MetricConfigID)
	})

	t.Run("checklist changes", func(t *testing.T) {
		prevItem := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateOpen,
		}
		prevChecklist := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{prevItem},
		}

		// Changed item state
		currItem := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateClosed, // Changed
		}
		currChecklist := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{currItem},
		}

		prev := &PlaybookRun{
			ID:         "run1",
			Checklists: []Checklist{prevChecklist},
		}
		curr := &PlaybookRun{
			ID:         "run1",
			Checklists: []Checklist{currChecklist},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)

		// Verify the checklist item state was detected as changed
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("multiple field types changing simultaneously", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1",
			OwnerUserID:         "user1",
			ParticipantIDs:      []string{"user1", "user2"},
			StatusUpdateEnabled: true,
			Checklists: []Checklist{{
				ID:    "checklist1",
				Title: "Checklist 1",
				Items: []ChecklistItem{{
					ID:    "item1",
					Title: "Item 1",
					State: ChecklistItemStateOpen,
				}},
			}},
		}

		curr := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1 Updated",            // Changed scalar
			OwnerUserID:         "user2",                    // Changed scalar
			ParticipantIDs:      []string{"user1", "user3"}, // Changed array
			StatusUpdateEnabled: false,                      // Changed boolean
			Checklists: []Checklist{{
				ID:    "checklist1",
				Title: "Checklist 1 Updated", // Changed checklist title
				Items: []ChecklistItem{{
					ID:    "item1",
					Title: "Item 1",
					State: ChecklistItemStateClosed, // Changed item state
				}},
			}},
		}

		changes := DetectChangedFields(prev, curr)

		// Validate the changes contain all expected fields
		require.Len(t, changes, 5)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "user2", changes["owner_user_id"])
		require.Equal(t, false, changes["status_update_enabled"])
		require.ElementsMatch(t, []string{"user1", "user3"}, changes["participant_ids"])

		// Validate checklist changes
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// Verify checklist title change
		require.Contains(t, checklistUpdates[0].Fields, "title")
		require.Equal(t, "Checklist 1 Updated", checklistUpdates[0].Fields["title"])

		// Verify item state change
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("adding and removing array elements", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1", "user2", "user3"},
			InvitedUserIDs: []string{"user1", "user2", "user3", "user4"},
		}

		curr := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1", "user4", "user5"}, // Removed user2, user3; Added user4, user5
			InvitedUserIDs: []string{"user1", "user2"},          // Removed user3, user4
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)

		// Check participant changes
		participants, ok := changes["participant_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1", "user4", "user5"}, participants)

		// Check invited users changes
		invitedUsers, ok := changes["invited_user_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1", "user2"}, invitedUsers)
	})

	t.Run("adding and removing checklists", func(t *testing.T) {
		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)

		// Validate that the checklist addition was detected
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)

		// Validate that the items order change was detected
		itemsOrder, ok := changes["items_order"].([]string)
		require.True(t, ok)
		require.Equal(t, []string{"checklist1", "checklist2"}, itemsOrder)

		// There should be a change detecting the new checklist
		require.NotEmpty(t, checklistUpdates)
	})

	t.Run("reordering checklist items", func(t *testing.T) {
		items1 := []ChecklistItem{
			{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
			{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
		}

		items2 := []ChecklistItem{
			{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
			{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
		}

		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "Checklist 1", Items: items1, ItemsOrder: []string{"item1", "item2"}},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "Checklist 1", Items: items2, ItemsOrder: []string{"item2", "item1"}},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// There should be a change to indicate reordering
		require.NotEmpty(t, changes)

		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.NotEmpty(t, checklistUpdates)
	})

	t.Run("edge case - empty arrays", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{},
			InvitedUserIDs: []string{"user1"},
			Checklists:     []Checklist{},
		}

		curr := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1"},
			InvitedUserIDs: []string{},
			Checklists:     []Checklist{},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)

		// Check that going from empty to populated is detected
		participants, ok := changes["participant_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1"}, participants)

		// Check that going from populated to empty is detected
		invitedUsers, ok := changes["invited_user_ids"].([]string)
		require.True(t, ok)
		require.Empty(t, invitedUsers)
	})

	t.Run("items order changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "Checklist 1"},
				{ID: "checklist2", Title: "Checklist 2"},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist2", Title: "Checklist 2"},
				{ID: "checklist1", Title: "Checklist 1"},
			},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		require.Equal(t, []string{"checklist2", "checklist1"}, changes["items_order"])

		// When order is the same, no changes should be detected
		prev.Checklists = curr.Checklists
		changes = DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("checklist items order changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID: "checklist1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1"},
						{ID: "item2", Title: "Item 2"},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID: "checklist1",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2"},
						{ID: "item1", Title: "Item 1"},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)
		require.Equal(t, []string{"item2", "item1"}, checklistUpdates[0].ItemsOrder)

		// When order is the same, no changes should be detected
		prev.Checklists[0].Items = curr.Checklists[0].Items
		changes = DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})
}

func TestPlaybookRunFilterOptions_Validate(t *testing.T) {
	t.Run("non-positive PerPage", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			PerPage: -1,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, PerPageDefault, validOptions.PerPage)
	})

	t.Run("invalid sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("END_at"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByEndAt, validOptions.Sort)
	})

	t.Run("valid, no explicit sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByCreateAt, validOptions.Sort)
	})

	t.Run("invalid sort direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case direction option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("DEsC"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionDesc, validOptions.Direction)
	})

	t.Run("valid, no explicit direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionAsc, validOptions.Direction)
	})

	t.Run("invalid team id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid owner id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			OwnerID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid participant id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			ParticipantID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid playbook id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:     model.NewId(),
			PlaybookID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid statuses", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			Page:          1,
			PerPage:       10,
			Sort:          SortByID,
			Direction:     DirectionAsc,
			Statuses:      []string{"active", "Finished"},
			OwnerID:       model.NewId(),
			ParticipantID: model.NewId(),
			SearchTerm:    "search_term",
			PlaybookID:    model.NewId(),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid status", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			Page:          1,
			PerPage:       10,
			Sort:          SortByID,
			Direction:     DirectionAsc,
			Statuses:      []string{"InProgress", "Finished"},
			OwnerID:       model.NewId(),
			ParticipantID: model.NewId(),
			SearchTerm:    "search_term",
			PlaybookID:    model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options, validOptions)
	})

	t.Run("only run-level changes - no checklist or item changes", func(t *testing.T) {
		// Create identical checklists
		checklistA := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{
				{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
			},
		}

		prev := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1",
			Summary:             "Original summary",
			OwnerUserID:         "user1",
			StatusUpdateEnabled: true,
			Checklists:          []Checklist{checklistA},
		}

		curr := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1 Updated",         // Changed
			Summary:             "Original summary",      // Unchanged
			OwnerUserID:         "user2",                 // Changed
			StatusUpdateEnabled: true,                    // Unchanged
			Checklists:          []Checklist{checklistA}, // Unchanged
		}

		changes := DetectChangedFields(prev, curr)

		// Only run-level fields should be detected as changed
		require.Len(t, changes, 2)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "user2", changes["owner_user_id"])

		// No checklist changes should be reported
		_, hasChecklistChanges := changes["checklists"]
		require.False(t, hasChecklistChanges)
	})

	t.Run("only checklist-level changes - no run or item changes", func(t *testing.T) {
		itemA := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateOpen,
		}

		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			OwnerUserID: "user1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Original Title",
					Items: []ChecklistItem{itemA},
				},
			},
		}

		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1", // Unchanged
			OwnerUserID: "user1", // Unchanged
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "New Title",            // Changed
					Items: []ChecklistItem{itemA}, // Unchanged
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// Only checklist-level changes should be detected
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// Verify the checklist title is changed
		require.Equal(t, "checklist1", checklistUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].Fields, "title")
		require.Equal(t, "New Title", checklistUpdates[0].Fields["title"])

		// No item updates should be present
		require.Empty(t, checklistUpdates[0].ItemUpdates)
	})

	t.Run("only checklist-item-level changes - no run or checklist changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			OwnerUserID: "user1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{
							ID:    "item1",
							Title: "Item 1",
							State: ChecklistItemStateOpen,
						},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1", // Unchanged
			OwnerUserID: "user1", // Unchanged
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1", // Unchanged
					Items: []ChecklistItem{
						{
							ID:    "item1",
							Title: "Item 1",
							State: ChecklistItemStateClosed, // Changed
						},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// Only item-level changes should be detected
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// No checklist title changes
		_, hasTitleChange := checklistUpdates[0].Fields["title"]
		require.False(t, hasTitleChange)

		// Verify item change is detected
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("multiple checklists with changes at different levels", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:   "run1",
			Name: "Run 1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist3",
					Title: "Checklist 3",
					Items: []ChecklistItem{
						{ID: "item3", Title: "Item 3", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID:   "run1",
			Name: "Run 1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1 Modified", // Checklist title change
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateClosed}, // Item state change
					},
				},
				// checklist3 deleted, checklist4 added
				{
					ID:    "checklist4",
					Title: "Checklist 4",
					Items: []ChecklistItem{
						{ID: "item4", Title: "Item 4", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// There should be checklist changes (updates and deletions) and items_order change
		require.Len(t, changes, 3)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)

		// We should have updates for three checklists (modified, modified, added)
		// and implicitly recognize the deletion of checklist3
		require.NotEmpty(t, checklistUpdates)

		// Verify we have a mixture of different types of changes
		checklistTitleChanged := false
		itemStateChanged := false
		checklistAdded := false

		for _, update := range checklistUpdates {
			if update.ID == "checklist1" && update.Fields["title"] == "Checklist 1 Modified" {
				checklistTitleChanged = true
			}

			if update.ID == "checklist2" && len(update.ItemUpdates) > 0 {
				itemState, exists := update.ItemUpdates[0].Fields["state"]
				if exists && itemState == ChecklistItemStateClosed {
					itemStateChanged = true
				}
			}

			if update.ID == "checklist4" {
				checklistAdded = true
			}
		}

		require.True(t, checklistTitleChanged, "Failed to detect checklist title change")
		require.True(t, itemStateChanged, "Failed to detect item state change")
		require.True(t, checklistAdded, "Failed to detect checklist addition")

		// Test that checklist deletion is handled via ChecklistDeletes
		checklistDeletes, ok := changes["_checklist_deletes"].([]string)
		require.True(t, ok, "Expected _checklist_deletes to be present in changes")
		require.Len(t, checklistDeletes, 1, "Expected exactly one checklist deletion")
		require.Equal(t, "checklist3", checklistDeletes[0], "Expected checklist3 to be deleted")

		// Test that items_order change is detected when checklists are added/removed
		itemsOrder, ok := changes["items_order"].([]string)
		require.True(t, ok, "Expected items_order to be present in changes")
		require.Equal(t, []string{"checklist1", "checklist2", "checklist4"}, itemsOrder)
	})
}

func TestPlaybookRun_GetItemsOrder(t *testing.T) {
	playbookRun := &PlaybookRun{
		Checklists: []Checklist{
			{ID: "checklist1"},
			{ID: "checklist2"},
		},
	}

	itemsOrder := playbookRun.GetItemsOrder()
	require.Equal(t, []string{"checklist1", "checklist2"}, itemsOrder)

	playbookRun.Checklists = []Checklist{
		{ID: "checklist2"},
		{ID: "checklist1"},
	}

	itemsOrder = playbookRun.GetItemsOrder()
	require.Equal(t, []string{"checklist2", "checklist1"}, itemsOrder)

	playbookRun.Checklists = []Checklist{}
	itemsOrder = playbookRun.GetItemsOrder()
	require.Nil(t, itemsOrder)
}

func TestPlaybookRun_CompareItemsOrder(t *testing.T) {
	prev := []string{"checklist1", "checklist2"}
	curr := []string{"checklist2", "checklist1"}

	require.False(t, compareItemsOrder(prev, curr))

	prev = []string{"checklist1", "checklist2"}
	curr = []string{"checklist1", "checklist2"}
	require.True(t, compareItemsOrder(prev, curr))

	prev = []string{"checklist1", "checklist2"}
	curr = []string{"checklist1", "checklist2", "checklist3"}
	require.False(t, compareItemsOrder(prev, curr))

	prev = []string{"checklist1", "checklist2", "checklist3"}
	curr = []string{"checklist1", "checklist2"}
	require.False(t, compareItemsOrder(prev, curr))
}

func TestPlaybookRun_Clone(t *testing.T) {
	// Create original data fresh for each test to avoid cross-test pollution
	createOriginal := func() *PlaybookRun {
		return &PlaybookRun{
			ID:                        "run1",
			Name:                      "Test Run",
			Summary:                   "Test Summary",
			OwnerUserID:               "user1",
			ReporterUserID:            "user2",
			TeamID:                    "team1",
			ChannelID:                 "channel1",
			CreateAt:                  1000,
			UpdateAt:                  2000,
			EndAt:                     3000,
			DeleteAt:                  0,
			PlaybookID:                "playbook1",
			StatusPosts:               []StatusPost{{ID: "post1", CreateAt: 100}},
			TimelineEvents:            []TimelineEvent{{ID: "event1", CreateAt: 200}},
			InvitedUserIDs:            []string{"user3", "user4"},
			InvitedGroupIDs:           []string{"group1", "group2"},
			ParticipantIDs:            []string{"user5", "user6"},
			WebhookOnCreationURLs:     []string{"http://example.com/hook1"},
			WebhookOnStatusUpdateURLs: []string{"http://example.com/hook2"},
			MetricsData:               []RunMetricData{{MetricConfigID: "metric1"}},
			BroadcastChannelIDs:       []string{"broadcast1", "broadcast2"},
			ItemsOrder:                []string{"checklist1", "checklist2"},
			Checklists: []Checklist{
				{
					ID:         "checklist1",
					Title:      "Checklist 1",
					Items:      []ChecklistItem{{ID: "item1", Title: "Item 1"}},
					ItemsOrder: []string{"item1"},
				},
				{
					ID:         "checklist2",
					Title:      "Checklist 2",
					Items:      []ChecklistItem{{ID: "item2", Title: "Item 2"}},
					ItemsOrder: []string{"item2"},
				},
			},
		}
	}

	t.Run("creates deep copy with proper isolation", func(t *testing.T) {
		original := createOriginal()
		cloned := original.Clone()

		// Verify it's a different instance
		require.NotSame(t, original, cloned)

		// Verify scalar fields are copied correctly
		require.Equal(t, original.ID, cloned.ID)
		require.Equal(t, original.Name, cloned.Name)
		require.Equal(t, original.Summary, cloned.Summary)
		require.Equal(t, original.OwnerUserID, cloned.OwnerUserID)
		require.Equal(t, original.CreateAt, cloned.CreateAt)
		require.Equal(t, original.UpdateAt, cloned.UpdateAt)

		// Verify checklists are deep copied - compare content, not pointers
		require.Len(t, cloned.Checklists, 2)
		require.Equal(t, original.Checklists[0].ID, cloned.Checklists[0].ID)
		require.Equal(t, original.Checklists[0].Title, cloned.Checklists[0].Title)

		// Verify slice contents are copied correctly
		require.Equal(t, original.StatusPosts, cloned.StatusPosts)
		require.Equal(t, original.TimelineEvents, cloned.TimelineEvents)
		require.Equal(t, original.InvitedUserIDs, cloned.InvitedUserIDs)
		require.Equal(t, original.ParticipantIDs, cloned.ParticipantIDs)
		require.Equal(t, original.MetricsData, cloned.MetricsData)

		// Verify deep copy by modifying cloned slices and ensuring original is unaffected
		if len(cloned.InvitedUserIDs) > 0 {
			cloned.InvitedUserIDs[0] = "modified_user"
			require.Equal(t, "user3", original.InvitedUserIDs[0], "Original should not be affected by clone modifications")
		}
	})

	t.Run("defensive programming - ItemsOrder is set to nil", func(t *testing.T) {
		original := createOriginal()
		cloned := original.Clone()

		// ItemsOrder should be nil for defensive programming
		require.Nil(t, cloned.ItemsOrder, "ItemsOrder should be nil to force recomputation")

		// But GetItemsOrder() should still work correctly
		expectedOrder := cloned.GetItemsOrder()
		require.Equal(t, []string{"checklist1", "checklist2"}, expectedOrder)
	})

	t.Run("defensive programming - checklist ItemsOrder is set to nil", func(t *testing.T) {
		original := createOriginal()
		cloned := original.Clone()

		// Each checklist's ItemsOrder should be nil
		for i, checklist := range cloned.Checklists {
			require.Nil(t, checklist.ItemsOrder, "Checklist %d ItemsOrder should be nil", i)

			// But GetItemsOrder() should still work correctly
			expectedOrder := checklist.GetItemsOrder()
			require.Equal(t, []string{original.Checklists[i].Items[0].ID}, expectedOrder)
		}
	})

	t.Run("modifications to original don't affect clone", func(t *testing.T) {
		original := createOriginal()
		cloned := original.Clone()

		// Modify original scalar fields
		original.Name = "Modified Name"
		original.Summary = "Modified Summary"
		original.OwnerUserID = "modified_user"

		// Modify original slice fields
		original.InvitedUserIDs[0] = "modified_user"
		original.StatusPosts[0].ID = "modified_post"
		original.Checklists[0].Title = "Modified Checklist"
		original.Checklists[0].Items[0].Title = "Modified Item"

		// Verify clone is unchanged
		require.Equal(t, "Test Run", cloned.Name)
		require.Equal(t, "Test Summary", cloned.Summary)
		require.Equal(t, "user1", cloned.OwnerUserID)
		require.Equal(t, "user3", cloned.InvitedUserIDs[0])
		require.Equal(t, "post1", cloned.StatusPosts[0].ID)
		require.Equal(t, "Checklist 1", cloned.Checklists[0].Title)
		require.Equal(t, "Item 1", cloned.Checklists[0].Items[0].Title)
	})

	t.Run("modifications to clone don't affect original", func(t *testing.T) {
		original := createOriginal()
		cloned := original.Clone()

		// Modify clone
		cloned.Name = "Cloned Name"
		cloned.InvitedUserIDs[0] = "cloned_user"
		cloned.StatusPosts[0].ID = "cloned_post"
		cloned.Checklists[0].Title = "Cloned Checklist"

		// Verify original is unchanged (using fresh original)
		require.Equal(t, "Test Run", original.Name)
		require.Equal(t, "user3", original.InvitedUserIDs[0])
		require.Equal(t, "post1", original.StatusPosts[0].ID)
		require.Equal(t, "Checklist 1", original.Checklists[0].Title)
	})

	t.Run("clone with empty checklists", func(t *testing.T) {
		emptyRun := &PlaybookRun{
			ID:         "empty_run",
			Name:       "Empty Run",
			Checklists: []Checklist{},
			ItemsOrder: []string{}, // Set to empty slice
		}

		cloned := emptyRun.Clone()

		require.Nil(t, cloned.ItemsOrder, "ItemsOrder should be nil for defensive programming")
		require.Nil(t, cloned.GetItemsOrder(), "GetItemsOrder should return nil for empty checklists")
		require.Empty(t, cloned.Checklists)
	})

	t.Run("clone with nil slices", func(t *testing.T) {
		nilRun := &PlaybookRun{
			ID:             "nil_run",
			Name:           "Nil Run",
			Checklists:     nil,
			StatusPosts:    nil,
			InvitedUserIDs: nil,
			ParticipantIDs: nil,
			ItemsOrder:     nil,
		}

		cloned := nilRun.Clone()

		require.Nil(t, cloned.Checklists)
		require.Nil(t, cloned.StatusPosts)
		require.Nil(t, cloned.InvitedUserIDs)
		require.Nil(t, cloned.ParticipantIDs)
		require.Nil(t, cloned.ItemsOrder)
		require.Nil(t, cloned.GetItemsOrder())
	})
}

func TestPlaybookRun_ItemsOrder_Behavior(t *testing.T) {
	t.Run("GetItemsOrder returns nil for empty checklists", func(t *testing.T) {
		run := &PlaybookRun{
			ID:         "test_run",
			Checklists: []Checklist{},
		}

		itemsOrder := run.GetItemsOrder()
		require.Nil(t, itemsOrder, "GetItemsOrder should return nil for empty checklists")
	})

	t.Run("GetItemsOrder returns nil for nil checklists", func(t *testing.T) {
		run := &PlaybookRun{
			ID:         "test_run",
			Checklists: nil,
		}

		itemsOrder := run.GetItemsOrder()
		require.Nil(t, itemsOrder, "GetItemsOrder should return nil for nil checklists")
	})

	t.Run("GetItemsOrder returns checklist IDs in order", func(t *testing.T) {
		run := &PlaybookRun{
			ID: "test_run",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "First"},
				{ID: "checklist2", Title: "Second"},
				{ID: "checklist3", Title: "Third"},
			},
		}

		itemsOrder := run.GetItemsOrder()
		require.Equal(t, []string{"checklist1", "checklist2", "checklist3"}, itemsOrder)
	})

	t.Run("Checklist GetItemsOrder returns nil for empty items", func(t *testing.T) {
		checklist := Checklist{
			ID:    "test_checklist",
			Title: "Test",
			Items: []ChecklistItem{},
		}

		itemsOrder := checklist.GetItemsOrder()
		require.Nil(t, itemsOrder, "Checklist GetItemsOrder should return nil for empty items")
	})

	t.Run("Checklist GetItemsOrder returns nil for nil items", func(t *testing.T) {
		checklist := Checklist{
			ID:    "test_checklist",
			Title: "Test",
			Items: nil,
		}

		itemsOrder := checklist.GetItemsOrder()
		require.Nil(t, itemsOrder, "Checklist GetItemsOrder should return nil for nil items")
	})

	t.Run("Checklist GetItemsOrder returns item IDs in order", func(t *testing.T) {
		checklist := Checklist{
			ID:    "test_checklist",
			Title: "Test",
			Items: []ChecklistItem{
				{ID: "item1", Title: "First Item"},
				{ID: "item2", Title: "Second Item"},
				{ID: "item3", Title: "Third Item"},
			},
		}

		itemsOrder := checklist.GetItemsOrder()
		require.Equal(t, []string{"item1", "item2", "item3"}, itemsOrder)
	})

	t.Run("consistency between PlaybookRun and Checklist GetItemsOrder", func(t *testing.T) {
		// Both should return nil for empty collections
		emptyRun := &PlaybookRun{Checklists: []Checklist{}}
		emptyChecklist := Checklist{Items: []ChecklistItem{}}

		require.Nil(t, emptyRun.GetItemsOrder())
		require.Nil(t, emptyChecklist.GetItemsOrder())

		// Both should return nil for nil collections
		nilRun := &PlaybookRun{Checklists: nil}
		nilChecklist := Checklist{Items: nil}

		require.Nil(t, nilRun.GetItemsOrder())
		require.Nil(t, nilChecklist.GetItemsOrder())
	})
}

func TestPlaybookRun_MarshalJSON_ItemsOrder(t *testing.T) {
	t.Run("marshals ItemsOrder as null when nil", func(t *testing.T) {
		run := &PlaybookRun{
			ID:         "test_run",
			Name:       "Test Run",
			Checklists: []Checklist{}, // Empty checklists
		}

		jsonBytes, err := json.Marshal(run)
		require.NoError(t, err)

		// Parse back to verify
		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// ItemsOrder should be null in JSON since GetItemsOrder() returns nil for empty checklists
		require.Nil(t, result["items_order"], "ItemsOrder should be null in JSON when no checklists")
	})

	t.Run("marshals ItemsOrder with checklist IDs when checklists exist", func(t *testing.T) {
		run := &PlaybookRun{
			ID:   "test_run",
			Name: "Test Run",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "First", Items: []ChecklistItem{}},
				{ID: "checklist2", Title: "Second", Items: []ChecklistItem{}},
			},
		}

		jsonBytes, err := json.Marshal(run)
		require.NoError(t, err)

		// Parse back to verify
		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// ItemsOrder should contain checklist IDs
		itemsOrder, ok := result["items_order"].([]interface{})
		require.True(t, ok, "ItemsOrder should be an array")
		require.Len(t, itemsOrder, 2)
		require.Equal(t, "checklist1", itemsOrder[0])
		require.Equal(t, "checklist2", itemsOrder[1])
	})

	t.Run("marshals checklist ItemsOrder as null when no items", func(t *testing.T) {
		run := &PlaybookRun{
			ID:   "test_run",
			Name: "Test Run",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Empty Checklist",
					Items: []ChecklistItem{}, // Empty items
				},
			},
		}

		jsonBytes, err := json.Marshal(run)
		require.NoError(t, err)

		// Parse back to verify
		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// Get the checklists array
		checklists, ok := result["checklists"].([]interface{})
		require.True(t, ok)
		require.Len(t, checklists, 1)

		// Get the first checklist
		checklist, ok := checklists[0].(map[string]interface{})
		require.True(t, ok)

		// ItemsOrder should be null since checklist has no items
		require.Nil(t, checklist["items_order"], "Checklist ItemsOrder should be null when no items")
	})

	t.Run("marshals checklist ItemsOrder with item IDs when items exist", func(t *testing.T) {
		run := &PlaybookRun{
			ID:   "test_run",
			Name: "Test Run",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist with Items",
					Items: []ChecklistItem{
						{ID: "item1", Title: "First Item"},
						{ID: "item2", Title: "Second Item"},
					},
				},
			},
		}

		jsonBytes, err := json.Marshal(run)
		require.NoError(t, err)

		// Parse back to verify
		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// Get the checklists array
		checklists, ok := result["checklists"].([]interface{})
		require.True(t, ok)
		require.Len(t, checklists, 1)

		// Get the first checklist
		checklist, ok := checklists[0].(map[string]interface{})
		require.True(t, ok)

		// ItemsOrder should contain item IDs
		itemsOrder, ok := checklist["items_order"].([]interface{})
		require.True(t, ok, "Checklist ItemsOrder should be an array")
		require.Len(t, itemsOrder, 2)
		require.Equal(t, "item1", itemsOrder[0])
		require.Equal(t, "item2", itemsOrder[1])
	})

	t.Run("defensive programming - ItemsOrder computed fresh regardless of stored value", func(t *testing.T) {
		run := &PlaybookRun{
			ID:   "test_run",
			Name: "Test Run",
			// Set ItemsOrder to stale/incorrect value
			ItemsOrder: []string{"stale_id", "wrong_id"},
			Checklists: []Checklist{
				{ID: "correct1", Title: "First"},
				{ID: "correct2", Title: "Second"},
			},
		}

		jsonBytes, err := json.Marshal(run)
		require.NoError(t, err)

		// Parse back to verify
		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// ItemsOrder should contain correct IDs, not the stale ones
		itemsOrder, ok := result["items_order"].([]interface{})
		require.True(t, ok)
		require.Len(t, itemsOrder, 2)
		require.Equal(t, "correct1", itemsOrder[0])
		require.Equal(t, "correct2", itemsOrder[1])

		// Should NOT contain the stale values
		require.NotContains(t, itemsOrder, "stale_id")
		require.NotContains(t, itemsOrder, "wrong_id")
	})
}
