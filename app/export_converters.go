// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
	"strings"
)

func ImportLineFromTeam(team *model.TeamForExport) *LineImportData {
	return &LineImportData{
		Type: "team",
		Team: &TeamImportData{
			Name:            &team.Name,
			DisplayName:     &team.DisplayName,
			Type:            &team.Type,
			Description:     &team.Description,
			AllowOpenInvite: &team.AllowOpenInvite,
			Scheme:          team.SchemeName,
		},
	}
}

func ImportLineFromChannel(channel *model.ChannelForExport) *LineImportData {
	return &LineImportData{
		Type: "channel",
		Channel: &ChannelImportData{
			Team:        &channel.TeamName,
			Name:        &channel.Name,
			DisplayName: &channel.DisplayName,
			Type:        &channel.Type,
			Header:      &channel.Header,
			Purpose:     &channel.Purpose,
			Scheme:      channel.SchemeName,
		},
	}
}

func ImportLineFromUser(user *model.User) *LineImportData {
	// Bulk Importer doesn't accept "empty string" for AuthService.
	var authService *string
	if user.AuthService != "" {
		authService = &user.AuthService
	}

	return &LineImportData{
		Type: "user",
		User: &UserImportData{
			Username:    &user.Username,
			Email:       &user.Email,
			AuthService: authService,
			AuthData:    user.AuthData,
			Nickname:    &user.Nickname,
			FirstName:   &user.FirstName,
			LastName:    &user.LastName,
			Position:    &user.Position,
			Roles:       &user.Roles,
			Locale:      &user.Locale,
		},
	}
}

func ImportUserTeamDataFromTeamMember(member *model.TeamMemberForExport) *UserTeamImportData {
	rolesList := strings.Fields(member.Roles)
	if member.SchemeAdmin {
		rolesList = append(rolesList, model.TEAM_ADMIN_ROLE_ID)
	}
	if member.SchemeUser {
		rolesList = append(rolesList, model.TEAM_USER_ROLE_ID)
	}
	roles := strings.Join(rolesList, " ")
	return &UserTeamImportData{
		Name:  &member.TeamName,
		Roles: &roles,
	}
}

func ImportUserChannelDataFromChannelMember(member *model.ChannelMemberForExport) *UserChannelImportData {
	rolesList := strings.Fields(member.Roles)
	if member.SchemeAdmin {
		rolesList = append(rolesList, model.CHANNEL_ADMIN_ROLE_ID)
	}
	if member.SchemeUser {
		rolesList = append(rolesList, model.CHANNEL_USER_ROLE_ID)
	}
	roles := strings.Join(rolesList, " ")
	return &UserChannelImportData{
		Name:  &member.ChannelName,
		Roles: &roles,
	}
}

func ImportLineForPost(post *model.PostForExport) *LineImportData {
	return &LineImportData{
		Type: "post",
		Post: &PostImportData{
			Team:     &post.TeamName,
			Channel:  &post.ChannelName,
			User:     &post.Username,
			Message:  &post.Message,
			CreateAt: &post.CreateAt,
		},
	}
}

func ImportReplyFromPost(post *model.ReplyForExport) *ReplyImportData {
	return &ReplyImportData{
		User:     &post.Username,
		Message:  &post.Message,
		CreateAt: &post.CreateAt,
	}
}
