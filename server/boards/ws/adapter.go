// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -copyright_file=../../copyright.txt -destination=mocks/mockstore.go -package mocks . Store
package ws

import (
	"github.com/mattermost/mattermost-server/v6/boards/model"
)

const (
	websocketActionAuth                     = "AUTH"
	websocketActionSubscribeTeam            = "SUBSCRIBE_TEAM"
	websocketActionUnsubscribeTeam          = "UNSUBSCRIBE_TEAM"
	websocketActionSubscribeBlocks          = "SUBSCRIBE_BLOCKS"
	websocketActionUnsubscribeBlocks        = "UNSUBSCRIBE_BLOCKS"
	websocketActionUpdateBoard              = "UPDATE_BOARD"
	websocketActionUpdateMember             = "UPDATE_MEMBER"
	websocketActionDeleteMember             = "DELETE_MEMBER"
	websocketActionUpdateBlock              = "UPDATE_BLOCK"
	websocketActionUpdateConfig             = "UPDATE_CLIENT_CONFIG"
	websocketActionUpdateCategory           = "UPDATE_CATEGORY"
	websocketActionUpdateCategoryBoard      = "UPDATE_BOARD_CATEGORY"
	websocketActionUpdateSubscription       = "UPDATE_SUBSCRIPTION"
	websocketActionUpdateCardLimitTimestamp = "UPDATE_CARD_LIMIT_TIMESTAMP"
	websocketActionReorderCategories        = "REORDER_CATEGORIES"
	websocketActionReorderCategoryBoards    = "REORDER_CATEGORY_BOARDS"
)

type Store interface {
	GetBlock(blockID string) (*model.Block, error)
	GetMembersForBoard(boardID string) ([]*model.BoardMember, error)
}

type Adapter interface {
	BroadcastBlockChange(teamID string, block *model.Block)
	BroadcastBlockDelete(teamID, blockID, boardID string)
	BroadcastBoardChange(teamID string, board *model.Board)
	BroadcastBoardDelete(teamID, boardID string)
	BroadcastMemberChange(teamID, boardID string, member *model.BoardMember)
	BroadcastMemberDelete(teamID, boardID, userID string)
	BroadcastConfigChange(clientConfig model.ClientConfig)
	BroadcastCategoryChange(category model.Category)
	BroadcastCategoryBoardChange(teamID, userID string, blockCategory []*model.BoardCategoryWebsocketData)
	BroadcastCardLimitTimestampChange(cardLimitTimestamp int64)
	BroadcastSubscriptionChange(teamID string, subscription *model.Subscription)
	BroadcastCategoryReorder(teamID, userID string, categoryOrder []string)
	BroadcastCategoryBoardsReorder(teamID, userID, categoryID string, boardsOrder []string)
}
