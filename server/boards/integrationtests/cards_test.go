// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/utils"
)

func TestCreateCard(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := th.CreateBoard(testTeamID, model.BoardTypeOpen)
		th.Logout(th.Client)

		card := &model.Card{
			Title: "basic card",
		}
		cardNew, resp := th.Client.CreateCard(board.ID, card, false)
		th.CheckUnauthorized(resp)
		require.Nil(t, cardNew)
	})

	t.Run("good", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := th.CreateBoard(testTeamID, model.BoardTypeOpen)
		contentOrder := []string{utils.NewID(utils.IDTypeBlock), utils.NewID(utils.IDTypeBlock), utils.NewID(utils.IDTypeBlock)}

		card := &model.Card{
			Title:        "test card 1",
			Icon:         "😱",
			ContentOrder: contentOrder,
		}

		cardNew, resp := th.Client.CreateCard(board.ID, card, false)
		require.NoError(t, resp.Error)
		th.CheckOK(resp)
		require.NotNil(t, cardNew)

		require.Equal(t, board.ID, cardNew.BoardID)
		require.Equal(t, "test card 1", cardNew.Title)
		require.Equal(t, "😱", cardNew.Icon)
		require.Equal(t, contentOrder, cardNew.ContentOrder)
	})

	t.Run("invalid card", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := th.CreateBoard(testTeamID, model.BoardTypeOpen)

		card := &model.Card{
			Title: "too many emoji's",
			Icon:  "😱😱😱😱",
		}

		cardNew, resp := th.Client.CreateCard(board.ID, card, false)
		require.Error(t, resp.Error)
		require.Nil(t, cardNew)
	})
}

func TestGetCards(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	board := th.CreateBoard(testTeamID, model.BoardTypeOpen)
	userID := th.GetUser1().ID

	const cardCount = 25

	// make some cards with content
	for i := 0; i < cardCount; i++ {
		card := &model.Card{
			BoardID:    board.ID,
			CreatedBy:  userID,
			ModifiedBy: userID,
			Title:      fmt.Sprintf("%d", i),
		}
		cardNew, resp := th.Client.CreateCard(board.ID, card, true)
		th.CheckOK(resp)

		blocks := make([]*model.Block, 0, 3)
		for j := 0; j < 3; j++ {
			now := model.GetMillis()
			block := &model.Block{
				ID:         utils.NewID(utils.IDTypeBlock),
				ParentID:   cardNew.ID,
				CreatedBy:  userID,
				ModifiedBy: userID,
				CreateAt:   now,
				UpdateAt:   now,
				Schema:     1,
				Type:       model.TypeText,
				Title:      fmt.Sprintf("text %d for card %d", j, i),
				BoardID:    board.ID,
			}
			blocks = append(blocks, block)
		}
		_, resp = th.Client.InsertBlocks(board.ID, blocks, true)
		th.CheckOK(resp)
	}

	t.Run("fetch all cards", func(t *testing.T) {
		cards, resp := th.Client.GetCards(board.ID, 0, -1)
		th.CheckOK(resp)
		assert.Len(t, cards, cardCount)
	})

	t.Run("fetch with pagination", func(t *testing.T) {
		cardNums := make(map[int]struct{})

		// return first 10
		cards, resp := th.Client.GetCards(board.ID, 0, 10)
		th.CheckOK(resp)
		assert.Len(t, cards, 10)
		for _, card := range cards {
			cardNum, err := strconv.Atoi(card.Title)
			require.NoError(t, err)
			cardNums[cardNum] = struct{}{}
		}

		// return second 10
		cards, resp = th.Client.GetCards(board.ID, 1, 10)
		th.CheckOK(resp)
		assert.Len(t, cards, 10)
		for _, card := range cards {
			cardNum, err := strconv.Atoi(card.Title)
			require.NoError(t, err)
			cardNums[cardNum] = struct{}{}
		}

		// return remaining 5
		cards, resp = th.Client.GetCards(board.ID, 2, 10)
		th.CheckOK(resp)
		assert.Len(t, cards, 5)
		for _, card := range cards {
			cardNum, err := strconv.Atoi(card.Title)
			require.NoError(t, err)
			cardNums[cardNum] = struct{}{}
		}

		// make sure all card numbers were returned
		assert.Len(t, cardNums, cardCount)
		for i := 0; i < cardCount; i++ {
			_, ok := cardNums[i]
			assert.True(t, ok)
		}
	})

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th.Logout(th.Client)

		cards, resp := th.Client.GetCards(board.ID, 0, 10)
		th.CheckUnauthorized(resp)
		require.Nil(t, cards)
	})
}

func TestPatchCard(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		_, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 1)
		card := cards[0]

		th.Logout(th.Client)

		newTitle := "another title"
		patch := &model.CardPatch{
			Title: &newTitle,
		}

		patchedCard, resp := th.Client.PatchCard(card.ID, patch, false)
		th.CheckUnauthorized(resp)
		require.Nil(t, patchedCard)
	})

	t.Run("good", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 1)
		card := cards[0]

		// Patch the card
		newTitle := "another title"
		newIcon := "🐿"
		newContentOrder := reverse(card.ContentOrder)
		updatedProps := modifyCardProps(card.Properties)
		patch := &model.CardPatch{
			Title:             &newTitle,
			Icon:              &newIcon,
			ContentOrder:      &newContentOrder,
			UpdatedProperties: updatedProps,
		}

		patchedCard, resp := th.Client.PatchCard(card.ID, patch, false)

		th.CheckOK(resp)
		require.NotNil(t, patchedCard)
		require.Equal(t, board.ID, patchedCard.BoardID)
		require.Equal(t, newTitle, patchedCard.Title)
		require.Equal(t, newIcon, patchedCard.Icon)
		require.NotEqual(t, card.ContentOrder, patchedCard.ContentOrder)
		require.ElementsMatch(t, card.ContentOrder, patchedCard.ContentOrder)
		require.EqualValues(t, updatedProps, patchedCard.Properties)
	})

	t.Run("invalid card patch", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		_, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 1)
		card := cards[0]

		// Bad patch  (too many emoji)
		newIcon := "🐿🐿🐿"
		patch := &model.CardPatch{
			Icon: &newIcon,
		}

		cardNew, resp := th.Client.PatchCard(card.ID, patch, false)
		require.Error(t, resp.Error)
		require.Nil(t, cardNew)
	})
}

func TestGetCard(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		_, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 1)
		card := cards[0]

		th.Logout(th.Client)

		cardFetched, resp := th.Client.GetCard(card.ID)
		th.CheckUnauthorized(resp)
		require.Nil(t, cardFetched)
	})

	t.Run("good", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board, cards := th.CreateBoardAndCards(testTeamID, model.BoardTypeOpen, 1)
		card := cards[0]

		cardFetched, resp := th.Client.GetCard(card.ID)

		th.CheckOK(resp)
		require.NotNil(t, cardFetched)
		require.Equal(t, board.ID, cardFetched.BoardID)
		require.Equal(t, card.Title, cardFetched.Title)
		require.Equal(t, card.Icon, cardFetched.Icon)
		require.Equal(t, card.ContentOrder, cardFetched.ContentOrder)
		require.EqualValues(t, card.Properties, cardFetched.Properties)
	})
}

// Helpers.
func reverse(src []string) []string {
	out := make([]string, 0, len(src))
	for i := len(src) - 1; i >= 0; i-- {
		out = append(out, src[i])
	}
	return out
}

func modifyCardProps(m map[string]any) map[string]any {
	out := make(map[string]any)
	for k := range m {
		out[k] = utils.NewID(utils.IDTypeBlock)
	}
	return out
}
