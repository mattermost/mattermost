// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/services/store"
)

func StoreTestTeamStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("GetTeam", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetTeam(t, store)
	})

	t.Run("UpsertTeamSignupToken", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUpsertTeamSignupToken(t, store)
	})

	t.Run("UpsertTeamSettings", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUpsertTeamSettings(t, store)
	})

	t.Run("GetAllTeams", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetAllTeams(t, store)
	})
}

func testGetTeam(t *testing.T, store store.Store) {
	t.Run("Nonexistent team", func(t *testing.T) {
		got, err := store.GetTeam("nonexistent-id")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, got)
	})

	t.Run("Valid team", func(t *testing.T) {
		teamID := "0"
		team := &model.Team{
			ID:          teamID,
			SignupToken: utils.NewID(utils.IDTypeToken),
		}

		err := store.UpsertTeamSignupToken(*team)
		require.NoError(t, err)

		got, err := store.GetTeam(teamID)
		require.NoError(t, err)
		require.Equal(t, teamID, got.ID)
	})
}

func testUpsertTeamSignupToken(t *testing.T, store store.Store) {
	t.Run("Insert and update team with signup token", func(t *testing.T) {
		teamID := "0"
		team := &model.Team{
			ID:          teamID,
			SignupToken: utils.NewID(utils.IDTypeToken),
		}

		// insert
		err := store.UpsertTeamSignupToken(*team)
		require.NoError(t, err)

		got, err := store.GetTeam(teamID)
		require.NoError(t, err)
		require.Equal(t, team.ID, got.ID)
		require.Equal(t, team.SignupToken, got.SignupToken)

		// update signup token
		team.SignupToken = utils.NewID(utils.IDTypeToken)
		err = store.UpsertTeamSignupToken(*team)
		require.NoError(t, err)

		got, err = store.GetTeam(teamID)
		require.NoError(t, err)
		require.Equal(t, team.ID, got.ID)
		require.Equal(t, team.SignupToken, got.SignupToken)
	})
}

func testUpsertTeamSettings(t *testing.T, store store.Store) {
	t.Run("Insert and update team with settings", func(t *testing.T) {
		teamID := "0"
		team := &model.Team{
			ID: teamID,
			Settings: map[string]interface{}{
				"field1": "A",
			},
		}

		// insert
		err := store.UpsertTeamSettings(*team)
		require.NoError(t, err)

		got, err := store.GetTeam(teamID)
		require.NoError(t, err)
		require.Equal(t, team.ID, got.ID)
		require.Equal(t, team.Settings, got.Settings)

		// update settings
		team.Settings = map[string]interface{}{
			"field1": "B",
		}
		err = store.UpsertTeamSettings(*team)
		require.NoError(t, err)

		got2, err := store.GetTeam(teamID)
		require.NoError(t, err)
		require.Equal(t, team.ID, got2.ID)
		require.Equal(t, team.Settings, got2.Settings)
		require.Equal(t, got.SignupToken, got2.SignupToken)
	})
}

func testGetAllTeams(t *testing.T, store store.Store) {
	t.Run("No teams response", func(t *testing.T) {
		got, err := store.GetAllTeams()
		require.NoError(t, err)
		require.Empty(t, got)
	})

	t.Run("Insert multiple team and get all teams", func(t *testing.T) {
		// insert
		teamCount := 10
		for i := 0; i < teamCount; i++ {
			teamID := fmt.Sprintf("%d", i)
			team := &model.Team{
				ID:          teamID,
				SignupToken: utils.NewID(utils.IDTypeToken),
			}

			err := store.UpsertTeamSignupToken(*team)
			require.NoError(t, err)
		}

		got, err := store.GetAllTeams()
		require.NoError(t, err)
		require.Len(t, got, teamCount)
	})
}
