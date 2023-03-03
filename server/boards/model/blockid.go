// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

// GenerateBlockIDs generates new IDs for all the blocks of the list,
// keeping consistent any references that other blocks would made to
// the original IDs, so a tree of blocks can get new IDs and maintain
// its shape.
func GenerateBlockIDs(blocks []*Block, logger mlog.LoggerIFace) []*Block {
	blockIDs := map[string]BlockType{}
	referenceIDs := map[string]bool{}
	for _, block := range blocks {
		if _, ok := blockIDs[block.ID]; !ok {
			blockIDs[block.ID] = block.Type
		}

		if _, ok := referenceIDs[block.BoardID]; !ok {
			referenceIDs[block.BoardID] = true
		}
		if _, ok := referenceIDs[block.ParentID]; !ok {
			referenceIDs[block.ParentID] = true
		}

		if _, ok := block.Fields["contentOrder"]; ok {
			contentOrder, typeOk := block.Fields["contentOrder"].([]interface{})
			if !typeOk {
				logger.Warn(
					"type assertion failed for content order when saving reference block IDs",
					mlog.String("blockID", block.ID),
					mlog.String("actionType", fmt.Sprintf("%T", block.Fields["contentOrder"])),
					mlog.String("expectedType", "[]interface{}"),
					mlog.String("contentOrder", fmt.Sprintf("%v", block.Fields["contentOrder"])),
				)
				continue
			}

			for _, blockID := range contentOrder {
				switch v := blockID.(type) {
				case []interface{}:
					for _, columnBlockID := range v {
						referenceIDs[columnBlockID.(string)] = true
					}
				case string:
					referenceIDs[v] = true
				default:
				}
			}
		}

		if _, ok := block.Fields["defaultTemplateId"]; ok {
			defaultTemplateID, typeOk := block.Fields["defaultTemplateId"].(string)
			if !typeOk {
				logger.Warn(
					"type assertion failed for default template ID when saving reference block IDs",
					mlog.String("blockID", block.ID),
					mlog.String("actionType", fmt.Sprintf("%T", block.Fields["defaultTemplateId"])),
					mlog.String("expectedType", "string"),
					mlog.String("defaultTemplateId", fmt.Sprintf("%v", block.Fields["defaultTemplateId"])),
				)
				continue
			}
			referenceIDs[defaultTemplateID] = true
		}
	}

	newIDs := map[string]string{}
	for id, blockType := range blockIDs {
		for referenceID := range referenceIDs {
			if id == referenceID {
				newIDs[id] = utils.NewID(BlockType2IDType(blockType))
				continue
			}
		}
	}

	getExistingOrOldID := func(id string) string {
		if existingID, ok := newIDs[id]; ok {
			return existingID
		}
		return id
	}

	getExistingOrNewID := func(id string) string {
		if existingID, ok := newIDs[id]; ok {
			return existingID
		}
		return utils.NewID(BlockType2IDType(blockIDs[id]))
	}

	newBlocks := make([]*Block, len(blocks))
	for i, block := range blocks {
		block.ID = getExistingOrNewID(block.ID)
		block.BoardID = getExistingOrOldID(block.BoardID)
		block.ParentID = getExistingOrOldID(block.ParentID)

		blockMod := block
		if _, ok := blockMod.Fields["contentOrder"]; ok {
			fixFieldIDs(blockMod, "contentOrder", getExistingOrOldID, logger)
		}

		if _, ok := blockMod.Fields["cardOrder"]; ok {
			fixFieldIDs(blockMod, "cardOrder", getExistingOrOldID, logger)
		}

		if _, ok := blockMod.Fields["defaultTemplateId"]; ok {
			defaultTemplateID, typeOk := blockMod.Fields["defaultTemplateId"].(string)
			if !typeOk {
				logger.Warn(
					"type assertion failed for default template ID when saving reference block IDs",
					mlog.String("blockID", blockMod.ID),
					mlog.String("actionType", fmt.Sprintf("%T", blockMod.Fields["defaultTemplateId"])),
					mlog.String("expectedType", "string"),
					mlog.String("defaultTemplateId", fmt.Sprintf("%v", blockMod.Fields["defaultTemplateId"])),
				)
			} else {
				blockMod.Fields["defaultTemplateId"] = getExistingOrOldID(defaultTemplateID)
			}
		}

		newBlocks[i] = blockMod
	}

	return newBlocks
}

func fixFieldIDs(block *Block, fieldName string, getExistingOrOldID func(string) string, logger mlog.LoggerIFace) {
	field, typeOk := block.Fields[fieldName].([]interface{})
	if !typeOk {
		logger.Warn(
			"type assertion failed for JSON field when setting new block IDs",
			mlog.String("blockID", block.ID),
			mlog.String("fieldName", fieldName),
			mlog.String("actionType", fmt.Sprintf("%T", block.Fields[fieldName])),
			mlog.String("expectedType", "[]interface{}"),
			mlog.String("value", fmt.Sprintf("%v", block.Fields[fieldName])),
		)
	} else {
		for j := range field {
			switch v := field[j].(type) {
			case string:
				field[j] = getExistingOrOldID(v)
			case []interface{}:
				subOrder := field[j].([]interface{})
				for k := range v {
					subOrder[k] = getExistingOrOldID(v[k].(string))
				}
			}
		}
	}
}
