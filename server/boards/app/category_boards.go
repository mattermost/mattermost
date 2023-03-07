// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
)

const defaultCategoryBoards = "Boards"

var errCategoryBoardsLengthMismatch = errors.New("cannot update category boards order, passed list of categories boards different size than in database")
var errBoardNotFoundInCategory = errors.New("specified board ID not found in specified category ID")
var errBoardMembershipNotFound = errors.New("board membership not found for user's board")

func (a *App) GetUserCategoryBoards(userID, teamID string) ([]model.CategoryBoards, error) {
	categoryBoards, err := a.store.GetUserCategoryBoards(userID, teamID)
	if err != nil {
		return nil, err
	}

	createdCategoryBoards, err := a.createDefaultCategoriesIfRequired(categoryBoards, userID, teamID)
	if err != nil {
		return nil, err
	}

	categoryBoards = append(categoryBoards, createdCategoryBoards...)
	return categoryBoards, nil
}

func (a *App) createDefaultCategoriesIfRequired(existingCategoryBoards []model.CategoryBoards, userID, teamID string) ([]model.CategoryBoards, error) {
	createdCategories := []model.CategoryBoards{}

	boardsCategoryExist := false
	for _, categoryBoard := range existingCategoryBoards {
		if categoryBoard.Name == defaultCategoryBoards {
			boardsCategoryExist = true
		}
	}

	if !boardsCategoryExist {
		createdCategoryBoards, err := a.createBoardsCategory(userID, teamID, existingCategoryBoards)
		if err != nil {
			return nil, err
		}

		createdCategories = append(createdCategories, *createdCategoryBoards)
	}

	return createdCategories, nil
}

func (a *App) createBoardsCategory(userID, teamID string, existingCategoryBoards []model.CategoryBoards) (*model.CategoryBoards, error) {
	// create the category
	category := model.Category{
		Name:      defaultCategoryBoards,
		UserID:    userID,
		TeamID:    teamID,
		Collapsed: false,
		Type:      model.CategoryTypeSystem,
		SortOrder: len(existingCategoryBoards) * model.CategoryBoardsSortOrderGap,
	}
	createdCategory, err := a.CreateCategory(&category)
	if err != nil {
		return nil, fmt.Errorf("createBoardsCategory default category creation failed: %w", err)
	}

	// once the category is created, we need to move all boards which do not
	// belong to any category, into this category.

	boardMembers, err := a.GetMembersForUser(userID)
	if err != nil {
		return nil, fmt.Errorf("createBoardsCategory error fetching user's board memberships: %w", err)
	}

	boardMemberByBoardID := map[string]*model.BoardMember{}
	for _, boardMember := range boardMembers {
		boardMemberByBoardID[boardMember.BoardID] = boardMember
	}

	createdCategoryBoards := &model.CategoryBoards{
		Category:      *createdCategory,
		BoardMetadata: []model.CategoryBoardMetadata{},
	}

	// get user's current team's baords
	userTeamBoards, err := a.GetBoardsForUserAndTeam(userID, teamID, false)
	if err != nil {
		return nil, fmt.Errorf("createBoardsCategory error fetching user's team's boards: %w", err)
	}

	boardIDsToAdd := []string{}

	for _, board := range userTeamBoards {
		boardMembership, ok := boardMemberByBoardID[board.ID]
		if !ok {
			return nil, fmt.Errorf("createBoardsCategory: %w", errBoardMembershipNotFound)
		}

		// boards with implicit access (aka synthetic membership),
		// should show up in LHS only when openign them explicitelly.
		// So we don't process any synthetic membership boards
		// and only add boards with explicit access to, to the the LHS,
		// for example, if a user explicitelly added another user to a board.
		if boardMembership.Synthetic {
			continue
		}

		belongsToCategory := false

		for _, categoryBoard := range existingCategoryBoards {
			for _, metadata := range categoryBoard.BoardMetadata {
				if metadata.BoardID == board.ID {
					belongsToCategory = true
					break
				}
			}

			// stop looking into other categories if
			// the board was found in a category
			if belongsToCategory {
				break
			}
		}

		if !belongsToCategory {
			boardIDsToAdd = append(boardIDsToAdd, board.ID)
			newBoardMetadata := model.CategoryBoardMetadata{
				BoardID: board.ID,
				Hidden:  false,
			}
			createdCategoryBoards.BoardMetadata = append(createdCategoryBoards.BoardMetadata, newBoardMetadata)
		}
	}

	if len(boardIDsToAdd) > 0 {
		if err := a.AddUpdateUserCategoryBoard(teamID, userID, createdCategory.ID, boardIDsToAdd); err != nil {
			return nil, fmt.Errorf("createBoardsCategory failed to add category-less board to the default category, defaultCategoryID: %s, error: %w", createdCategory.ID, err)
		}
	}

	return createdCategoryBoards, nil
}

func (a *App) AddUpdateUserCategoryBoard(teamID, userID, categoryID string, boardIDs []string) error {
	if len(boardIDs) == 0 {
		return nil
	}

	err := a.store.AddUpdateCategoryBoard(userID, categoryID, boardIDs)
	if err != nil {
		return err
	}

	userCategoryBoards, err := a.GetUserCategoryBoards(userID, teamID)
	if err != nil {
		return err
	}

	var updatedCategory *model.CategoryBoards
	for i := range userCategoryBoards {
		if userCategoryBoards[i].ID == categoryID {
			updatedCategory = &userCategoryBoards[i]
			break
		}
	}

	if updatedCategory == nil {
		return errCategoryNotFound
	}

	wsPayload := make([]*model.BoardCategoryWebsocketData, len(updatedCategory.BoardMetadata))
	i := 0
	for _, categoryBoardMetadata := range updatedCategory.BoardMetadata {
		wsPayload[i] = &model.BoardCategoryWebsocketData{
			BoardID:    categoryBoardMetadata.BoardID,
			CategoryID: categoryID,
			Hidden:     categoryBoardMetadata.Hidden,
		}
		i++
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastCategoryBoardChange(
			teamID,
			userID,
			wsPayload,
		)
		return nil
	})

	return nil
}

func (a *App) ReorderCategoryBoards(userID, teamID, categoryID string, newBoardsOrder []string) ([]string, error) {
	if err := a.verifyNewCategoryBoardsMatchExisting(userID, teamID, categoryID, newBoardsOrder); err != nil {
		return nil, err
	}

	newOrder, err := a.store.ReorderCategoryBoards(categoryID, newBoardsOrder)
	if err != nil {
		return nil, err
	}

	go func() {
		a.wsAdapter.BroadcastCategoryBoardsReorder(teamID, userID, categoryID, newOrder)
	}()

	return newOrder, nil
}

func (a *App) verifyNewCategoryBoardsMatchExisting(userID, teamID, categoryID string, newBoardsOrder []string) error {
	// this function is to ensure that we don't miss specifying
	// all boards of the category while reordering.
	existingCategoryBoards, err := a.GetUserCategoryBoards(userID, teamID)
	if err != nil {
		return err
	}

	var targetCategoryBoards *model.CategoryBoards
	for i := range existingCategoryBoards {
		if existingCategoryBoards[i].Category.ID == categoryID {
			targetCategoryBoards = &existingCategoryBoards[i]
			break
		}
	}

	if targetCategoryBoards == nil {
		return fmt.Errorf("%w categoryID: %s", errCategoryNotFound, categoryID)
	}

	if len(targetCategoryBoards.BoardMetadata) != len(newBoardsOrder) {
		return fmt.Errorf(
			"%w length new category boards: %d, length existing category boards: %d, userID: %s, teamID: %s, categoryID: %s",
			errCategoryBoardsLengthMismatch,
			len(newBoardsOrder),
			len(targetCategoryBoards.BoardMetadata),
			userID,
			teamID,
			categoryID,
		)
	}

	existingBoardMap := map[string]bool{}
	for _, metadata := range targetCategoryBoards.BoardMetadata {
		existingBoardMap[metadata.BoardID] = true
	}

	for _, boardID := range newBoardsOrder {
		if _, found := existingBoardMap[boardID]; !found {
			return fmt.Errorf(
				"%w board ID: %s, category ID: %s, userID: %s, teamID: %s",
				errBoardNotFoundInCategory,
				boardID,
				categoryID,
				userID,
				teamID,
			)
		}
	}

	return nil
}

func (a *App) SetBoardVisibility(teamID, userID, categoryID, boardID string, visible bool) error {
	if err := a.store.SetBoardVisibility(userID, categoryID, boardID, visible); err != nil {
		return fmt.Errorf("SetBoardVisibility: failed to update board visibility: %w", err)
	}

	a.wsAdapter.BroadcastCategoryBoardChange(teamID, userID, []*model.BoardCategoryWebsocketData{
		{
			BoardID:    boardID,
			CategoryID: categoryID,
			Hidden:     !visible,
		},
	})

	return nil
}
