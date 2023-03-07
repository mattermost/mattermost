// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

var (
	ErrNewBoardCannotHaveID = errors.New("new board cannot have an ID")
)

const linkBoardMessage = "@%s linked the board [%s](%s) with this channel"
const unlinkBoardMessage = "@%s unlinked the board [%s](%s) with this channel"

var errNoDefaultCategoryFound = errors.New("no default category found for user")

func (a *App) GetBoard(boardID string) (*model.Board, error) {
	board, err := a.store.GetBoard(boardID)
	if err != nil {
		return nil, err
	}
	return board, nil
}

func (a *App) GetBoardCount() (int64, error) {
	return a.store.GetBoardCount()
}

func (a *App) GetBoardMetadata(boardID string) (*model.Board, *model.BoardMetadata, error) {
	license := a.store.GetLicense()
	if license == nil || !(*license.Features.Compliance) {
		return nil, nil, model.ErrInsufficientLicense
	}

	board, err := a.GetBoard(boardID)
	if model.IsErrNotFound(err) {
		// Board may have been deleted, retrieve most recent history instead
		board, err = a.getBoardHistory(boardID, true)
		if err != nil {
			return nil, nil, err
		}
	}
	if err != nil {
		return nil, nil, err
	}

	earliestTime, _, err := a.getBoardDescendantModifiedInfo(boardID, false)
	if err != nil {
		return nil, nil, err
	}

	latestTime, lastModifiedBy, err := a.getBoardDescendantModifiedInfo(boardID, true)
	if err != nil {
		return nil, nil, err
	}

	boardMetadata := model.BoardMetadata{
		BoardID:                 boardID,
		DescendantFirstUpdateAt: earliestTime,
		DescendantLastUpdateAt:  latestTime,
		CreatedBy:               board.CreatedBy,
		LastModifiedBy:          lastModifiedBy,
	}
	return board, &boardMetadata, nil
}

// getBoardForBlock returns the board that owns the specified block.
func (a *App) getBoardForBlock(blockID string) (*model.Board, error) {
	block, err := a.GetBlockByID(blockID)
	if err != nil {
		return nil, fmt.Errorf("cannot get block %s: %w", blockID, err)
	}

	board, err := a.GetBoard(block.BoardID)
	if err != nil {
		return nil, fmt.Errorf("cannot get board %s: %w", block.BoardID, err)
	}

	return board, nil
}

func (a *App) getBoardHistory(boardID string, latest bool) (*model.Board, error) {
	opts := model.QueryBoardHistoryOptions{
		Limit:      1,
		Descending: latest,
	}
	boards, err := a.store.GetBoardHistory(boardID, opts)
	if err != nil {
		return nil, fmt.Errorf("could not get history for board: %w", err)
	}
	if len(boards) == 0 {
		return nil, nil
	}

	return boards[0], nil
}

func (a *App) getBoardDescendantModifiedInfo(boardID string, latest bool) (int64, string, error) {
	board, err := a.getBoardHistory(boardID, latest)
	if err != nil {
		return 0, "", err
	}
	if board == nil {
		return 0, "", fmt.Errorf("history not found for board: %w", err)
	}

	var timestamp int64
	modifiedBy := board.ModifiedBy
	if latest {
		timestamp = board.UpdateAt
	} else {
		timestamp = board.CreateAt
	}

	// use block_history to fetch blocks in case they were deleted and no longer exist in blocks table.
	opts := model.QueryBlockHistoryOptions{
		Limit:      1,
		Descending: latest,
	}
	blocks, err := a.store.GetBlockHistoryDescendants(boardID, opts)
	if err != nil {
		return 0, "", fmt.Errorf("could not get blocks history descendants for board: %w", err)
	}
	if len(blocks) > 0 {
		// Compare the board history info with the descendant block info, if it exists
		block := blocks[0]
		if latest && block.UpdateAt > timestamp {
			timestamp = block.UpdateAt
			modifiedBy = block.ModifiedBy
		} else if !latest && block.CreateAt < timestamp {
			timestamp = block.CreateAt
			modifiedBy = block.ModifiedBy
		}
	}
	return timestamp, modifiedBy, nil
}

func (a *App) setBoardCategoryFromSource(sourceBoardID, destinationBoardID, userID, teamID string, asTemplate bool) error {
	// find source board's category ID for the user
	userCategoryBoards, err := a.GetUserCategoryBoards(userID, teamID)
	if err != nil {
		return err
	}

	var destinationCategoryID string

	for _, categoryBoard := range userCategoryBoards {
		for _, metadata := range categoryBoard.BoardMetadata {
			if metadata.BoardID == sourceBoardID {
				// category found!
				destinationCategoryID = categoryBoard.ID
				break
			}
		}
	}

	if destinationCategoryID == "" {
		// if source board is not mapped to a category for this user,
		// then move new board to default category
		if !asTemplate {
			return a.addBoardsToDefaultCategory(userID, teamID, []*model.Board{{ID: destinationBoardID}})
		}
		return nil
	}

	// now that we have source board's category,
	// we send destination board to the same category
	return a.AddUpdateUserCategoryBoard(teamID, userID, destinationCategoryID, []string{destinationBoardID})
}

func (a *App) DuplicateBoard(boardID, userID, toTeam string, asTemplate bool) (*model.BoardsAndBlocks, []*model.BoardMember, error) {
	bab, members, err := a.store.DuplicateBoard(boardID, userID, toTeam, asTemplate)
	if err != nil {
		return nil, nil, err
	}

	// copy any file attachments from the duplicated blocks.
	if err = a.CopyCardFiles(boardID, bab.Blocks); err != nil {
		a.logger.Error("Could not copy files while duplicating board", mlog.String("BoardID", boardID), mlog.Err(err))
	}

	if !asTemplate {
		for _, board := range bab.Boards {
			if categoryErr := a.setBoardCategoryFromSource(boardID, board.ID, userID, toTeam, asTemplate); categoryErr != nil {
				return nil, nil, categoryErr
			}
		}
	}

	// bab.Blocks now has updated file ids for any blocks containing files.  We need to store them.
	blockIDs := make([]string, 0)
	blockPatches := make([]model.BlockPatch, 0)

	for _, block := range bab.Blocks {
		fieldName := ""
		if block.Type == model.TypeImage {
			fieldName = "fileId"
		} else if block.Type == model.TypeAttachment {
			fieldName = "attachmentId"
		}
		if fieldName != "" {
			if fieldID, ok := block.Fields[fieldName]; ok {
				blockIDs = append(blockIDs, block.ID)
				blockPatches = append(blockPatches, model.BlockPatch{
					UpdatedFields: map[string]interface{}{
						fieldName: fieldID,
					},
				})
			}
		}
	}
	a.logger.Debug("Duplicate boards patching file IDs", mlog.Int("count", len(blockIDs)))

	if len(blockIDs) != 0 {
		patches := &model.BlockPatchBatch{
			BlockIDs:     blockIDs,
			BlockPatches: blockPatches,
		}
		if err = a.store.PatchBlocks(patches, userID); err != nil {
			dbab := model.NewDeleteBoardsAndBlocksFromBabs(bab)
			if err = a.store.DeleteBoardsAndBlocks(dbab, userID); err != nil {
				a.logger.Error("Cannot delete board after duplication error when updating block's file info", mlog.String("boardID", bab.Boards[0].ID), mlog.Err(err))
			}
			return nil, nil, fmt.Errorf("could not patch file IDs while duplicating board %s: %w", boardID, err)
		}
	}

	a.blockChangeNotifier.Enqueue(func() error {
		teamID := ""
		for _, board := range bab.Boards {
			teamID = board.TeamID
			a.wsAdapter.BroadcastBoardChange(teamID, board)
		}
		for _, block := range bab.Blocks {
			blk := block
			a.wsAdapter.BroadcastBlockChange(teamID, blk)
			a.notifyBlockChanged(notify.Add, blk, nil, userID)
		}
		for _, member := range members {
			a.wsAdapter.BroadcastMemberChange(teamID, member.BoardID, member)
		}
		return nil
	})

	if len(bab.Blocks) != 0 {
		go func() {
			if uErr := a.UpdateCardLimitTimestamp(); uErr != nil {
				a.logger.Error(
					"UpdateCardLimitTimestamp failed after duplicating a board",
					mlog.Err(uErr),
				)
			}
		}()
	}

	return bab, members, err
}

func (a *App) GetBoardsForUserAndTeam(userID, teamID string, includePublicBoards bool) ([]*model.Board, error) {
	return a.store.GetBoardsForUserAndTeam(userID, teamID, includePublicBoards)
}

func (a *App) GetTemplateBoards(teamID, userID string) ([]*model.Board, error) {
	return a.store.GetTemplateBoards(teamID, userID)
}

func (a *App) CreateBoard(board *model.Board, userID string, addMember bool) (*model.Board, error) {
	if board.ID != "" {
		return nil, ErrNewBoardCannotHaveID
	}
	board.ID = utils.NewID(utils.IDTypeBoard)

	var newBoard *model.Board
	var member *model.BoardMember
	var err error
	if addMember {
		newBoard, member, err = a.store.InsertBoardWithAdmin(board, userID)
	} else {
		newBoard, err = a.store.InsertBoard(board, userID)
	}

	if err != nil {
		return nil, err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastBoardChange(newBoard.TeamID, newBoard)

		if newBoard.ChannelID != "" {
			members, err := a.GetMembersForBoard(board.ID)
			if err != nil {
				a.logger.Error("Unable to get the board members", mlog.Err(err))
			}
			for _, member := range members {
				a.wsAdapter.BroadcastMemberChange(newBoard.TeamID, member.BoardID, member)
			}
		} else if addMember {
			a.wsAdapter.BroadcastMemberChange(newBoard.TeamID, newBoard.ID, member)
		}
		return nil
	})

	if !board.IsTemplate {
		if err := a.addBoardsToDefaultCategory(userID, newBoard.TeamID, []*model.Board{newBoard}); err != nil {
			return nil, err
		}
	}

	return newBoard, nil
}

func (a *App) addBoardsToDefaultCategory(userID, teamID string, boards []*model.Board) error {
	userCategoryBoards, err := a.GetUserCategoryBoards(userID, teamID)
	if err != nil {
		return err
	}

	defaultCategoryID := ""
	for _, categoryBoard := range userCategoryBoards {
		if categoryBoard.Name == defaultCategoryBoards {
			defaultCategoryID = categoryBoard.ID
			break
		}
	}

	if defaultCategoryID == "" {
		return fmt.Errorf("%w userID: %s", errNoDefaultCategoryFound, userID)
	}

	boardIDs := make([]string, len(boards))
	for i := range boards {
		boardIDs[i] = boards[i].ID
	}

	if err := a.AddUpdateUserCategoryBoard(teamID, userID, defaultCategoryID, boardIDs); err != nil {
		return err
	}

	return nil
}

func (a *App) PatchBoard(patch *model.BoardPatch, boardID, userID string) (*model.Board, error) {
	var oldChannelID string
	var isTemplate bool
	var oldMembers []*model.BoardMember

	if patch.Type != nil || patch.ChannelID != nil {
		if patch.ChannelID != nil && *patch.ChannelID == "" {
			var err error
			oldMembers, err = a.GetMembersForBoard(boardID)
			if err != nil {
				a.logger.Error("Unable to get the board members", mlog.Err(err))
			}
		}

		board, err := a.store.GetBoard(boardID)
		if model.IsErrNotFound(err) {
			return nil, model.NewErrNotFound("board ID=" + boardID)
		}
		if err != nil {
			return nil, err
		}
		oldChannelID = board.ChannelID
		isTemplate = board.IsTemplate
	}
	updatedBoard, err := a.store.PatchBoard(boardID, patch, userID)
	if err != nil {
		return nil, err
	}

	// Post message to channel if linked/unlinked
	if patch.ChannelID != nil {
		var username string

		user, err := a.store.GetUserByID(userID)
		if err != nil {
			a.logger.Error("Unable to get the board updater", mlog.Err(err))
			username = "unknown"
		} else {
			username = user.Username
		}

		boardLink := utils.MakeBoardLink(a.config.ServerRoot, updatedBoard.TeamID, updatedBoard.ID)
		title := updatedBoard.Title
		if title == "" {
			title = "Untitled board" // todo: localize this when server has i18n
		}
		if *patch.ChannelID != "" {
			a.postChannelMessage(fmt.Sprintf(linkBoardMessage, username, title, boardLink), updatedBoard.ChannelID)
		} else if *patch.ChannelID == "" {
			a.postChannelMessage(fmt.Sprintf(unlinkBoardMessage, username, title, boardLink), oldChannelID)
		}
	}

	// Broadcast Messages to affected users
	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastBoardChange(updatedBoard.TeamID, updatedBoard)

		if patch.ChannelID != nil {
			if *patch.ChannelID != "" {
				members, err := a.GetMembersForBoard(updatedBoard.ID)
				if err != nil {
					a.logger.Error("Unable to get the board members", mlog.Err(err))
				}
				for _, member := range members {
					if member.Synthetic {
						a.wsAdapter.BroadcastMemberChange(updatedBoard.TeamID, member.BoardID, member)
					}
				}
			} else {
				for _, oldMember := range oldMembers {
					if oldMember.Synthetic {
						a.wsAdapter.BroadcastMemberDelete(updatedBoard.TeamID, boardID, oldMember.UserID)
					}
				}
			}
		}

		if patch.Type != nil && isTemplate {
			members, err := a.GetMembersForBoard(updatedBoard.ID)
			if err != nil {
				a.logger.Error("Unable to get the board members", mlog.Err(err))
			}
			a.broadcastTeamUsers(updatedBoard.TeamID, updatedBoard.ID, *patch.Type, members)
		}
		return nil
	})

	return updatedBoard, nil
}

func (a *App) postChannelMessage(message, channelID string) {
	err := a.store.PostMessage(message, "", channelID)
	if err != nil {
		a.logger.Error("Unable to post the link message to channel", mlog.Err(err))
	}
}

// broadcastTeamUsers notifies the members of a team when a template changes its type
// from public to private or viceversa.
func (a *App) broadcastTeamUsers(teamID, boardID string, boardType model.BoardType, members []*model.BoardMember) {
	users, err := a.GetTeamUsers(teamID, "")
	if err != nil {
		a.logger.Error("Unable to get the team users", mlog.Err(err))
	}
	for _, user := range users {
		isMember := false
		for _, member := range members {
			if member.UserID == user.ID {
				isMember = true
				break
			}
		}
		if !isMember {
			if boardType == model.BoardTypePrivate {
				a.wsAdapter.BroadcastMemberDelete(teamID, boardID, user.ID)
			} else if boardType == model.BoardTypeOpen {
				a.wsAdapter.BroadcastMemberChange(teamID, boardID, &model.BoardMember{UserID: user.ID, BoardID: boardID, SchemeViewer: true, Synthetic: true})
			}
		}
	}
}

func (a *App) DeleteBoard(boardID, userID string) error {
	board, err := a.store.GetBoard(boardID)
	if model.IsErrNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}

	if err := a.store.DeleteBoard(boardID, userID); err != nil {
		return err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastBoardDelete(board.TeamID, boardID)
		return nil
	})

	go func() {
		if err := a.UpdateCardLimitTimestamp(); err != nil {
			a.logger.Error(
				"UpdateCardLimitTimestamp failed after deleting a board",
				mlog.Err(err),
			)
		}
	}()

	return nil
}

func (a *App) GetMembersForBoard(boardID string) ([]*model.BoardMember, error) {
	members, err := a.store.GetMembersForBoard(boardID)
	if err != nil {
		return nil, err
	}

	board, err := a.store.GetBoard(boardID)
	if err != nil && !model.IsErrNotFound(err) {
		return nil, err
	}
	if board != nil {
		for i, m := range members {
			if !m.SchemeAdmin {
				if a.permissions.HasPermissionToTeam(m.UserID, board.TeamID, model.PermissionManageTeam) {
					members[i].SchemeAdmin = true
				}
			}
		}
	}
	return members, nil
}

func (a *App) GetMembersForUser(userID string) ([]*model.BoardMember, error) {
	members, err := a.store.GetMembersForUser(userID)
	if err != nil {
		return nil, err
	}

	for i, m := range members {
		if !m.SchemeAdmin {
			board, err := a.store.GetBoard(m.BoardID)
			if err != nil && !model.IsErrNotFound(err) {
				return nil, err
			}
			if board != nil {
				if a.permissions.HasPermissionToTeam(m.UserID, board.TeamID, model.PermissionManageTeam) {
					// if system/team admin
					members[i].SchemeAdmin = true
				}
			}
		}
	}
	return members, nil
}

func (a *App) GetMemberForBoard(boardID string, userID string) (*model.BoardMember, error) {
	return a.store.GetMemberForBoard(boardID, userID)
}

func (a *App) AddMemberToBoard(member *model.BoardMember) (*model.BoardMember, error) {
	board, err := a.store.GetBoard(member.BoardID)
	if model.IsErrNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	existingMembership, err := a.store.GetMemberForBoard(member.BoardID, member.UserID)
	if err != nil && !model.IsErrNotFound(err) {
		return nil, err
	}

	if existingMembership != nil && !existingMembership.Synthetic {
		return existingMembership, nil
	}

	newMember, err := a.store.SaveMember(member)
	if err != nil {
		return nil, err
	}

	if !newMember.SchemeAdmin {
		if board != nil {
			if a.permissions.HasPermissionToTeam(newMember.UserID, board.TeamID, model.PermissionManageTeam) {
				newMember.SchemeAdmin = true
			}
		}
	}

	if !board.IsTemplate {
		if err = a.addBoardsToDefaultCategory(member.UserID, board.TeamID, []*model.Board{board}); err != nil {
			return nil, err
		}
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastMemberChange(board.TeamID, member.BoardID, member)
		return nil
	})

	return newMember, nil
}

func (a *App) UpdateBoardMember(member *model.BoardMember) (*model.BoardMember, error) {
	board, bErr := a.store.GetBoard(member.BoardID)
	if model.IsErrNotFound(bErr) {
		return nil, nil
	}
	if bErr != nil {
		return nil, bErr
	}

	oldMember, err := a.store.GetMemberForBoard(member.BoardID, member.UserID)
	if model.IsErrNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// if we're updating an admin, we need to check that there is at
	// least still another admin on the board
	if oldMember.SchemeAdmin && !member.SchemeAdmin {
		isLastAdmin, err2 := a.isLastAdmin(member.UserID, member.BoardID)
		if err2 != nil {
			return nil, err2
		}
		if isLastAdmin {
			return nil, model.ErrBoardMemberIsLastAdmin
		}
	}

	newMember, err := a.store.SaveMember(member)
	if err != nil {
		return nil, err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastMemberChange(board.TeamID, member.BoardID, member)
		return nil
	})

	return newMember, nil
}

func (a *App) isLastAdmin(userID, boardID string) (bool, error) {
	members, err := a.store.GetMembersForBoard(boardID)
	if err != nil {
		return false, err
	}

	for _, m := range members {
		if m.SchemeAdmin && m.UserID != userID {
			return false, nil
		}
	}
	return true, nil
}

func (a *App) DeleteBoardMember(boardID, userID string) error {
	board, bErr := a.store.GetBoard(boardID)
	if model.IsErrNotFound(bErr) {
		return nil
	}
	if bErr != nil {
		return bErr
	}

	oldMember, err := a.store.GetMemberForBoard(boardID, userID)
	if model.IsErrNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}

	// if we're removing an admin, we need to check that there is at
	// least still another admin on the board
	if oldMember.SchemeAdmin {
		isLastAdmin, err := a.isLastAdmin(userID, boardID)
		if err != nil {
			return err
		}
		if isLastAdmin {
			return model.ErrBoardMemberIsLastAdmin
		}
	}

	if err := a.store.DeleteMember(boardID, userID); err != nil {
		return err
	}

	a.blockChangeNotifier.Enqueue(func() error {
		if syntheticMember, _ := a.GetMemberForBoard(boardID, userID); syntheticMember != nil {
			a.wsAdapter.BroadcastMemberChange(board.TeamID, boardID, syntheticMember)
		} else {
			a.wsAdapter.BroadcastMemberDelete(board.TeamID, boardID, userID)
		}
		return nil
	})

	return nil
}

func (a *App) SearchBoardsForUser(term string, searchField model.BoardSearchField, userID string, includePublicBoards bool) ([]*model.Board, error) {
	return a.store.SearchBoardsForUser(term, searchField, userID, includePublicBoards)
}

func (a *App) SearchBoardsForUserInTeam(teamID, term, userID string) ([]*model.Board, error) {
	return a.store.SearchBoardsForUserInTeam(teamID, term, userID)
}

func (a *App) UndeleteBoard(boardID string, modifiedBy string) error {
	boards, err := a.store.GetBoardHistory(boardID, model.QueryBoardHistoryOptions{Limit: 1, Descending: true})
	if err != nil {
		return err
	}

	if len(boards) == 0 {
		// undeleting non-existing board not considered an error
		return nil
	}

	err = a.store.UndeleteBoard(boardID, modifiedBy)
	if err != nil {
		return err
	}

	board, err := a.store.GetBoard(boardID)
	if err != nil {
		return err
	}

	if board == nil {
		a.logger.Error("Error loading the board after undelete, not propagating through websockets or notifications")
		return nil
	}

	a.blockChangeNotifier.Enqueue(func() error {
		a.wsAdapter.BroadcastBoardChange(board.TeamID, board)
		return nil
	})

	go func() {
		if err := a.UpdateCardLimitTimestamp(); err != nil {
			a.logger.Error(
				"UpdateCardLimitTimestamp failed after undeleting a board",
				mlog.Err(err),
			)
		}
	}()

	return nil
}
