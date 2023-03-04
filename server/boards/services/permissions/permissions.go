// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -copyright_file=../../../copyright.txt -destination=mocks/mockstore.go -package mocks . Store

package permissions

import (
	"github.com/mattermost/mattermost-server/v6/boards/model"

	mm_model "github.com/mattermost/mattermost-server/v6/model"
)

type PermissionsService interface {
	HasPermissionTo(userID string, permission *mm_model.Permission) bool
	HasPermissionToTeam(userID, teamID string, permission *mm_model.Permission) bool
	HasPermissionToChannel(userID, channelID string, permission *mm_model.Permission) bool
	HasPermissionToBoard(userID, boardID string, permission *mm_model.Permission) bool
}

type Store interface {
	GetBoard(boardID string) (*model.Board, error)
	GetMemberForBoard(boardID, userID string) (*model.BoardMember, error)
	GetBoardHistory(boardID string, opts model.QueryBoardHistoryOptions) ([]*model.Board, error)
}
