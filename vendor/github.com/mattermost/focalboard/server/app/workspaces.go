package app

import (
	"database/sql"
	"errors"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) GetRootWorkspace() (*model.Workspace, error) {
	workspaceID := "0"
	workspace, _ := a.store.GetWorkspace(workspaceID)
	if workspace == nil {
		workspace = &model.Workspace{
			ID:          workspaceID,
			SignupToken: utils.CreateGUID(),
		}
		err := a.store.UpsertWorkspaceSignupToken(*workspace)
		if err != nil {
			a.logger.Fatal("Unable to initialize workspace", mlog.Err(err))
			return nil, err
		}
		workspace, err = a.store.GetWorkspace(workspaceID)
		if err != nil {
			a.logger.Fatal("Unable to get initialized workspace", mlog.Err(err))
			return nil, err
		}

		a.logger.Info("initialized workspace")
	}

	return workspace, nil
}

func (a *App) GetWorkspace(id string) (*model.Workspace, error) {
	workspace, err := a.store.GetWorkspace(id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return workspace, nil
}

func (a *App) DoesUserHaveWorkspaceAccess(userID string, workspaceID string) bool {
	return a.auth.DoesUserHaveWorkspaceAccess(userID, workspaceID)
}

func (a *App) UpsertWorkspaceSettings(workspace model.Workspace) error {
	return a.store.UpsertWorkspaceSettings(workspace)
}

func (a *App) UpsertWorkspaceSignupToken(workspace model.Workspace) error {
	return a.store.UpsertWorkspaceSignupToken(workspace)
}

func (a *App) GetWorkspaceCount() (int64, error) {
	return a.store.GetWorkspaceCount()
}
