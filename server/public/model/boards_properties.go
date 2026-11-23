// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	BoardsPropertyGroupName      = "boards"
	BoardsPropertyFieldNameBoard = "board"
	BoardsPropertyFieldAssignee  = "assignee"
	BoardsPropertyFieldStatus    = "status"

	BoardsStatusOptionTodo       = "Todo"
	BoardsStatusOptionInProgress = "In Progress"
	BoardsStatusOptionComplete   = "Complete"

	// Default colours seeded for the protected Status field. Tokens map to the
	// webapp's `colorTokenMap` in board_attributes_values.tsx; gray for unstarted
	// work, blue for active, green for done — standard kanban convention.
	BoardsStatusColorTodo       = "default"
	BoardsStatusColorInProgress = "blue"
	BoardsStatusColorComplete   = "green"
)
