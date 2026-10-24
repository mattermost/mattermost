// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunResolver_NumTasks(t *testing.T) {
	t.Run("excludes hidden items from count", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Visible 1", ConditionAction: app.ConditionActionNone},
							{Title: "Hidden 1", ConditionAction: app.ConditionActionHidden},
							{Title: "Visible 2", ConditionAction: app.ConditionActionNone},
							{Title: "Hidden 2", ConditionAction: app.ConditionActionHidden},
							{Title: "Shown Modified", ConditionAction: app.ConditionActionShownBecauseModified},
						},
					},
				},
			},
		}

		result := resolver.NumTasks()
		// 5 total items - 2 hidden = 3 visible
		assert.Equal(t, int32(3), result)
	})

	t.Run("returns 0 when all items are hidden", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Hidden 1", ConditionAction: app.ConditionActionHidden},
							{Title: "Hidden 2", ConditionAction: app.ConditionActionHidden},
						},
					},
				},
			},
		}

		result := resolver.NumTasks()
		assert.Equal(t, int32(0), result)
	})

	t.Run("counts all items when none are hidden", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Task 1", ConditionAction: app.ConditionActionNone},
							{Title: "Task 2", ConditionAction: ""},
							{Title: "Task 3", ConditionAction: app.ConditionActionShownBecauseModified},
						},
					},
				},
			},
		}

		result := resolver.NumTasks()
		assert.Equal(t, int32(3), result)
	})

	t.Run("works across multiple checklists", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Visible 1", ConditionAction: ""},
							{Title: "Hidden 1", ConditionAction: app.ConditionActionHidden},
						},
					},
					{
						Items: []app.ChecklistItem{
							{Title: "Visible 2", ConditionAction: ""},
							{Title: "Hidden 2", ConditionAction: app.ConditionActionHidden},
							{Title: "Visible 3", ConditionAction: ""},
						},
					},
				},
			},
		}

		result := resolver.NumTasks()
		// 5 total - 2 hidden = 3 visible
		assert.Equal(t, int32(3), result)
	})

	t.Run("returns 0 for empty checklists", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{},
			},
		}

		result := resolver.NumTasks()
		assert.Equal(t, int32(0), result)
	})
}

func TestRunResolver_NumTasksClosed(t *testing.T) {
	t.Run("excludes hidden items from count", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Open", State: app.ChecklistItemStateOpen, ConditionAction: ""},
							{Title: "Closed Visible", State: app.ChecklistItemStateClosed, ConditionAction: ""},
							{Title: "Closed Hidden", State: app.ChecklistItemStateClosed, ConditionAction: app.ConditionActionHidden},
							{Title: "Skipped Visible", State: app.ChecklistItemStateSkipped, ConditionAction: ""},
							{Title: "Skipped Hidden", State: app.ChecklistItemStateSkipped, ConditionAction: app.ConditionActionHidden},
						},
					},
				},
			},
		}

		result := resolver.NumTasksClosed()
		// 2 closed/skipped items that are visible (excludes 2 hidden closed/skipped)
		assert.Equal(t, int32(2), result)
	})

	t.Run("returns 0 when all closed items are hidden", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Open", State: app.ChecklistItemStateOpen, ConditionAction: ""},
							{Title: "Closed Hidden", State: app.ChecklistItemStateClosed, ConditionAction: app.ConditionActionHidden},
							{Title: "Skipped Hidden", State: app.ChecklistItemStateSkipped, ConditionAction: app.ConditionActionHidden},
						},
					},
				},
			},
		}

		result := resolver.NumTasksClosed()
		assert.Equal(t, int32(0), result)
	})

	t.Run("counts closed and skipped items when not hidden", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Closed 1", State: app.ChecklistItemStateClosed, ConditionAction: ""},
							{Title: "Closed 2", State: app.ChecklistItemStateClosed, ConditionAction: app.ConditionActionNone},
							{Title: "Skipped", State: app.ChecklistItemStateSkipped, ConditionAction: ""},
							{Title: "Open", State: app.ChecklistItemStateOpen, ConditionAction: ""},
						},
					},
				},
			},
		}

		result := resolver.NumTasksClosed()
		assert.Equal(t, int32(3), result) // 2 closed + 1 skipped
	})

	t.Run("shown_because_modified items are counted when closed", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Closed Modified", State: app.ChecklistItemStateClosed, ConditionAction: app.ConditionActionShownBecauseModified},
							{Title: "Open Modified", State: app.ChecklistItemStateOpen, ConditionAction: app.ConditionActionShownBecauseModified},
						},
					},
				},
			},
		}

		result := resolver.NumTasksClosed()
		assert.Equal(t, int32(1), result) // Only the closed one
	})

	t.Run("works across multiple checklists", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{
					{
						Items: []app.ChecklistItem{
							{Title: "Closed 1", State: app.ChecklistItemStateClosed, ConditionAction: ""},
							{Title: "Hidden Closed", State: app.ChecklistItemStateClosed, ConditionAction: app.ConditionActionHidden},
						},
					},
					{
						Items: []app.ChecklistItem{
							{Title: "Closed 2", State: app.ChecklistItemStateClosed, ConditionAction: ""},
							{Title: "Skipped", State: app.ChecklistItemStateSkipped, ConditionAction: ""},
						},
					},
				},
			},
		}

		result := resolver.NumTasksClosed()
		// 3 closed/skipped visible (excludes 1 hidden)
		assert.Equal(t, int32(3), result)
	})

	t.Run("returns 0 for empty checklists", func(t *testing.T) {
		resolver := &RunResolver{
			PlaybookRun: app.PlaybookRun{
				Checklists: []app.Checklist{},
			},
		}

		result := resolver.NumTasksClosed()
		assert.Equal(t, int32(0), result)
	})
}
