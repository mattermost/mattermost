// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	mm_model "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

func (a *App) GetTeamUsers(teamID string, asGuestID string) ([]*model.User, error) {
	return a.store.GetUsersByTeam(teamID, asGuestID, a.config.ShowEmailAddress, a.config.ShowFullName)
}

func (a *App) SearchTeamUsers(teamID string, searchQuery string, asGuestID string, excludeBots bool) ([]*model.User, error) {
	users, err := a.store.SearchUsersByTeam(teamID, searchQuery, asGuestID, excludeBots, a.config.ShowEmailAddress, a.config.ShowFullName)
	if err != nil {
		return nil, err
	}

	for i, u := range users {
		if a.permissions.HasPermissionToTeam(u.ID, teamID, model.PermissionManageTeam) {
			users[i].Permissions = append(users[i].Permissions, model.PermissionManageTeam.Id)
		}
		if a.permissions.HasPermissionTo(u.ID, model.PermissionManageSystem) {
			users[i].Permissions = append(users[i].Permissions, model.PermissionManageSystem.Id)
		}
	}
	return users, nil
}

func (a *App) UpdateUserConfig(userID string, patch model.UserPreferencesPatch) ([]mm_model.Preference, error) {
	updatedPreferences, err := a.store.PatchUserPreferences(userID, patch)
	if err != nil {
		return nil, err
	}

	return updatedPreferences, nil
}

func (a *App) GetUserPreferences(userID string) ([]mm_model.Preference, error) {
	return a.store.GetUserPreferences(userID)
}

func (a *App) UserIsGuest(userID string) (bool, error) {
	user, err := a.store.GetUserByID(userID)
	if err != nil {
		return false, err
	}
	return user.IsGuest, nil
}

func (a *App) CanSeeUser(seerUser string, seenUser string) (bool, error) {
	isGuest, err := a.UserIsGuest(seerUser)
	if err != nil {
		return false, err
	}
	if isGuest {
		hasSharedChannels, err := a.store.CanSeeUser(seerUser, seenUser)
		if err != nil {
			return false, err
		}
		return hasSharedChannels, nil
	}
	return true, nil
}

func (a *App) SearchUserChannels(teamID string, userID string, query string) ([]*mm_model.Channel, error) {
	channels, err := a.store.SearchUserChannels(teamID, userID, query)
	if err != nil {
		return nil, err
	}

	var writeableChannels []*mm_model.Channel
	for _, channel := range channels {
		if a.permissions.HasPermissionToChannel(userID, channel.Id, model.PermissionCreatePost) {
			writeableChannels = append(writeableChannels, channel)
		}
	}
	return writeableChannels, nil
}

func (a *App) GetChannel(teamID string, channelID string) (*mm_model.Channel, error) {
	return a.store.GetChannel(teamID, channelID)
}
