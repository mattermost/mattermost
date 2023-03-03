// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/stretchr/testify/require"
)

func TestGenerateBlockIDs(t *testing.T) {
	t.Run("Should generate a new ID for a single block with no references", func(t *testing.T) {
		blockID := utils.NewID(utils.IDTypeBlock)
		blocks := []*Block{{ID: blockID}}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID, blocks[0].ID)
		require.Zero(t, blocks[0].BoardID)
		require.Zero(t, blocks[0].ParentID)
	})

	t.Run("Should generate a new ID for a single block with references", func(t *testing.T) {
		blockID := utils.NewID(utils.IDTypeBlock)
		boardID := utils.NewID(utils.IDTypeBlock)
		parentID := utils.NewID(utils.IDTypeBlock)
		blocks := []*Block{{ID: blockID, BoardID: boardID, ParentID: parentID}}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID, blocks[0].ID)
		require.Equal(t, boardID, blocks[0].BoardID)
		require.Equal(t, parentID, blocks[0].ParentID)
	})

	t.Run("Should generate IDs and link multiple blocks with existing references", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := utils.NewID(utils.IDTypeBlock)
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{ID: blockID1, BoardID: boardID1, ParentID: parentID1}

		blockID2 := utils.NewID(utils.IDTypeBlock)
		boardID2 := blockID1
		parentID2 := utils.NewID(utils.IDTypeBlock)
		block2 := &Block{ID: blockID2, BoardID: boardID2, ParentID: parentID2}

		blocks := []*Block{block1, block2}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID1, blocks[0].ID)
		require.Equal(t, boardID1, blocks[0].BoardID)
		require.Equal(t, parentID1, blocks[0].ParentID)

		require.NotEqual(t, blockID2, blocks[1].ID)
		require.NotEqual(t, boardID2, blocks[1].BoardID)
		require.Equal(t, parentID2, blocks[1].ParentID)

		// blockID1 was referenced, so it should still be after the ID
		// changes
		require.Equal(t, blocks[0].ID, blocks[1].BoardID)
	})

	t.Run("Should generate new IDs but not modify nonexisting references", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := ""
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{ID: blockID1, BoardID: boardID1, ParentID: parentID1}

		blockID2 := utils.NewID(utils.IDTypeBlock)
		boardID2 := utils.NewID(utils.IDTypeBlock)
		parentID2 := ""
		block2 := &Block{ID: blockID2, BoardID: boardID2, ParentID: parentID2}

		blocks := []*Block{block1, block2}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		// only the IDs should have changed
		require.NotEqual(t, blockID1, blocks[0].ID)
		require.Zero(t, blocks[0].BoardID)
		require.Equal(t, parentID1, blocks[0].ParentID)

		require.NotEqual(t, blockID2, blocks[1].ID)
		require.Equal(t, boardID2, blocks[1].BoardID)
		require.Zero(t, blocks[1].ParentID)
	})

	t.Run("Should modify correctly multiple blocks with existing and nonexisting references", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := utils.NewID(utils.IDTypeBlock)
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{ID: blockID1, BoardID: boardID1, ParentID: parentID1}

		// linked to 1
		blockID2 := utils.NewID(utils.IDTypeBlock)
		boardID2 := blockID1
		parentID2 := utils.NewID(utils.IDTypeBlock)
		block2 := &Block{ID: blockID2, BoardID: boardID2, ParentID: parentID2}

		// linked to 2
		blockID3 := utils.NewID(utils.IDTypeBlock)
		boardID3 := blockID2
		parentID3 := utils.NewID(utils.IDTypeBlock)
		block3 := &Block{ID: blockID3, BoardID: boardID3, ParentID: parentID3}

		// linked to 1
		blockID4 := utils.NewID(utils.IDTypeBlock)
		boardID4 := blockID1
		parentID4 := utils.NewID(utils.IDTypeBlock)
		block4 := &Block{ID: blockID4, BoardID: boardID4, ParentID: parentID4}

		// blocks are shuffled
		blocks := []*Block{block4, block2, block1, block3}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		// block 1
		require.NotEqual(t, blockID1, blocks[2].ID)
		require.Equal(t, boardID1, blocks[2].BoardID)
		require.Equal(t, parentID1, blocks[2].ParentID)

		// block 2
		require.NotEqual(t, blockID2, blocks[1].ID)
		require.NotEqual(t, boardID2, blocks[1].BoardID)
		require.Equal(t, blocks[2].ID, blocks[1].BoardID) // link to 1
		require.Equal(t, parentID2, blocks[1].ParentID)

		// block 3
		require.NotEqual(t, blockID3, blocks[3].ID)
		require.NotEqual(t, boardID3, blocks[3].BoardID)
		require.Equal(t, blocks[1].ID, blocks[3].BoardID) // link to 2
		require.Equal(t, parentID3, blocks[3].ParentID)

		// block 4
		require.NotEqual(t, blockID4, blocks[0].ID)
		require.NotEqual(t, boardID4, blocks[0].BoardID)
		require.Equal(t, blocks[2].ID, blocks[0].BoardID) // link to 1
		require.Equal(t, parentID4, blocks[0].ParentID)
	})

	t.Run("Should update content order", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := utils.NewID(utils.IDTypeBlock)
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{
			ID:       blockID1,
			BoardID:  boardID1,
			ParentID: parentID1,
		}

		blockID2 := utils.NewID(utils.IDTypeBlock)
		boardID2 := utils.NewID(utils.IDTypeBlock)
		parentID2 := utils.NewID(utils.IDTypeBlock)
		block2 := &Block{
			ID:       blockID2,
			BoardID:  boardID2,
			ParentID: parentID2,
			Fields: map[string]interface{}{
				"contentOrder": []interface{}{
					blockID1,
				},
			},
		}

		blocks := []*Block{block1, block2}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID1, blocks[0].ID)
		require.Equal(t, boardID1, blocks[0].BoardID)
		require.Equal(t, parentID1, blocks[0].ParentID)

		require.NotEqual(t, blockID2, blocks[1].ID)
		require.Equal(t, boardID2, blocks[1].BoardID)
		require.Equal(t, parentID2, blocks[1].ParentID)

		// since block 1 was referenced in block 2,
		// the ID should have been changed in content order
		block2ContentOrder, ok := block2.Fields["contentOrder"].([]interface{})
		require.True(t, ok)
		require.NotEqual(t, blockID1, block2ContentOrder[0].(string))
		require.Equal(t, blocks[0].ID, block2ContentOrder[0].(string))
	})

	t.Run("Should update content order when it contain slices", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := utils.NewID(utils.IDTypeBlock)
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{
			ID:       blockID1,
			BoardID:  boardID1,
			ParentID: parentID1,
		}

		blockID2 := utils.NewID(utils.IDTypeBlock)
		block2 := &Block{
			ID:       blockID2,
			BoardID:  boardID1,
			ParentID: parentID1,
		}

		blockID3 := utils.NewID(utils.IDTypeBlock)
		block3 := &Block{
			ID:       blockID3,
			BoardID:  boardID1,
			ParentID: parentID1,
		}

		blockID4 := utils.NewID(utils.IDTypeBlock)
		boardID2 := utils.NewID(utils.IDTypeBlock)
		parentID2 := utils.NewID(utils.IDTypeBlock)

		block4 := &Block{
			ID:       blockID4,
			BoardID:  boardID2,
			ParentID: parentID2,
			Fields: map[string]interface{}{
				"contentOrder": []interface{}{
					blockID1,
					[]interface{}{
						blockID2,
						blockID3,
					},
				},
			},
		}

		blocks := []*Block{block1, block2, block3, block4}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID1, blocks[0].ID)
		require.Equal(t, boardID1, blocks[0].BoardID)
		require.Equal(t, parentID1, blocks[0].ParentID)

		require.NotEqual(t, blockID4, blocks[3].ID)
		require.Equal(t, boardID2, blocks[3].BoardID)
		require.Equal(t, parentID2, blocks[3].ParentID)

		// since block 1 was referenced in block 2,
		// the ID should have been changed in content order
		block4ContentOrder, ok := block4.Fields["contentOrder"].([]interface{})
		require.True(t, ok)
		require.NotEqual(t, blockID1, block4ContentOrder[0].(string))
		require.NotEqual(t, blockID2, block4ContentOrder[1].([]interface{})[0])
		require.NotEqual(t, blockID3, block4ContentOrder[1].([]interface{})[1])
		require.Equal(t, blocks[0].ID, block4ContentOrder[0].(string))
		require.Equal(t, blocks[1].ID, block4ContentOrder[1].([]interface{})[0])
		require.Equal(t, blocks[2].ID, block4ContentOrder[1].([]interface{})[1])
	})

	t.Run("Should update Id of default template view", func(t *testing.T) {
		blockID1 := utils.NewID(utils.IDTypeBlock)
		boardID1 := utils.NewID(utils.IDTypeBlock)
		parentID1 := utils.NewID(utils.IDTypeBlock)
		block1 := &Block{
			ID:       blockID1,
			BoardID:  boardID1,
			ParentID: parentID1,
		}

		blockID2 := utils.NewID(utils.IDTypeBlock)
		boardID2 := utils.NewID(utils.IDTypeBlock)
		parentID2 := utils.NewID(utils.IDTypeBlock)
		block2 := &Block{
			ID:       blockID2,
			BoardID:  boardID2,
			ParentID: parentID2,
			Fields: map[string]interface{}{
				"defaultTemplateId": blockID1,
			},
		}

		blocks := []*Block{block1, block2}

		blocks = GenerateBlockIDs(blocks, &mlog.Logger{})

		require.NotEqual(t, blockID1, blocks[0].ID)
		require.Equal(t, boardID1, blocks[0].BoardID)
		require.Equal(t, parentID1, blocks[0].ParentID)

		require.NotEqual(t, blockID2, blocks[1].ID)
		require.Equal(t, boardID2, blocks[1].BoardID)
		require.Equal(t, parentID2, blocks[1].ParentID)

		block2DefaultTemplateID, ok := block2.Fields["defaultTemplateId"].(string)
		require.True(t, ok)
		require.NotEqual(t, blockID1, block2DefaultTemplateID)
		require.Equal(t, blocks[0].ID, block2DefaultTemplateID)
	})
}

func TestStampModificationMetadata(t *testing.T) {
	t.Run("base case", func(t *testing.T) {
		block := &Block{}
		blocks := []*Block{block}
		assert.Empty(t, block.ModifiedBy)
		assert.Empty(t, block.UpdateAt)

		StampModificationMetadata("user_id_1", blocks, nil)
		assert.Equal(t, "user_id_1", blocks[0].ModifiedBy)
		assert.NotEmpty(t, blocks[0].UpdateAt)
	})
}
