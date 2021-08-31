package app

import "github.com/mattermost/focalboard/server/model"

func (a *App) GetWorkspaceUsers(workspaceID string) ([]*model.User, error) {
	return a.store.GetUsersByWorkspace(workspaceID)
}
