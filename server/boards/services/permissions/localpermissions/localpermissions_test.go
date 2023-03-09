// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localpermissions

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"

	mm_model "github.com/mattermost/mattermost-server/v6/model"

	"github.com/stretchr/testify/assert"
)

func TestHasPermissionToTeam(t *testing.T) {
	th := SetupTestHelper(t)

	t.Run("empty input should always unauthorize", func(t *testing.T) {
		assert.False(t, th.permissions.HasPermissionToTeam("", "team-id", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToTeam("user-id", "", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToTeam("user-id", "team-id", nil))
	})

	t.Run("all users have all permissions on teams", func(t *testing.T) {
		hasPermission := th.permissions.HasPermissionToTeam("user-id", "team-id", model.PermissionManageBoardCards)
		assert.True(t, hasPermission)
	})

	t.Run("no users have PermissionManageTeam on teams", func(t *testing.T) {
		hasPermission := th.permissions.HasPermissionToTeam("user-id", "team-id", model.PermissionManageTeam)
		assert.False(t, hasPermission)
	})
}

func TestHasPermissionToBoard(t *testing.T) {
	th := SetupTestHelper(t)

	t.Run("empty input should always unauthorize", func(t *testing.T) {
		assert.False(t, th.permissions.HasPermissionToBoard("", "board-id", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToBoard("user-id", "", model.PermissionManageBoardCards))
		assert.False(t, th.permissions.HasPermissionToBoard("user-id", "board-id", nil))
	})

	t.Run("nonexistent user", func(t *testing.T) {
		userID := "user-id"
		boardID := "board-id"

		th.store.EXPECT().
			GetMemberForBoard(boardID, userID).
			Return(nil, sql.ErrNoRows).
			Times(1)

		hasPermission := th.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardCards)
		assert.False(t, hasPermission)
	})

	t.Run("board admin", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:      "user-id",
			BoardID:     "board-id",
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

		th.checkBoardPermissions("admin", member, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board editor", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       "user-id",
			BoardID:      "board-id",
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

		th.checkBoardPermissions("editor", member, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board commenter", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:          "user-id",
			BoardID:         "board-id",
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

		th.checkBoardPermissions("commenter", member, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("board viewer", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       "user-id",
			BoardID:      "board-id",
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

		th.checkBoardPermissions("viewer", member, hasPermissionTo, hasNotPermissionTo)
	})

	t.Run("Manage Team Permission ", func(t *testing.T) {
		member := &model.BoardMember{
			UserID:       "user-id",
			BoardID:      "board-id",
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

		th.checkBoardPermissions("viewer", member, hasPermissionTo, hasNotPermissionTo)
	})
}
