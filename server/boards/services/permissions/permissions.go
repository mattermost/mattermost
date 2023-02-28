//go:generate mockgen -destination=mocks/mockstore.go -package mocks . Store
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package permissions

import (
	"github.com/mattermost/mattermost-server/v6/boards/model"

	mmModel "github.com/mattermost/mattermost-server/v6/model"
)

type PermissionsService interface {
	HasPermissionTo(userID string, permission *mmModel.Permission) bool
	HasPermissionToTeam(userID, teamID string, permission *mmModel.Permission) bool
	HasPermissionToChannel(userID, channelID string, permission *mmModel.Permission) bool
	HasPermissionToBoard(userID, boardID string, permission *mmModel.Permission) bool
}

type Store interface {
	GetBoard(boardID string) (*model.Board, error)
	GetMemberForBoard(boardID, userID string) (*model.BoardMember, error)
	GetBoardHistory(boardID string, opts model.QueryBoardHistoryOptions) ([]*model.Board, error)
}
