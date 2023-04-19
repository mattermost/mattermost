// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	storeservice "github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

func StoreTestCloudStore(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("GetUsedCardsCount", func(t *testing.T) {
		runStoreTests(t, testGetUsedCardsCount)
	})
	t.Run("TestGetCardLimitTimestamp", func(t *testing.T) {
		runStoreTests(t, testGetCardLimitTimestamp)
	})
	t.Run("TestUpdateCardLimitTimestamp", func(t *testing.T) {
		runStoreTests(t, testUpdateCardLimitTimestamp)
	})
}

func testGetUsedCardsCount(t *testing.T, store storeservice.Store) {
	userID := "user-id"

	t.Run("should return zero when no cards have been created", func(t *testing.T) {
		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Zero(t, count)
	})

	t.Run("should correctly return the cards of all boards", func(t *testing.T) {
		// two boards
		for _, boardID := range []string{"board1", "board2"} {
			boardType := model.BoardTypeOpen
			if boardID == "board2" {
				boardType = model.BoardTypePrivate
			}

			board := &model.Board{
				ID:     boardID,
				TeamID: testTeamID,
				Type:   boardType,
			}

			_, err := store.InsertBoard(board, userID)
			require.NoError(t, err)
		}

		// board 1 has three cards
		for _, cardID := range []string{"card1", "card2", "card3"} {
			card := &model.Block{
				ID:       cardID,
				ParentID: "board1",
				BoardID:  "board1",
				Type:     model.TypeCard,
			}
			require.NoError(t, store.InsertBlock(card, userID))
		}

		// board 2 has two cards
		for _, cardID := range []string{"card4", "card5"} {
			card := &model.Block{
				ID:       cardID,
				ParentID: "board2",
				BoardID:  "board2",
				Type:     model.TypeCard,
			}
			require.NoError(t, store.InsertBlock(card, userID))
		}

		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Equal(t, 5, count)
	})

	t.Run("should not take into account content blocks", func(t *testing.T) {
		// we add a couple of content blocks
		text := &model.Block{
			ID:       "text-id",
			ParentID: "card1",
			BoardID:  "board1",
			Type:     model.TypeText,
		}
		require.NoError(t, store.InsertBlock(text, userID))

		view := &model.Block{
			ID:       "view-id",
			ParentID: "board1",
			BoardID:  "board1",
			Type:     model.TypeView,
		}
		require.NoError(t, store.InsertBlock(view, userID))

		// and count should not change
		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Equal(t, 5, count)
	})

	t.Run("should not take into account cards belonging to templates", func(t *testing.T) {
		// we add a template with cards
		templateID := "template-id"
		boardTemplate := &model.Block{
			ID:      templateID,
			BoardID: templateID,
			Type:    model.TypeBoard,
			Fields: map[string]interface{}{
				"isTemplate": true,
			},
		}
		require.NoError(t, store.InsertBlock(boardTemplate, userID))

		for _, cardID := range []string{"card6", "card7", "card8"} {
			card := &model.Block{
				ID:       cardID,
				ParentID: templateID,
				BoardID:  templateID,
				Type:     model.TypeCard,
			}
			require.NoError(t, store.InsertBlock(card, userID))
		}

		// and count should still be the same
		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Equal(t, 5, count)
	})

	t.Run("should not take into account deleted cards", func(t *testing.T) {
		// we create a ninth card on the first board
		card9 := &model.Block{
			ID:       "card9",
			ParentID: "board1",
			BoardID:  "board1",
			Type:     model.TypeCard,
			DeleteAt: utils.GetMillis(),
		}
		require.NoError(t, store.InsertBlock(card9, userID))

		// and count should still be the same
		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Equal(t, 5, count)
	})

	t.Run("should not take into account cards from deleted boards", func(t *testing.T) {
		require.NoError(t, store.DeleteBoard("board2", "user-id"))

		count, err := store.GetUsedCardsCount()
		require.NoError(t, err)
		require.Equal(t, 3, count)
	})
}

func testGetCardLimitTimestamp(t *testing.T, store storeservice.Store) {
	t.Run("should return 0 if there is no entry in the database", func(t *testing.T) {
		rawValue, err := store.GetSystemSetting(storeservice.CardLimitTimestampSystemKey)
		require.NoError(t, err)
		require.Equal(t, "", rawValue)

		cardLimitTimestamp, err := store.GetCardLimitTimestamp()
		require.NoError(t, err)
		require.Zero(t, cardLimitTimestamp)
	})

	t.Run("should return an int64 representation of the value", func(t *testing.T) {
		require.NoError(t, store.SetSystemSetting(storeservice.CardLimitTimestampSystemKey, "1234"))

		cardLimitTimestamp, err := store.GetCardLimitTimestamp()
		require.NoError(t, err)
		require.Equal(t, int64(1234), cardLimitTimestamp)
	})

	t.Run("should return an invalid value error if the value is not a number", func(t *testing.T) {
		require.NoError(t, store.SetSystemSetting(storeservice.CardLimitTimestampSystemKey, "abc"))

		cardLimitTimestamp, err := store.GetCardLimitTimestamp()
		require.ErrorContains(t, err, "card limit value is invalid")
		require.Zero(t, cardLimitTimestamp)
	})
}

func testUpdateCardLimitTimestamp(t *testing.T, store storeservice.Store) {
	userID := "user-id"

	// two boards
	for _, boardID := range []string{"board1", "board2"} {
		boardType := model.BoardTypeOpen
		if boardID == "board2" {
			boardType = model.BoardTypePrivate
		}

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   boardType,
		}

		_, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
	}

	// board 1 has five cards
	for _, cardID := range []string{"card1", "card2", "card3", "card4", "card5"} {
		card := &model.Block{
			ID:       cardID,
			ParentID: "board1",
			BoardID:  "board1",
			Type:     model.TypeCard,
		}
		require.NoError(t, store.InsertBlock(card, userID))
		time.Sleep(10 * time.Millisecond)
	}

	// board 2 has five cards
	for _, cardID := range []string{"card6", "card7", "card8", "card9", "card10"} {
		card := &model.Block{
			ID:       cardID,
			ParentID: "board2",
			BoardID:  "board2",
			Type:     model.TypeCard,
		}
		require.NoError(t, store.InsertBlock(card, userID))
		time.Sleep(10 * time.Millisecond)
	}

	t.Run("should set the timestamp to zero if the card limit is zero", func(t *testing.T) {
		cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(0)
		require.NoError(t, err)
		require.Zero(t, cardLimitTimestamp)

		cardLimitTimestampStr, err := store.GetSystemSetting(storeservice.CardLimitTimestampSystemKey)
		require.NoError(t, err)
		require.Equal(t, "0", cardLimitTimestampStr)
	})

	t.Run("should correctly modify the limit several times in a row", func(t *testing.T) {
		cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(0)
		require.NoError(t, err)
		require.Zero(t, cardLimitTimestamp)

		cardLimitTimestamp, err = store.UpdateCardLimitTimestamp(10)
		require.NoError(t, err)
		require.NotZero(t, cardLimitTimestamp)

		cardLimitTimestampStr, err := store.GetSystemSetting(storeservice.CardLimitTimestampSystemKey)
		require.NoError(t, err)
		require.NotEqual(t, "0", cardLimitTimestampStr)

		cardLimitTimestamp, err = store.UpdateCardLimitTimestamp(0)
		require.NoError(t, err)
		require.Zero(t, cardLimitTimestamp)

		cardLimitTimestampStr, err = store.GetSystemSetting(storeservice.CardLimitTimestampSystemKey)
		require.NoError(t, err)
		require.Equal(t, "0", cardLimitTimestampStr)
	})

	t.Run("should set the correct timestamp", func(t *testing.T) {
		t.Run("limit 10", func(t *testing.T) {
			// we fetch the first block
			card1, err := store.GetBlock("card1")
			require.NoError(t, err)

			// and assert that if the limit is 10, the stored
			// timestamp corresponds to the card's update_at
			cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(10)
			require.NoError(t, err)
			require.Equal(t, card1.UpdateAt, cardLimitTimestamp)
		})

		t.Run("limit 5", func(t *testing.T) {
			// if the limit is 5, the timestamp should be the one from
			// the sixth card (the first five are older and out of the
			card6, err := store.GetBlock("card6")
			require.NoError(t, err)

			cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(5)
			require.NoError(t, err)
			require.Equal(t, card6.UpdateAt, cardLimitTimestamp)
		})

		t.Run("limit should be zero if we have less cards than the limit", func(t *testing.T) {
			cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(100)
			require.NoError(t, err)
			require.Zero(t, cardLimitTimestamp)
		})

		t.Run("we update the first inserted card and assert that with limit 1 that's the limit that is set", func(t *testing.T) {
			time.Sleep(10 * time.Millisecond)
			card1, err := store.GetBlock("card1")
			require.NoError(t, err)

			card1.Title = "New title"
			require.NoError(t, store.InsertBlock(card1, userID))

			newCard1, err := store.GetBlock("card1")
			require.NoError(t, err)

			cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(1)
			require.NoError(t, err)
			require.Equal(t, newCard1.UpdateAt, cardLimitTimestamp)
		})

		t.Run("limit should stop applying if we remove the last card", func(t *testing.T) {
			initialCardLimitTimestamp, err := store.GetCardLimitTimestamp()
			require.NoError(t, err)
			require.NotZero(t, initialCardLimitTimestamp)

			time.Sleep(10 * time.Millisecond)
			require.NoError(t, store.DeleteBlock("card1", userID))

			cardLimitTimestamp, err := store.UpdateCardLimitTimestamp(10)
			require.NoError(t, err)
			require.Zero(t, cardLimitTimestamp)
		})
	})
}
