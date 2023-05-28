// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

var ErrNilPluginAPI = errors.New("server not running in plugin mode")

// GetBoardsCloudLimits returns the limits of the server, and an empty
// limits struct if there are no limits set.
func (a *App) GetBoardsCloudLimits() (*model.BoardsCloudLimits, error) {
	// ToDo: Cloud Limits have been disabled by design. We should
	// revisit the decision and update the related code accordingly
	/*
		if !a.IsCloud() {
			return &model.BoardsCloudLimits{}, nil
		}

		productLimits, err := a.store.GetCloudLimits()
		if err != nil {
			return nil, err
		}

		usedCards, err := a.store.GetUsedCardsCount()
		if err != nil {
			return nil, err
		}

		cardLimitTimestamp, err := a.store.GetCardLimitTimestamp()
		if err != nil {
			return nil, err
		}

		boardsCloudLimits := &model.BoardsCloudLimits{
			UsedCards:          usedCards,
			CardLimitTimestamp: cardLimitTimestamp,
		}
		if productLimits != nil && productLimits.Boards != nil {
			if productLimits.Boards.Cards != nil {
				boardsCloudLimits.Cards = *productLimits.Boards.Cards
			}
			if productLimits.Boards.Views != nil {
				boardsCloudLimits.Views = *productLimits.Boards.Views
			}
		}

		return boardsCloudLimits, nil
	*/

	return &model.BoardsCloudLimits{}, nil
}

func (a *App) GetUsedCardsCount() (int, error) {
	return a.store.GetUsedCardsCount()
}

// IsCloud returns true if the server is running as a plugin in a
// cloud licensed server.
func (a *App) IsCloud() bool {
	return utils.IsCloudLicense(a.store.GetLicense())
}

// IsCloudLimited returns true if the server is running in cloud mode
// and the card limit has been set.
func (a *App) IsCloudLimited() bool {
	// ToDo: Cloud Limits have been disabled by design. We should
	// revisit the decision and update the related code accordingly

	// return a.CardLimit() != 0 && a.IsCloud()

	return false
}

// SetCloudLimits sets the limits of the server.
func (a *App) SetCloudLimits(limits *mm_model.ProductLimits) error {
	oldCardLimit := a.CardLimit()

	// if the limit object doesn't come complete, we assume limits are
	// being disabled
	cardLimit := 0
	if limits != nil && limits.Boards != nil && limits.Boards.Cards != nil {
		cardLimit = *limits.Boards.Cards
	}

	if oldCardLimit != cardLimit {
		a.logger.Info(
			"setting new cloud limits",
			mlog.Int("oldCardLimit", oldCardLimit),
			mlog.Int("cardLimit", cardLimit),
		)
		a.SetCardLimit(cardLimit)
		return a.doUpdateCardLimitTimestamp()
	}

	a.logger.Info(
		"setting new cloud limits, equivalent to the existing ones",
		mlog.Int("cardLimit", cardLimit),
	)
	return nil
}

// doUpdateCardLimitTimestamp performs the update without running any
// checks.
func (a *App) doUpdateCardLimitTimestamp() error {
	cardLimitTimestamp, err := a.store.UpdateCardLimitTimestamp(a.CardLimit())
	if err != nil {
		return err
	}

	a.wsAdapter.BroadcastCardLimitTimestampChange(cardLimitTimestamp)

	return nil
}

// UpdateCardLimitTimestamp checks if the server is a cloud instance
// with limits applied, and if that's true, recalculates the card
// limit timestamp and propagates the new one to the connected
// clients.
func (a *App) UpdateCardLimitTimestamp() error {
	if !a.IsCloudLimited() {
		return nil
	}

	return a.doUpdateCardLimitTimestamp()
}

// getTemplateMapForBlocks gets all board ids for the blocks, and
// builds a map with the board IDs as the key and their isTemplate
// field as the value.
func (a *App) getTemplateMapForBlocks(blocks []*model.Block) (map[string]bool, error) {
	boardMap := map[string]*model.Board{}
	for _, block := range blocks {
		if _, ok := boardMap[block.BoardID]; !ok {
			board, err := a.store.GetBoard(block.BoardID)
			if err != nil {
				return nil, err
			}
			boardMap[block.BoardID] = board
		}
	}

	templateMap := map[string]bool{}
	for boardID, board := range boardMap {
		templateMap[boardID] = board.IsTemplate
	}

	return templateMap, nil
}

// ApplyCloudLimits takes a set of blocks and, if the server is cloud
// limited, limits those that are outside of the card limit and don't
// belong to a template.
func (a *App) ApplyCloudLimits(blocks []*model.Block) ([]*model.Block, error) {
	// if there is no limit currently being applied, return
	if !a.IsCloudLimited() {
		return blocks, nil
	}

	cardLimitTimestamp, err := a.store.GetCardLimitTimestamp()
	if err != nil {
		return nil, err
	}

	templateMap, err := a.getTemplateMapForBlocks(blocks)
	if err != nil {
		return nil, err
	}

	limitedBlocks := make([]*model.Block, len(blocks))
	for i, block := range blocks {
		// if the block belongs to a template, it will never be
		// limited
		if isTemplate, ok := templateMap[block.BoardID]; ok && isTemplate {
			limitedBlocks[i] = block
			continue
		}

		if block.ShouldBeLimited(cardLimitTimestamp) {
			limitedBlocks[i] = block.GetLimited()
		} else {
			limitedBlocks[i] = block
		}
	}

	return limitedBlocks, nil
}

// ContainsLimitedBlocks checks if a list of blocks contain any block
// that references a limited card.
func (a *App) ContainsLimitedBlocks(blocks []*model.Block) (bool, error) {
	cardLimitTimestamp, err := a.store.GetCardLimitTimestamp()
	if err != nil {
		return false, err
	}

	if cardLimitTimestamp == 0 {
		return false, nil
	}

	cards := []*model.Block{}
	cardIDMap := map[string]bool{}
	for _, block := range blocks {
		switch block.Type {
		case model.TypeCard:
			cards = append(cards, block)
		default:
			cardIDMap[block.ParentID] = true
		}
	}

	cardIDs := []string{}
	// if the card is already present on the set, we don't need to
	// fetch it from the database
	for cardID := range cardIDMap {
		alreadyPresent := false
		for _, card := range cards {
			if card.ID == cardID {
				alreadyPresent = true
				break
			}
		}

		if !alreadyPresent {
			cardIDs = append(cardIDs, cardID)
		}
	}

	if len(cardIDs) > 0 {
		fetchedCards, fErr := a.store.GetBlocksByIDs(cardIDs)
		if fErr != nil {
			return false, fErr
		}
		cards = append(cards, fetchedCards...)
	}

	templateMap, err := a.getTemplateMapForBlocks(cards)
	if err != nil {
		return false, err
	}

	for _, card := range cards {
		isTemplate, ok := templateMap[card.BoardID]
		if !ok {
			return false, newErrBoardNotFoundInTemplateMap(card.BoardID)
		}

		// if the block belongs to a template, it will never be
		// limited
		if isTemplate {
			continue
		}

		if card.ShouldBeLimited(cardLimitTimestamp) {
			return true, nil
		}
	}

	return false, nil
}

type errBoardNotFoundInTemplateMap struct {
	id string
}

func newErrBoardNotFoundInTemplateMap(id string) *errBoardNotFoundInTemplateMap {
	return &errBoardNotFoundInTemplateMap{id}
}

func (eb *errBoardNotFoundInTemplateMap) Error() string {
	return fmt.Sprintf("board %q not found in template map", eb.id)
}

func (a *App) NotifyPortalAdminsUpgradeRequest(teamID string) error {
	if a.servicesAPI == nil {
		return ErrNilPluginAPI
	}

	team, err := a.store.GetTeam(teamID)
	if err != nil {
		return err
	}

	var ofWhat string
	if team == nil {
		ofWhat = "your organization"
	} else {
		ofWhat = team.Title
	}

	message := fmt.Sprintf("A member of %s has notified you to upgrade this workspace before the trial ends.", ofWhat)

	page := 0
	getUsersOptions := &mm_model.UserGetOptions{
		Active:  true,
		Role:    mm_model.SystemAdminRoleId,
		PerPage: 50,
		Page:    page,
	}

	for ; true; page++ {
		getUsersOptions.Page = page
		systemAdmins, appErr := a.servicesAPI.GetUsersFromProfiles(getUsersOptions)
		if appErr != nil {
			a.logger.Error("failed to fetch system admins", mlog.Int("page_size", getUsersOptions.PerPage), mlog.Int("page", page), mlog.Err(appErr))
			return appErr
		}

		if len(systemAdmins) == 0 {
			break
		}

		receiptUserIDs := []string{}
		for _, systemAdmin := range systemAdmins {
			receiptUserIDs = append(receiptUserIDs, systemAdmin.Id)
		}

		if err := a.store.SendMessage(message, "custom_cloud_upgrade_nudge", receiptUserIDs); err != nil {
			return err
		}
	}

	return nil
}
