// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestPlaybookRun_MarshalJSON(t *testing.T) {
	t.Run("marshal pointer", func(t *testing.T) {
		testPlaybookRun := &PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		require.NotContains(t, string(result), "null", "update MarshalJSON to initialize nil slices")
	})

	t.Run("marshal value", func(t *testing.T) {
		testPlaybookRun := PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		require.NotContains(t, string(result), "null", "update MarshalJSON to initialize nil slices")
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
}
