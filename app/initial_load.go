// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v6/model"
)

func userDisplayName(user *model.User, displaySetting string) string {
	var displayName string
	if displaySetting == "nickname_full_name" {
		displayName = user.Nickname
		if displayName == "" {
			displayName = user.GetFullName()
		}
		if displayName == "" {
			displayName = user.Username
		}
	} else if displaySetting == "full_name" {
		displayName = user.GetFullName()
		if displayName == "" {
			displayName = user.Username
		}
	} else if displaySetting == "username" {
		displayName = user.Username
	} else {
		displayName = user.Username
	}
	return displayName
}

func (a *App) GetInitialLoadData(config map[string]string, license map[string]string, isAdmin bool, restrictions *model.ViewUsersRestrictions, userID string, since int64) (*model.InitialLoad, *model.AppError) {
	data := model.InitialLoad{
		Config:  config,
		License: license,
	}
	var wg sync.WaitGroup
	var userError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		user, err := a.GetUser(userID)
		if err != nil {
			userError = err
			return
		}
		user.Sanitize(map[string]bool{})
		if user.UpdateAt >= since {
			data.User = user
		}
	}()

	var teamMembersError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		teamMembers, err := a.GetTeamMembersForUser(userID)
		if err != nil {
			teamMembersError = err
			return
		}
		data.TeamMemberships = teamMembers
	}()

	var teamsError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		// TODO: Allow to include deleted teams
		teams, err := a.GetTeamsForUser(userID, true)
		if err != nil {
			teamsError = err
			return
		}
		if since == 0 {
			data.Teams = teams
		} else {
			data.Teams = []*model.Team{}
			for _, t := range teams {
				if t.UpdateAt >= since || t.DeleteAt >= since {
					data.Teams = append(data.Teams, t)
				}
			}
		}
	}()

	var preferencesError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		preferences, err := a.GetPreferencesForUser(userID)
		if err != nil {
			preferencesError = err
			return
		}
		data.UserPreferences = &preferences
	}()

	var channelMembersError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		channelMembers, err := a.GetChannelMembersForUserWithPagination(userID, 0, 100000000000)
		if err != nil {
			channelMembersError = err
			return
		}
		data.ChannelMemberships = channelMembers
	}()

	var channelsLeftError *model.AppError
	data.ChannelsLeft = []string{}
	if since > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			channelsLeft, err := a.GetChannelsLeftSince(userID, since)
			if err != nil {
				channelMembersError = err
				return
			}
			data.ChannelsLeft = channelsLeft
		}()
	}

	var channelsError *model.AppError
	wg.Add(1)
	go func() {
		defer wg.Done()
		channels, err := a.GetChannelsForUser(userID, true, 0, 100000000000, "")
		if err != nil {
			channelsError = err
			return
		}
		if since == 0 {
			data.Channels = channels
		} else {
			data.Channels = []*model.Channel{}
			for _, c := range channels {
				if c.UpdateAt >= since || c.DeleteAt >= since {
					data.Channels = append(data.Channels, c)
				}
			}
		}
	}()

	displaySettingValue := data.Config["TeammateNameDisplay"]
	var dmGmDisplayNamesErr *model.AppError
	var dmGmDisplayNames map[string]string
	wg.Add(1)
	go func() {
		defer wg.Done()
		displaySetting, _ := a.GetPreferenceByCategoryAndNameForUser(userID, "display_settings", "name_format")
		if displaySetting != nil {
			displaySettingValue = displaySetting.Value
		}
		var err error
		dmGmDisplayNames, err = a.Srv().Store.Channel().GetDmAndGmToDisplayNameMap(userID, displaySettingValue)
		if err != nil {
			dmGmDisplayNamesErr = model.NewAppError("initialLoad", "app.initial_load.get_dm_and_gm_display_name", nil, err.Error(), http.StatusInternalServerError)
			return
		}
	}()

	wg.Wait()
	if userError != nil {
		return nil, userError
	}

	if teamMembersError != nil {
		return nil, teamMembersError
	}

	if teamsError != nil {
		return nil, teamsError
	}

	if preferencesError != nil {
		return nil, preferencesError
	}

	if channelMembersError != nil {
		return nil, channelMembersError
	}

	if channelsLeftError != nil {
		return nil, channelsLeftError
	}

	if channelsError != nil {
		return nil, channelsError
	}

	if dmGmDisplayNamesErr != nil {
		return nil, dmGmDisplayNamesErr
	}

	data.SidebarCategories = map[string]*model.OrderedSidebarCategories{}

	roleNames := data.User.Roles

	for _, teamMember := range data.TeamMemberships {
		sidebarCategories, err := a.GetSidebarCategories(userID, teamMember.TeamId)
		if err != nil {
			return nil, err
		}
		data.SidebarCategories[teamMember.TeamId] = sidebarCategories
		roleNames = roleNames + " " + teamMember.Roles
	}

	for _, channelMember := range data.ChannelMemberships {
		roleNames = roleNames + " " + channelMember.Roles
	}

	for _, channel := range data.Channels {
		if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
			channel.DisplayName = dmGmDisplayNames[channel.Id]
		}
	}

	roles, err := a.GetRolesByNames(strings.Split(roleNames, " "))
	if err != nil {
		return nil, err
	}
	if since == 0 {
		data.Roles = roles
	} else {
		data.Roles = []*model.Role{}
		for _, r := range roles {
			if r.UpdateAt >= since || r.DeleteAt >= since {
				data.Roles = append(data.Roles, r)
			}
		}
	}
	return &data, nil
}
