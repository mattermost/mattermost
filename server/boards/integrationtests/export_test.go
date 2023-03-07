// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/utils"
)

func TestExportBoard(t *testing.T) {
	t.Run("export single board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := &model.Board{
			ID:        utils.NewID(utils.IDTypeBoard),
			TeamID:    "test-team",
			Title:     "Export Test Board",
			CreatedBy: th.GetUser1().ID,
			Type:      model.BoardTypeOpen,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		block := &model.Block{
			ID:        utils.NewID(utils.IDTypeCard),
			ParentID:  board.ID,
			Type:      model.TypeCard,
			BoardID:   board.ID,
			Title:     "Test card # for export",
			CreatedBy: th.GetUser1().ID,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		babs := &model.BoardsAndBlocks{
			Boards: []*model.Board{board},
			Blocks: []*model.Block{block},
		}

		babs, resp := th.Client.CreateBoardsAndBlocks(babs)
		th.CheckOK(resp)

		// export the board to an in-memory archive file
		buf, resp := th.Client.ExportBoardArchive(babs.Boards[0].ID)
		th.CheckOK(resp)
		require.NotNil(t, buf)

		// import the archive file to team 0
		resp = th.Client.ImportArchive(model.GlobalTeamID, bytes.NewReader(buf))
		th.CheckOK(resp)
		require.NoError(t, resp.Error)

		// check for test card
		boardsImported, err := th.Server.App().GetBoardsForUserAndTeam(th.GetUser1().ID, model.GlobalTeamID, true)
		require.NoError(t, err)
		require.Len(t, boardsImported, 1)
		boardImported := boardsImported[0]
		blocksImported, err := th.Server.App().GetBlocksForBoard(boardImported.ID)
		require.NoError(t, err)
		require.Len(t, blocksImported, 1)
		require.Equal(t, block.Title, blocksImported[0].Title)
	})
}
