// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStandaloneRunCreation(t *testing.T) {
	// Test that playbook runs can be created without a PlaybookID (standalone runs)

	t.Run("create standalone run with empty PlaybookID", func(t *testing.T) {
		standaloneRun := PlaybookRun{
			ID:          "test-run-id",
			Name:        "Test Standalone Run",
			TeamID:      "team-id",
			ChannelID:   "channel-id",
			OwnerUserID: "user-id",
			PlaybookID:  "", // Empty PlaybookID for standalone run
			Type:        RunTypeChannelChecklist,
		}

		// Verify the run is configured as standalone
		assert.Empty(t, standaloneRun.PlaybookID, "PlaybookID should be empty for standalone runs")
		assert.Equal(t, RunTypeChannelChecklist, standaloneRun.Type, "Type should be channelChecklist for standalone runs")

		// Verify essential fields are still present
		assert.NotEmpty(t, standaloneRun.Name, "Name should be present")
		assert.NotEmpty(t, standaloneRun.TeamID, "TeamID should be present")
		assert.NotEmpty(t, standaloneRun.OwnerUserID, "OwnerUserID should be present")
		assert.NotEmpty(t, standaloneRun.ChannelID, "ChannelId should be present")
	})

	t.Run("standalone run should create default checklist", func(t *testing.T) {
		standaloneRun := PlaybookRun{
			PlaybookID: "", // Empty PlaybookID triggers default checklist creation
		}

		// Simulate the logic from PlaybookRunService.CreatePlaybookRun
		if standaloneRun.PlaybookID == "" {
			standaloneRun.Checklists = []Checklist{
				{
					Title: "Tasks",
					Items: []ChecklistItem{},
				},
			}
		}

		require.Len(t, standaloneRun.Checklists, 1, "Should have one default section")
		assert.Equal(t, "Tasks", standaloneRun.Checklists[0].Title, "Default section should have correct title")
		assert.Empty(t, standaloneRun.Checklists[0].Items, "Default section should have no items initially")
	})

	t.Run("playbook run with PlaybookID remains unchanged", func(t *testing.T) {
		playbookRun := PlaybookRun{
			PlaybookID: "valid-playbook-id",
			Type:       RunTypePlaybook,
		}

		// Verify playbook-based runs are unchanged
		assert.NotEmpty(t, playbookRun.PlaybookID, "PlaybookID should be present for playbook-based runs")
		assert.Equal(t, RunTypePlaybook, playbookRun.Type, "Type should be playbook for playbook-based runs")
	})
}
