// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mmpermissions

import (
	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/permissions"

	mmModel "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

type APIInterface interface {
	HasPermissionTo(userID string, permission *mmModel.Permission) bool
	HasPermissionToTeam(userID string, teamID string, permission *mmModel.Permission) bool
	HasPermissionToChannel(userID string, channelID string, permission *mmModel.Permission) bool
}

type Service struct {
	store  permissions.Store
	api    APIInterface
	logger mlog.LoggerIFace
}

func New(store permissions.Store, api APIInterface, logger mlog.LoggerIFace) *Service {
	return &Service{
		store:  store,
		api:    api,
		logger: logger,
	}
}

func (s *Service) HasPermissionTo(userID string, permission *mmModel.Permission) bool {
	if userID == "" || permission == nil {
		return false
	}
	return s.api.HasPermissionTo(userID, permission)
}

func (s *Service) HasPermissionToTeam(userID, teamID string, permission *mmModel.Permission) bool {
	if userID == "" || teamID == "" || permission == nil {
		return false
	}
	return s.api.HasPermissionToTeam(userID, teamID, permission)
}

func (s *Service) HasPermissionToChannel(userID, channelID string, permission *mmModel.Permission) bool {
	if userID == "" || channelID == "" || permission == nil {
		return false
	}
	return s.api.HasPermissionToChannel(userID, channelID, permission)
}

func (s *Service) HasPermissionToBoard(userID, boardID string, permission *mmModel.Permission) bool {
	if userID == "" || boardID == "" || permission == nil {
		return false
	}

	board, err := s.store.GetBoard(boardID)
	if model.IsErrNotFound(err) {
		var boards []*model.Board
		boards, err = s.store.GetBoardHistory(boardID, model.QueryBoardHistoryOptions{Limit: 1, Descending: true})
		if err != nil {
			return false
		}
		if len(boards) == 0 {
			return false
		}
		board = boards[0]
	} else if err != nil {
		s.logger.Error("error getting board",
			mlog.String("boardID", boardID),
			mlog.String("userID", userID),
			mlog.Err(err),
		)
		return false
	}

	// we need to check that the user has permission to see the team
	// regardless of its local permissions to the board
	if !s.HasPermissionToTeam(userID, board.TeamID, model.PermissionViewTeam) {
		return false
	}
	member, err := s.store.GetMemberForBoard(boardID, userID)
	if model.IsErrNotFound(err) {
		return false
	}
	if err != nil {
		s.logger.Error("error getting member for board",
			mlog.String("boardID", boardID),
			mlog.String("userID", userID),
			mlog.Err(err),
		)
		return false
	}

	switch member.MinimumRole {
	case "admin":
		member.SchemeAdmin = true
	case "editor":
		member.SchemeEditor = true
	case "commenter":
		member.SchemeCommenter = true
	case "viewer":
		member.SchemeViewer = true
	}

	// Admins become member of boards, but get minimal role
	// if they are a System/Team Admin (model.PermissionManageTeam)
	// elevate their permissions
	if !member.SchemeAdmin && s.HasPermissionToTeam(userID, board.TeamID, model.PermissionManageTeam) {
		return true
	}

	switch permission {
	case model.PermissionManageBoardType, model.PermissionDeleteBoard, model.PermissionManageBoardRoles, model.PermissionShareBoard, model.PermissionDeleteOthersComments:
		return member.SchemeAdmin
	case model.PermissionManageBoardCards, model.PermissionManageBoardProperties:
		return member.SchemeAdmin || member.SchemeEditor
	case model.PermissionCommentBoardCards:
		return member.SchemeAdmin || member.SchemeEditor || member.SchemeCommenter
	case model.PermissionViewBoard:
		return member.SchemeAdmin || member.SchemeEditor || member.SchemeCommenter || member.SchemeViewer
	default:
		return false
	}
}
