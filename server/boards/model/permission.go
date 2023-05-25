// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

var (
	PermissionViewTeam              = mm_model.PermissionViewTeam
	PermissionManageTeam            = mm_model.PermissionManageTeam
	PermissionManageSystem          = mm_model.PermissionManageSystem
	PermissionReadChannel           = mm_model.PermissionReadChannel
	PermissionCreatePost            = mm_model.PermissionCreatePost
	PermissionViewMembers           = mm_model.PermissionViewMembers
	PermissionCreatePublicChannel   = mm_model.PermissionCreatePublicChannel
	PermissionCreatePrivateChannel  = mm_model.PermissionCreatePrivateChannel
	PermissionManageBoardType       = &mm_model.Permission{Id: "manage_board_type", Name: "", Description: "", Scope: ""}
	PermissionDeleteBoard           = &mm_model.Permission{Id: "delete_board", Name: "", Description: "", Scope: ""}
	PermissionViewBoard             = &mm_model.Permission{Id: "view_board", Name: "", Description: "", Scope: ""}
	PermissionManageBoardRoles      = &mm_model.Permission{Id: "manage_board_roles", Name: "", Description: "", Scope: ""}
	PermissionShareBoard            = &mm_model.Permission{Id: "share_board", Name: "", Description: "", Scope: ""}
	PermissionManageBoardCards      = &mm_model.Permission{Id: "manage_board_cards", Name: "", Description: "", Scope: ""}
	PermissionManageBoardProperties = &mm_model.Permission{Id: "manage_board_properties", Name: "", Description: "", Scope: ""}
	PermissionCommentBoardCards     = &mm_model.Permission{Id: "comment_board_cards", Name: "", Description: "", Scope: ""}
	PermissionDeleteOthersComments  = &mm_model.Permission{Id: "delete_others_comments", Name: "", Description: "", Scope: ""}
)
