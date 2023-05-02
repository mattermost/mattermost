// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -copyright_file=../../../../copyright.txt -destination=mocks/mockpluginapi.go -package mocks github.com/mattermost/mattermost-server/server/v8/plugin API
package mmpermissions

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"

	"github.com/stretchr/testify/assert"
)

const (
	testTeamID  = "team-id"
	testBoardID = "board-id"
	testUserID  = "user-id"
)

func TestHasPermissionsToTeam(t *testing.T) {
	th := SetupTestHelper(t)

	t.Run("empty input should always unauthorize", func(t *testing.T) {
		assert.False(t, th.permissions.HasPermissionToTeam("", testTeamID, model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToTeam(testUserID, "", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToTeam(testUserID, testTeamID, nil))
	})

	t.Run("should authorize if the plugin API does", func(t *testing.T) {
		userID := testUserID
		teamID := testTeamID

		th.api.EXPECT().
			HasPermissionToTeam(userID, teamID, model.PermissionViewTeam).
			Return(true).
			Times(1)

		hasPermission := th.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
		assert.True(t, hasPermission)
	})

	t.Run("should not authorize if the plugin API doesn't", func(t *testing.T) {
		userID := testUserID
		teamID := testTeamID

		th.api.EXPECT().
			HasPermissionToTeam(userID, teamID, model.PermissionViewTeam).
			Return(false).
			Times(1)

		hasPermission := th.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
		assert.False(t, hasPermission)
	})
}

// test case for user removed.
func TestHasPermissionToBoard(t *testing.T) {
	th := SetupTestHelper(t)

	t.Run("empty input should always unauthorize", func(t *testing.T) {
		assert.False(t, th.permissions.HasPermissionToBoard("", testBoardID, model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToBoard(testUserID, "", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToBoard(testUserID, testBoardID, nil))
	})

	userID := testUserID
	boardID := testBoardID
	teamID := testTeamID

	t.Run("nonexistent member", func(t *testing.T) {
		th.store.EXPECT().
			GetBoard(boardID).
			Return(&model.Board{ID: boardID, TeamID: teamID}, nil).
			Times(1)

		th.api.EXPECT().
			HasPermissionToTeam(userID, teamID, model.PermissionViewTeam).
			Return(true).
			Times(1)

		th.store.EXPECT().
			GetMemberForBoard(boardID, userID).
			Return(nil, sql.ErrNoRows).
			Times(1)

		hasPermission := th.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardCards)
		assert.False(t, hasPermission)
	})

	t.Run("nonexistent board", func(t *testing.T) {
		th.store.EXPECT().
			GetBoard(boardID).
			Return(nil, sql.ErrNoRows).
			Times(1)

		th.store.EXPECT().
			GetBoardHistory(boardID, model.QueryBoardHistoryOptions{Limit: 1, Descending: true}).
			Return(nil, sql.ErrNoRows).
			Times(1)

		hasPermission := th.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardCards)
		assert.False(t, hasPermission)
	})

	t.Run("user that has been removed from the team", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:      userID,
			BoardID:     boardID,
			SchemeAdmin: true,
		}

		th.store.EXPECT().
			GetBoard(boardID).
			Return(&model.Board{ID: boardID, TeamID: teamID}, nil).
			Times(1)

		th.api.EXPECT().
			HasPermissionToTeam(userID, teamID, model.PermissionViewTeam).
			Return(true).
			Times(1)

		th.store.EXPECT().
			GetMemberForBoard(member.BoardID, member.UserID).
			Return(member, nil).
			Times(1)

		hasPermission := th.permissions.HasPermissionToBoard(member.UserID, member.BoardID, model.PermissionViewBoard)
		assert.True(t, hasPermission)
	})

	t.Run("board admin", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:      userID,
			BoardID:     boardID,
			SchemeAdmin: true,
		}

		hasPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardType,
			model.PermissionDeleteBoard,
			model.PermissionManageBoardRoles,
			model.PermissionShareBoard,
			model.PermissionManageBoardCards,
			model.PermissionViewBoard,
			model.PermissionManageBoardProperties,
		}

		hasNotPermissionTo := []*mm_model.Permission{}

		th.checkBoardPermissions("admin", member, teamID, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board editor", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       userID,
			BoardID:      boardID,
			SchemeEditor: true,
		}

		hasPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardCards,
			model.PermissionViewBoard,
			model.PermissionManageBoardProperties,
		}

		hasNotPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardType,
			model.PermissionDeleteBoard,
			model.PermissionManageBoardRoles,
			model.PermissionShareBoard,
		}

		th.checkBoardPermissions("editor", member, teamID, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board commenter", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:          userID,
			BoardID:         boardID,
			SchemeCommenter: true,
		}

		hasPermissionTo := []*mm_model.Permission{
			model.PermissionViewBoard,
		}

		hasNotPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardType,
			model.PermissionDeleteBoard,
			model.PermissionManageBoardRoles,
			model.PermissionShareBoard,
			model.PermissionManageBoardCards,
			model.PermissionManageBoardProperties,
		}

		th.checkBoardPermissions("commenter", member, teamID, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board viewer", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       userID,
			BoardID:      boardID,
			SchemeViewer: true,
		}

		hasPermissionTo := []*mm_model.Permission{
			model.PermissionViewBoard,
		}

		hasNotPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardType,
			model.PermissionDeleteBoard,
			model.PermissionManageBoardRoles,
			model.PermissionShareBoard,
			model.PermissionManageBoardCards,
			model.PermissionManageBoardProperties,
		}

		th.checkBoardPermissions("viewer", member, teamID, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("elevate board viewer permissions", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       userID,
			BoardID:      boardID,
			SchemeViewer: true,
		}

		hasPermissionTo := []*mm_model.Permission{
			model.PermissionManageBoardType,
			model.PermissionDeleteBoard,
			model.PermissionManageBoardRoles,
			model.PermissionShareBoard,
			model.PermissionManageBoardCards,
			model.PermissionViewBoard,
			model.PermissionManageBoardProperties,
		}

		hasNotPermissionTo := []*mm_model.Permission{}
		th.checkBoardPermissions("elevated-admin", member, teamID, hasPermissionTo, hasNotPermissionTo)
	})
}
