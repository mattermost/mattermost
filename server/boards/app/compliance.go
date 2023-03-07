// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/server/v7/boards/model"

func (a *App) GetBoardsForCompliance(opts model.QueryBoardsForComplianceOptions) ([]*model.Board, bool, error) {
	return a.store.GetBoardsForCompliance(opts)
}

func (a *App) GetBoardsComplianceHistory(opts model.QueryBoardsComplianceHistoryOptions) ([]*model.BoardHistory, bool, error) {
	return a.store.GetBoardsComplianceHistory(opts)
}

func (a *App) GetBlocksComplianceHistory(opts model.QueryBlocksComplianceHistoryOptions) ([]*model.BlockHistory, bool, error) {
	return a.store.GetBlocksComplianceHistory(opts)
}
