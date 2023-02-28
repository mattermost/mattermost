package app

import (
	mm_model "github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) HasPermissionToBoard(userID, boardID string, permission *mm_model.Permission) bool {
	return a.permissions.HasPermissionToBoard(userID, boardID, permission)
}
