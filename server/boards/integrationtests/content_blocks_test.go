// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/utils"

	"github.com/stretchr/testify/require"
)

func TestMoveContentBlock(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	board := th.CreateBoard("team-id", model.BoardTypeOpen)

	cardID1 := utils.NewID(utils.IDTypeBlock)
	cardID2 := utils.NewID(utils.IDTypeBlock)
	contentBlockID1 := utils.NewID(utils.IDTypeBlock)
	contentBlockID2 := utils.NewID(utils.IDTypeBlock)
	contentBlockID3 := utils.NewID(utils.IDTypeBlock)
	contentBlockID4 := utils.NewID(utils.IDTypeBlock)
	contentBlockID5 := utils.NewID(utils.IDTypeBlock)
	contentBlockID6 := utils.NewID(utils.IDTypeBlock)

	card1 := &model.Block{
		ID:       cardID1,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		Fields: map[string]interface{}{
			"contentOrder": []string{contentBlockID1, contentBlockID2, contentBlockID3},
		},
	}
	card2 := &model.Block{
		ID:       cardID2,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		Fields: map[string]interface{}{
			"contentOrder": []string{contentBlockID4, contentBlockID5, contentBlockID6},
		},
	}

	contentBlock1 := &model.Block{
		ID:       contentBlockID1,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID1,
	}
	contentBlock2 := &model.Block{
		ID:       contentBlockID2,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID1,
	}
	contentBlock3 := &model.Block{
		ID:       contentBlockID3,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID1,
	}
	contentBlock4 := &model.Block{
		ID:       contentBlockID4,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID2,
	}
	contentBlock5 := &model.Block{
		ID:       contentBlockID5,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID2,
	}
	contentBlock6 := &model.Block{
		ID:       contentBlockID6,
		BoardID:  board.ID,
		CreateAt: 1,
		UpdateAt: 1,
		Type:     model.TypeCard,
		ParentID: cardID2,
	}

	newBlocks := []*model.Block{
		contentBlock1,
		contentBlock2,
		contentBlock3,
		contentBlock4,
		contentBlock5,
		contentBlock6,
		card1,
		card2,
	}
	createdBlocks, resp := th.Client.InsertBlocks(board.ID, newBlocks, false)
	require.NoError(t, resp.Error)
	require.Len(t, newBlocks, 8)

	contentBlock1.ID = createdBlocks[0].ID
	contentBlock2.ID = createdBlocks[1].ID
	contentBlock3.ID = createdBlocks[2].ID
	contentBlock4.ID = createdBlocks[3].ID
	contentBlock5.ID = createdBlocks[4].ID
	contentBlock6.ID = createdBlocks[5].ID
	card1.ID = createdBlocks[6].ID
	card2.ID = createdBlocks[7].ID

	ttCases := []struct {
		name                 string
		srcBlockID           string
		dstBlockID           string
		where                string
		userID               string
		errorMessage         string
		expectedContentOrder []interface{}
	}{
		{
			name:                 "not matching parents",
			srcBlockID:           contentBlock1.ID,
			dstBlockID:           contentBlock4.ID,
			where:                "after",
			userID:               "user-id",
			errorMessage:         fmt.Sprintf("payload: {\"error\":\"not matching parent %s and %s\",\"errorCode\":400}", card1.ID, card2.ID),
			expectedContentOrder: []interface{}{contentBlock1.ID, contentBlock2.ID, contentBlock3.ID},
		},
		{
			name:                 "valid request with not real change",
			srcBlockID:           contentBlock2.ID,
			dstBlockID:           contentBlock1.ID,
			where:                "after",
			userID:               "user-id",
			errorMessage:         "",
			expectedContentOrder: []interface{}{contentBlock1.ID, contentBlock2.ID, contentBlock3.ID},
		},
		{
			name:                 "valid request changing order with before",
			srcBlockID:           contentBlock2.ID,
			dstBlockID:           contentBlock1.ID,
			where:                "before",
			userID:               "user-id",
			errorMessage:         "",
			expectedContentOrder: []interface{}{contentBlock2.ID, contentBlock1.ID, contentBlock3.ID},
		},
		{
			name:                 "valid request changing order with after",
			srcBlockID:           contentBlock1.ID,
			dstBlockID:           contentBlock2.ID,
			where:                "after",
			userID:               "user-id",
			errorMessage:         "",
			expectedContentOrder: []interface{}{contentBlock2.ID, contentBlock1.ID, contentBlock3.ID},
		},
	}

	for _, tc := range ttCases {
		t.Run(tc.name, func(t *testing.T) {
			_, resp := th.Client.MoveContentBlock(tc.srcBlockID, tc.dstBlockID, tc.where, tc.userID)
			if tc.errorMessage == "" {
				require.NoError(t, resp.Error)
			} else {
				require.EqualError(t, resp.Error, tc.errorMessage)
			}

			parent, err := th.Server.App().GetBlockByID(card1.ID)
			require.NoError(t, err)
			require.Equal(t, parent.Fields["contentOrder"], tc.expectedContentOrder)
		})
	}
}
