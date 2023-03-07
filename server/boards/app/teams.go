// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/utils"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func (a *App) GetRootTeam() (*model.Team, error) {
	teamID := "0"
	team, _ := a.store.GetTeam(teamID)
	if team == nil {
		team = &model.Team{
			ID:          teamID,
			SignupToken: utils.NewID(utils.IDTypeToken),
		}
		err := a.store.UpsertTeamSignupToken(*team)
		if err != nil {
			a.logger.Error("Unable to initialize team", mlog.Err(err))
			return nil, err
		}

		team, err = a.store.GetTeam(teamID)
		if err != nil {
			a.logger.Error("Unable to get initialized team", mlog.Err(err))
			return nil, err
		}

		a.logger.Info("initialized team")
	}

	return team, nil
}

func (a *App) GetTeam(id string) (*model.Team, error) {
	team, err := a.store.GetTeam(id)
	if model.IsErrNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return team, nil
}

func (a *App) GetTeamsForUser(userID string) ([]*model.Team, error) {
	return a.store.GetTeamsForUser(userID)
}

func (a *App) DoesUserHaveTeamAccess(userID string, teamID string) bool {
	return a.auth.DoesUserHaveTeamAccess(userID, teamID)
}

func (a *App) UpsertTeamSettings(team model.Team) error {
	return a.store.UpsertTeamSettings(team)
}

func (a *App) UpsertTeamSignupToken(team model.Team) error {
	return a.store.UpsertTeamSignupToken(team)
}

func (a *App) GetTeamCount() (int64, error) {
	return a.store.GetTeamCount()
}
