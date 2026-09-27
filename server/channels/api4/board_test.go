// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func setupBoardTest(t *testing.T) *TestHelper {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	return th
}

func TestCreateBoard(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBoardTest(t)
	client := th.Client

	t.Run("create open board", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "My Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		created, resp, err := client.CreateBoard(context.Background(), board)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
		assert.Equal(t, model.ChannelTypeOpenBoard, created.Type)
		assert.NotEmpty(t, created.Id)

		// Verify view was created with kanban props
		views, appErr := th.App.GetViewsForChannel(th.Context, created.Id, model.ViewQueryOpts{PerPage: 10})
		require.Nil(t, appErr)
		require.Len(t, views, 1)
		assert.Equal(t, model.ViewTypeKanban, views[0].Type)

		kanban, kErr := model.KanbanPropsFromProps(views[0].Props)
		require.NoError(t, kErr)
		assert.NotEmpty(t, kanban.GroupBy.FieldID, "kanban should reference a field")
		require.Len(t, kanban.GroupBy.Columns, 3, "should have 3 default columns")
		assert.Equal(t, model.BoardsStatusOptionTodo, kanban.GroupBy.Columns[0].Name)
		assert.Equal(t, model.BoardsStatusOptionInProgress, kanban.GroupBy.Columns[1].Name)
		assert.Equal(t, model.BoardsStatusOptionComplete, kanban.GroupBy.Columns[2].Name)
		for _, col := range kanban.GroupBy.Columns {
			assert.Len(t, col.OptionIDs, 1, "each default column maps to one option")
			assert.NotEmpty(t, col.ID, "column should have a stable ID")
		}

		// Verify linked_properties on channel
		linkedProps, ok := created.Props[model.ChannelPropsBoardLinkedProperties]
		require.True(t, ok, "channel should have board:linked_properties")
		linkedList, ok := linkedProps.([]any)
		require.True(t, ok, "linked_properties should be a list")
		assert.Len(t, linkedList, 2, "should have status and assignee field IDs")
	})

	t.Run("create private board", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "Private Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypePrivateBoard,
			TeamId:      th.BasicTeam.Id,
		}

		_, resp, err := client.CreateBoard(context.Background(), board)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("rejected when feature flag off", func(t *testing.T) {
		// Routes are registered at startup based on feature flag.
		// When the flag is off at startup, /boards route does not exist -> 404.
		// Use a separate TestHelper with the flag off.
		th2 := Setup(t).InitBasic(t)
		board := &model.Channel{
			DisplayName: "Disabled Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th2.BasicTeam.Id,
		}

		_, resp, err := th2.Client.CreateBoard(context.Background(), board)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("rejected with empty display name", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		_, resp, err := client.CreateBoard(context.Background(), board)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("rejected with whitespace-only display name", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "   ",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		_, resp, err := client.CreateBoard(context.Background(), board)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("board not in sidebar", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "Sidebar Check Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		created, _, err := client.CreateBoard(context.Background(), board)
		require.NoError(t, err)
		require.NotNil(t, created)

		// Verify board doesn't appear in sidebar
		categories, _, catErr := client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, catErr)
		for _, cat := range categories.Categories {
			for _, chID := range cat.Channels {
				assert.NotEqual(t, created.Id, chID, "board should not appear in sidebar")
			}
		}
	})
}

func TestCreateBoardSchemeAssignment(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBoardTest(t)

	th.App.Srv().SetLicense(model.NewTestLicense("custom_permissions_schemes"))
	require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))

	channelScheme, _, err := th.SystemAdminClient.CreateScheme(context.Background(), &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	})
	require.NoError(t, err)

	teamScheme, _, err := th.SystemAdminClient.CreateScheme(context.Background(), &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	})
	require.NoError(t, err)

	testCases := []struct {
		name         string
		client       *model.Client4
		boardType    model.ChannelType
		schemeID     string
		mustSucceed  bool
		wantAssigned bool
	}{
		{
			name:      "team member, open board, channel-scope scheme id",
			client:    th.Client,
			boardType: model.ChannelTypeOpenBoard,
			schemeID:  channelScheme.Id,
		},
		{
			name:      "team member, private board, channel-scope scheme id",
			client:    th.Client,
			boardType: model.ChannelTypePrivateBoard,
			schemeID:  channelScheme.Id,
		},
		{
			name:        "team member, open board, no scheme id",
			client:      th.Client,
			boardType:   model.ChannelTypeOpenBoard,
			mustSucceed: true,
		},
		{
			name:      "system admin, open board, team-scope scheme id",
			client:    th.SystemAdminClient,
			boardType: model.ChannelTypeOpenBoard,
			schemeID:  teamScheme.Id,
		},
		{
			name:      "system admin, open board, scheme id that does not exist",
			client:    th.SystemAdminClient,
			boardType: model.ChannelTypeOpenBoard,
			schemeID:  model.NewId(),
		},
		{
			name:         "system admin, open board, channel-scope scheme id",
			client:       th.SystemAdminClient,
			boardType:    model.ChannelTypeOpenBoard,
			schemeID:     channelScheme.Id,
			mustSucceed:  true,
			wantAssigned: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			board := &model.Channel{
				DisplayName: "My Board",
				Name:        GenerateTestChannelName(),
				Type:        tc.boardType,
				TeamId:      th.BasicTeam.Id,
			}
			if tc.schemeID != "" {
				board.SchemeId = model.NewPointer(tc.schemeID)
			}

			created, resp, cErr := tc.client.CreateBoard(context.Background(), board)
			if tc.mustSucceed {
				require.NoError(t, cErr)
				CheckCreatedStatus(t, resp)
			}

			assertCreatedChannelSchemeID(t, th, created, cErr, board.Name, tc.schemeID, tc.wantAssigned)
		})
	}
}
