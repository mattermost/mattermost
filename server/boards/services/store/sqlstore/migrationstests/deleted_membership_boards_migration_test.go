// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeletedMembershipBoardsMigration(t *testing.T) {
	t.Run("should detect a board linked to a team in which the owner has a deleted membership and restore it", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.f.MigrateToStepSkippingLastInterceptor(18).
			ExecFile("./fixtures/deletedMembershipBoardsMigrationFixtures.sql")

		boardGroupChannel := struct {
			Created_By string
			Team_ID    string
		}{}
		boardDirectMessage := struct {
			Created_By string
			Team_ID    string
		}{}

		th.f.DB().Get(&boardGroupChannel, "SELECT created_by, team_id FROM focalboard_boards WHERE id = 'board-group-channel'")
		require.Equal(t, "user-one", boardGroupChannel.Created_By)
		require.Equal(t, "team-one", boardGroupChannel.Team_ID)

		th.f.DB().Get(&boardDirectMessage, "SELECT created_by, team_id FROM focalboard_boards WHERE id = 'board-group-channel'")
		require.Equal(t, "user-one", boardDirectMessage.Created_By)
		require.Equal(t, "team-one", boardDirectMessage.Team_ID)

		th.f.RunInterceptor(18)

		th.f.DB().Get(&boardGroupChannel, "SELECT created_by, team_id FROM focalboard_boards WHERE id = 'board-group-channel'")
		require.Equal(t, "user-one", boardGroupChannel.Created_By)
		require.Equal(t, "team-three", boardGroupChannel.Team_ID)

		th.f.DB().Get(&boardDirectMessage, "SELECT created_by, team_id FROM focalboard_boards WHERE id = 'board-group-channel'")
		require.Equal(t, "user-one", boardDirectMessage.Created_By)
		require.Equal(t, "team-three", boardDirectMessage.Team_ID)
	})
}
