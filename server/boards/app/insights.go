// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/model"
)

func (a *App) GetTeamBoardsInsights(userID string, teamID string, opts *mm_model.InsightsOpts) (*model.BoardInsightsList, error) {
	// check if server is properly licensed, and user is not a guest
	userPermitted, err := insightPermissionGate(a, userID, false)
	if err != nil {
		return nil, err
	}
	if !userPermitted {
		return nil, errors.New("User isn't authorized to access insights.")
	}
	boardIDs, err := getUserBoards(userID, teamID, a)
	if err != nil {
		return nil, err
	}
	return a.store.GetTeamBoardsInsights(teamID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage, boardIDs)
}

func (a *App) GetUserBoardsInsights(userID string, teamID string, opts *mm_model.InsightsOpts) (*model.BoardInsightsList, error) {
	// check if server is properly licensed, and user is not a guest
	userPermitted, err := insightPermissionGate(a, userID, true)
	if err != nil {
		return nil, err
	}
	if !userPermitted {
		return nil, errors.New("User isn't authorized to access insights.")
	}
	boardIDs, err := getUserBoards(userID, teamID, a)
	if err != nil {
		return nil, err
	}
	return a.store.GetUserBoardsInsights(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage, boardIDs)
}

func insightPermissionGate(a *App, userID string, isMyInsights bool) (bool, error) {
	licenseError := errors.New("invalid license/authorization to use insights API")
	guestError := errors.New("guests aren't authorized to use insights API")
	lic := a.store.GetLicense()

	user, err := a.store.GetUserByID(userID)
	if err != nil {
		return false, err
	}

	if user.IsGuest {
		return false, guestError
	}

	if lic == nil && !isMyInsights {
		a.logger.Debug("Deployment doesn't have a license")
		return false, licenseError
	}

	if !isMyInsights && (lic.SkuShortName != mm_model.LicenseShortSkuProfessional && lic.SkuShortName != mm_model.LicenseShortSkuEnterprise) {
		return false, licenseError
	}

	return true, nil
}

func (a *App) GetUserTimezone(userID string) (string, error) {
	return a.store.GetUserTimezone(userID)
}

func getUserBoards(userID string, teamID string, a *App) ([]string, error) {
	// get boards accessible by user and filter boardIDs
	boards, err := a.store.GetBoardsForUserAndTeam(userID, teamID, true)
	if err != nil {
		return nil, errors.New("error getting boards for user")
	}
	boardIDs := make([]string, 0, len(boards))

	for _, board := range boards {
		boardIDs = append(boardIDs, board.ID)
	}
	return boardIDs, nil
}
