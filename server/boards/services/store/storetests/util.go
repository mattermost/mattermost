// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

func createTestUsers(t *testing.T, store store.Store, num int) []*model.User {
	var users []*model.User
	for i := 0; i < num; i++ {
		user := &model.User{
			ID:       utils.NewID(utils.IDTypeUser),
			Username: fmt.Sprintf("mooncake.%d", i),
			Email:    fmt.Sprintf("mooncake.%d@example.com", i),
		}
		newUser, err := store.CreateUser(user)
		require.NoError(t, err)
		require.NotNil(t, newUser)

		users = append(users, user)
	}
	return users
}

func createTestBlocks(t *testing.T, store store.Store, userID string, num int) []*model.Block {
	var blocks []*model.Block
	for i := 0; i < num; i++ {
		block := &model.Block{
			ID:        utils.NewID(utils.IDTypeBlock),
			BoardID:   utils.NewID(utils.IDTypeBoard),
			Type:      model.TypeCard,
			CreatedBy: userID,
		}
		err := store.InsertBlock(block, userID)
		require.NoError(t, err)

		blocks = append(blocks, block)
	}
	return blocks
}

func createTestBlocksForCard(t *testing.T, store store.Store, cardID string, num int) []*model.Block {
	card, err := store.GetBlock(cardID)
	require.NoError(t, err)
	assert.EqualValues(t, model.TypeCard, card.Type)

	var blocks []*model.Block
	for i := 0; i < num; i++ {
		block := &model.Block{
			ID:        utils.NewID(utils.IDTypeBlock),
			BoardID:   card.BoardID,
			Type:      model.TypeText,
			CreatedBy: card.CreatedBy,
			ParentID:  card.ID,
			Title:     fmt.Sprintf("text %d", i),
		}
		err := store.InsertBlock(block, card.CreatedBy)
		require.NoError(t, err)

		blocks = append(blocks, block)
	}
	return blocks
}

//nolint:unparam
func createTestCards(t *testing.T, store store.Store, userID string, boardID string, num int) []*model.Block {
	var blocks []*model.Block
	for i := 0; i < num; i++ {
		block := &model.Block{
			ID:        utils.NewID(utils.IDTypeCard),
			BoardID:   boardID,
			ParentID:  boardID,
			Type:      model.TypeCard,
			CreatedBy: userID,
			Title:     fmt.Sprintf("card %d", i),
		}
		err := store.InsertBlock(block, userID)
		require.NoError(t, err)

		blocks = append(blocks, block)
	}
	return blocks
}

//nolint:unparam
func createTestBoards(t *testing.T, store store.Store, teamID string, userID string, num int) []*model.Board {
	var boards []*model.Board
	for i := 0; i < num; i++ {
		board := &model.Board{
			ID:        utils.NewID(utils.IDTypeBoard),
			TeamID:    teamID,
			Type:      "O",
			CreatedBy: userID,
			Title:     fmt.Sprintf("board %d", i),
		}
		boardNew, err := store.InsertBoard(board, userID)
		require.NoError(t, err)

		boards = append(boards, boardNew)
	}
	return boards
}

//nolint:unparam
func deleteTestBoard(t *testing.T, store store.Store, boardID string, userID string) {
	err := store.DeleteBoard(boardID, userID)
	require.NoError(t, err)
}

// extractIDs is a test helper that extracts a sorted slice of IDs from slices of various struct types.
// Might have used generics here except that would require implementing a `GetID` method on each type.
func extractIDs(t *testing.T, arr ...any) []string {
	ids := make([]string, 0)

	for _, item := range arr {
		if item == nil {
			continue
		}

		switch tarr := item.(type) {
		case []*model.Board:
			for _, b := range tarr {
				if b != nil {
					ids = append(ids, b.ID)
				}
			}
		case []*model.BoardHistory:
			for _, bh := range tarr {
				ids = append(ids, bh.ID)
			}
		case []*model.Block:
			for _, b := range tarr {
				if b != nil {
					ids = append(ids, b.ID)
				}
			}
		case []*model.BlockHistory:
			for _, bh := range tarr {
				ids = append(ids, bh.ID)
			}
		default:
			t.Errorf("unsupported type %T extracting board ID", item)
		}
	}

	// sort the ids to make it easier to compare lists of ids visually.
	sort.Strings(ids)
	return ids
}
