package integrationtests

import (
	"math"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

var (
	OneHour int64 = 360000
	OneDay  int64 = OneHour * 24
	OneYear int64 = OneDay * 365
)

func setupTestHelperForCompliance(t *testing.T, complianceLicense bool) (*TestHelper, Clients) {
	os.Setenv("FOCALBOARD_UNIT_TESTING_COMPLIANCE", strconv.FormatBool(complianceLicense))

	th := SetupTestHelperPluginMode(t)
	clients := setupClients(th)

	th.Client = clients.TeamMember
	th.Client2 = clients.TeamMember

	return th, clients
}

func TestGetBoardsForCompliance(t *testing.T) {
	t.Run("missing Features.Compliance license should fail", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, false)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bcr, resp := clients.Admin.GetBoardsForCompliance(testTeamID, 0, 0)

		th.CheckNotImplemented(resp)
		require.Nil(t, bcr)
	})

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)
		th.Logout(th.Client)

		bcr, resp := clients.Anon.GetBoardsForCompliance(testTeamID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bcr)
	})

	t.Run("a user without manage_system permission should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bcr, resp := clients.TeamMember.GetBoardsForCompliance(testTeamID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bcr)
	})

	t.Run("good call", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 10
		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, count)

		bcr, resp := clients.Admin.GetBoardsForCompliance(testTeamID, 0, 0)
		th.CheckOK(resp)
		require.False(t, bcr.HasNext)
		require.Len(t, bcr.Results, count)
	})

	t.Run("pagination", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 20
		const perPage = 3
		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, count)

		boards := make([]*model.Board, 0, count)
		page := 0
		for {
			bcr, resp := clients.Admin.GetBoardsForCompliance(testTeamID, page, perPage)
			page++
			th.CheckOK(resp)
			boards = append(boards, bcr.Results...)
			if !bcr.HasNext {
				break
			}
		}
		require.Len(t, boards, count)
		require.Equal(t, int(math.Floor((count/perPage)+1)), page)
	})

	t.Run("invalid teamID", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bcr, resp := clients.Admin.GetBoardsForCompliance(utils.NewID(utils.IDTypeTeam), 0, 0)

		th.CheckBadRequest(resp)
		require.Nil(t, bcr)
	})
}

func TestGetBoardsComplianceHistory(t *testing.T) {
	t.Run("missing Features.Compliance license should fail", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, false)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Admin.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, 0, 0)

		th.CheckNotImplemented(resp)
		require.Nil(t, bchr)
	})

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)
		th.Logout(th.Client)

		bchr, resp := clients.Anon.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bchr)
	})

	t.Run("a user without manage_system permission should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.TeamMember.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bchr)
	})

	t.Run("good call, exclude deleted", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 10
		boards := th.CreateBoards(testTeamID, model.BoardTypeOpen, count)

		deleted, resp := th.Client.DeleteBoard(boards[0].ID)
		th.CheckOK(resp)
		require.True(t, deleted)

		deleted, resp = th.Client.DeleteBoard(boards[1].ID)
		th.CheckOK(resp)
		require.True(t, deleted)

		bchr, resp := clients.Admin.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, false, testTeamID, 0, 0)
		th.CheckOK(resp)
		require.False(t, bchr.HasNext)
		require.Len(t, bchr.Results, count-2) // two boards deleted
	})

	t.Run("good call, include deleted", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 10
		boards := th.CreateBoards(testTeamID, model.BoardTypeOpen, count)

		deleted, resp := th.Client.DeleteBoard(boards[0].ID)
		th.CheckOK(resp)
		require.True(t, deleted)

		deleted, resp = th.Client.DeleteBoard(boards[1].ID)
		th.CheckOK(resp)
		require.True(t, deleted)

		bchr, resp := clients.Admin.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, 0, 0)
		th.CheckOK(resp)
		require.False(t, bchr.HasNext)
		require.Len(t, bchr.Results, count+2) // both deleted boards have 2 history records each
	})

	t.Run("pagination", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 20
		const perPage = 3
		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, count)

		boardHistory := make([]*model.BoardHistory, 0, count)
		page := 0
		for {
			bchr, resp := clients.Admin.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, page, perPage)
			page++
			th.CheckOK(resp)
			boardHistory = append(boardHistory, bchr.Results...)
			if !bchr.HasNext {
				break
			}
		}
		require.Len(t, boardHistory, count)
		require.Equal(t, int(math.Floor((count/perPage)+1)), page)
	})

	t.Run("invalid teamID", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_ = th.CreateBoards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Admin.GetBoardsComplianceHistory(utils.GetMillis()-OneDay, true, utils.NewID(utils.IDTypeTeam), 0, 0)

		th.CheckBadRequest(resp)
		require.Nil(t, bchr)
	})
}

func TestGetBlocksComplianceHistory(t *testing.T) {
	t.Run("missing Features.Compliance license should fail", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, false)
		defer th.TearDown()

		board, _ := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, board.ID, 0, 0)

		th.CheckNotImplemented(resp)
		require.Nil(t, bchr)
	})

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		board, _ := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Anon.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, board.ID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bchr)
	})

	t.Run("a user without manage_system permission should be rejected", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		board, _ := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.TeamMember.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, board.ID, 0, 0)

		th.CheckUnauthorized(resp)
		require.Nil(t, bchr)
	})

	t.Run("good call, exclude deleted", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 10
		board, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, count)

		deleted, resp := th.Client.DeleteBlock(board.ID, cards[0].ID, true)
		th.CheckOK(resp)
		require.True(t, deleted)

		deleted, resp = th.Client.DeleteBlock(board.ID, cards[1].ID, true)
		th.CheckOK(resp)
		require.True(t, deleted)

		bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, false, testTeamID, board.ID, 0, 0)
		th.CheckOK(resp)
		require.False(t, bchr.HasNext)
		require.Len(t, bchr.Results, count-2) // 2 blocks deleted
	})

	t.Run("good call, include deleted", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 10
		board, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, count)

		deleted, resp := th.Client.DeleteBlock(board.ID, cards[0].ID, true)
		th.CheckOK(resp)
		require.True(t, deleted)

		deleted, resp = th.Client.DeleteBlock(board.ID, cards[1].ID, true)
		th.CheckOK(resp)
		require.True(t, deleted)

		bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, board.ID, 0, 0)
		th.CheckOK(resp)
		require.False(t, bchr.HasNext)
		require.Len(t, bchr.Results, count+2) // both deleted boards have 2 history records each
	})

	t.Run("pagination", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		const count = 20
		const perPage = 3
		board, _ := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, count)

		blockHistory := make([]*model.BlockHistory, 0, count)
		page := 0
		for {
			bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, board.ID, page, perPage)
			page++
			th.CheckOK(resp)
			blockHistory = append(blockHistory, bchr.Results...)
			if !bchr.HasNext {
				break
			}
		}
		require.Len(t, blockHistory, count)
		require.Equal(t, int(math.Floor((count/perPage)+1)), page)
	})

	t.Run("invalid teamID", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		board, _ := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, utils.NewID(utils.IDTypeTeam), board.ID, 0, 0)

		th.CheckBadRequest(resp)
		require.Nil(t, bchr)
	})

	t.Run("invalid boardID", func(t *testing.T) {
		th, clients := setupTestHelperForCompliance(t, true)
		defer th.TearDown()

		_, _ = th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 2)

		bchr, resp := clients.Admin.GetBlocksComplianceHistory(utils.GetMillis()-OneDay, true, testTeamID, utils.NewID(utils.IDTypeBoard), 0, 0)

		th.CheckBadRequest(resp)
		require.Nil(t, bchr)
	})
}
