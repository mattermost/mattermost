// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

func (a *App) MoveContentBlock(block *model.Block, dstBlock *model.Block, where string, userID string) error {
	if block.ParentID != dstBlock.ParentID {
		message := fmt.Sprintf("not matching parent %s and %s", block.ParentID, dstBlock.ParentID)
		return model.NewErrBadRequest(message)
	}

	card, err := a.GetBlockByID(block.ParentID)
	if err != nil {
		return err
	}

	contentOrderData, ok := card.Fields["contentOrder"]
	var contentOrder []interface{}
	if ok {
		contentOrder = contentOrderData.([]interface{})
	}

	newContentOrder := []interface{}{}
	foundDst := false
	foundSrc := false
	for _, id := range contentOrder {
		stringID, ok := id.(string)
		if !ok {
			newContentOrder = append(newContentOrder, id)
			continue
		}

		if dstBlock.ID == stringID {
			foundDst = true
			if where == "after" {
				newContentOrder = append(newContentOrder, id)
				newContentOrder = append(newContentOrder, block.ID)
			} else {
				newContentOrder = append(newContentOrder, block.ID)
				newContentOrder = append(newContentOrder, id)
			}
			continue
		}

		if block.ID == stringID {
			foundSrc = true
			continue
		}

		newContentOrder = append(newContentOrder, id)
	}

	if !foundSrc {
		message := fmt.Sprintf("source block %s not found", block.ID)
		return model.NewErrBadRequest(message)
	}

	if !foundDst {
		message := fmt.Sprintf("destination block %s not found", dstBlock.ID)
		return model.NewErrBadRequest(message)
	}

	patch := &model.BlockPatch{
		UpdatedFields: map[string]interface{}{
			"contentOrder": newContentOrder,
		},
	}

	_, err = a.PatchBlock(block.ParentID, patch, userID)
	if errors.Is(err, model.ErrPatchUpdatesLimitedCards) {
		return err
	}
	if err != nil {
		return err
	}
	return nil
}
