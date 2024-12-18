// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

func importLineFromTeam(team *model.TeamForExport) *imports.LineImportData {
	return &imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:            &team.Name,
			DisplayName:     &team.DisplayName,
			Type:            &team.Type,
			Description:     &team.Description,
			AllowOpenInvite: &team.AllowOpenInvite,
			Scheme:          team.SchemeName,
		},
	}
}

func importLineFromChannel(channel *model.ChannelForExport) *imports.LineImportData {
	return &imports.LineImportData{
		Type: "channel",
		Channel: &imports.ChannelImportData{
			Team:        &channel.TeamName,
			Name:        &channel.Name,
			DisplayName: &channel.DisplayName,
			Type:        &channel.Type,
			Header:      &channel.Header,
			Purpose:     &channel.Purpose,
			Scheme:      channel.SchemeName,
			DeletedAt:   &channel.DeleteAt,
		},
	}
}

func importLineFromDirectChannel(channel *model.DirectChannelForExport, favoritedBy, shownBy []string) *imports.LineImportData {
	channelMembers := channel.Members
	if len(channelMembers) == 1 {
		channelMembers = []*model.ChannelMemberForExport{channelMembers[0], channelMembers[0]}
	}

	line := &imports.LineImportData{
		Type: "direct_channel",
		DirectChannel: &imports.DirectChannelImportData{
			Header:       &channel.Header,
			Participants: importDirectChannelMembersFromChannelMembers(channelMembers),
		},
	}

	if len(favoritedBy) != 0 {
		line.DirectChannel.FavoritedBy = &favoritedBy
	}

	if len(shownBy) != 0 {
		line.DirectChannel.ShownBy = &shownBy
	}

	return line
}

func importDirectChannelMembersFromChannelMembers(members []*model.ChannelMemberForExport) []*imports.DirectChannelMemberImportData {
	importedMembers := make([]*imports.DirectChannelMemberImportData, len(members))
	for i, member := range members {
		props := member.NotifyProps
		notifyProps := imports.UserChannelNotifyPropsImportData{}

		desktop, exist := props[model.DesktopNotifyProp]
		if exist {
			notifyProps.Desktop = &desktop
		}
		mobile, exist := props[model.PushNotifyProp]
		if exist {
			notifyProps.Mobile = &mobile
		}
		email, exist := props[model.EmailNotifyProp]
		if exist {
			notifyProps.Email = &email
		}
		ignoreMentions, exist := props[model.IgnoreChannelMentionsNotifyProp]
		if exist {
			notifyProps.IgnoreChannelMentions = &ignoreMentions
		}
		channelAutoFallow, exist := props[model.ChannelAutoFollowThreads]
		if exist {
			notifyProps.ChannelAutoFollowThreads = &channelAutoFallow
		}
		markUnread, exist := props[model.MarkUnreadNotifyProp]
		if exist {
			notifyProps.MarkUnread = &markUnread
		}

		dcm := &imports.DirectChannelMemberImportData{
			Username:    &member.Username,
			NotifyProps: &notifyProps,
		}

		if member.SchemeUser {
			dcm.SchemeUser = &member.SchemeUser
		}
		if member.SchemeAdmin {
			dcm.SchemeAdmin = &member.SchemeAdmin
		}
		if member.SchemeGuest {
			dcm.SchemeGuest = &member.SchemeGuest
		}
		if member.LastViewedAt != 0 {
			dcm.LastViewedAt = &member.LastViewedAt
		}
		if member.MentionCount != 0 {
			dcm.MentionCount = &member.MentionCount
		}
		if member.MentionCountRoot != 0 {
			dcm.MentionCountRoot = &member.MentionCountRoot
		}
		if member.MsgCount != 0 {
			dcm.MsgCount = &member.MsgCount
		}
		if member.MsgCountRoot != 0 {
			dcm.MsgCountRoot = &member.MsgCountRoot
		}
		if member.UrgentMentionCount != 0 {
			dcm.UrgentMentionCount = &member.UrgentMentionCount
		}

		importedMembers[i] = dcm
	}
	return importedMembers
}

func importLineFromUser(user *model.User, exportedPrefs map[string]*string) *imports.LineImportData {
	// Bulk Importer doesn't accept "empty string" for AuthService.
	var authService *string
	if user.AuthService != "" {
		authService = &user.AuthService
	}

	return &imports.LineImportData{
		Type: "user",
		User: &imports.UserImportData{
			Username:                 &user.Username,
			Email:                    &user.Email,
			AuthService:              authService,
			AuthData:                 user.AuthData,
			Nickname:                 &user.Nickname,
			FirstName:                &user.FirstName,
			LastName:                 &user.LastName,
			Position:                 &user.Position,
			Roles:                    &user.Roles,
			Locale:                   &user.Locale,
			UseMarkdownPreview:       exportedPrefs["UseMarkdownPreview"],
			UseFormatting:            exportedPrefs["UseFormatting"],
			ShowUnreadSection:        exportedPrefs["ShowUnreadSection"],
			Theme:                    exportedPrefs["Theme"],
			UseMilitaryTime:          exportedPrefs["UseMilitaryTime"],
			CollapsePreviews:         exportedPrefs["CollapsePreviews"],
			MessageDisplay:           exportedPrefs["MessageDisplay"],
			ColorizeUsernames:        exportedPrefs["ColorizeUsernames"],
			ChannelDisplayMode:       exportedPrefs["ChannelDisplayMode"],
			TutorialStep:             exportedPrefs["TutorialStep"],
			EmailInterval:            exportedPrefs["EmailInterval"],
			NameFormat:               exportedPrefs["NameFormat"],
			SendOnCtrlEnter:          exportedPrefs["SendOnCtrlEnter"],
			ShowJoinLeave:            exportedPrefs["ShowJoinLeave"],
			SyncDrafts:               exportedPrefs["SyncDrafts"],
			ShowUnreadScrollPosition: exportedPrefs["ShowUnreadScrollPosition"],
			LimitVisibleDmsGms:       exportedPrefs["LimitVisibleDmsGms"],
			CodeBlockCtrlEnter:       exportedPrefs["CodeBlockCtrlEnter"],
			DeleteAt:                 &user.DeleteAt,
		},
	}
}

func importLineFromBot(bot *model.Bot, ownerUsername string) *imports.LineImportData {
	return &imports.LineImportData{
		Type: "bot",
		Bot: &imports.BotImportData{
			Username:    &bot.Username,
			Owner:       &ownerUsername,
			DisplayName: &bot.DisplayName,
			Description: &bot.Description,
			DeleteAt:    &bot.DeleteAt,
		},
	}
}

func importUserTeamDataFromTeamMember(member *model.TeamMemberForExport) *imports.UserTeamImportData {
	rolesList := strings.Fields(member.Roles)
	if member.SchemeAdmin {
		rolesList = append(rolesList, model.TeamAdminRoleId)
	}
	if member.SchemeUser {
		rolesList = append(rolesList, model.TeamUserRoleId)
	}
	if member.SchemeGuest {
		rolesList = append(rolesList, model.TeamGuestRoleId)
	}
	roles := strings.Join(rolesList, " ")
	return &imports.UserTeamImportData{
		Name:  &member.TeamName,
		Roles: &roles,
	}
}

func importUserChannelDataFromChannelMemberAndPreferences(member *model.ChannelMemberForExport, preferences *model.Preferences) *imports.UserChannelImportData {
	rolesList := strings.Fields(member.Roles)
	if member.SchemeAdmin {
		rolesList = append(rolesList, model.ChannelAdminRoleId)
	}
	if member.SchemeUser {
		rolesList = append(rolesList, model.ChannelUserRoleId)
	}
	if member.SchemeGuest {
		rolesList = append(rolesList, model.ChannelGuestRoleId)
	}
	props := member.NotifyProps
	notifyProps := imports.UserChannelNotifyPropsImportData{}

	desktop, exist := props[model.DesktopNotifyProp]
	if exist {
		notifyProps.Desktop = &desktop
	}
	mobile, exist := props[model.PushNotifyProp]
	if exist {
		notifyProps.Mobile = &mobile
	}
	markUnread, exist := props[model.MarkUnreadNotifyProp]
	if exist {
		notifyProps.MarkUnread = &markUnread
	}

	favorite := false
	for _, preference := range *preferences {
		if member.ChannelId == preference.Name {
			favorite = true
		}
	}

	roles := strings.Join(rolesList, " ")
	return &imports.UserChannelImportData{
		Name:               &member.ChannelName,
		Roles:              &roles,
		NotifyProps:        &notifyProps,
		Favorite:           &favorite,
		MentionCount:       &member.MentionCount,
		MentionCountRoot:   &member.MentionCountRoot,
		UrgentMentionCount: &member.UrgentMentionCount,
		MsgCount:           &member.MsgCount,
		MsgCountRoot:       &member.MsgCountRoot,
		LastViewedAt:       &member.LastViewedAt,
	}
}

func importLineForPost(post *model.PostForExport) *imports.LineImportData {
	f := []string(post.FlaggedBy)
	return &imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Team:      &post.TeamName,
			Channel:   &post.ChannelName,
			User:      &post.Username,
			Type:      &post.Type,
			Message:   &post.Message,
			Props:     &post.Props,
			CreateAt:  &post.CreateAt,
			EditAt:    &post.EditAt,
			IsPinned:  &post.IsPinned,
			FlaggedBy: &f,
		},
	}
}

func importLineForDirectPost(post *model.DirectPostForExport) *imports.LineImportData {
	channelMembers := *post.ChannelMembers
	if len(channelMembers) == 1 {
		channelMembers = []string{channelMembers[0], channelMembers[0]}
	}
	f := []string(post.FlaggedBy)
	return &imports.LineImportData{
		Type: "direct_post",
		DirectPost: &imports.DirectPostImportData{
			ChannelMembers: &channelMembers,
			User:           &post.User,
			Type:           &post.Type,
			Message:        &post.Message,
			Props:          &post.Props,
			CreateAt:       &post.CreateAt,
			EditAt:         &post.EditAt,
			IsPinned:       &post.IsPinned,
			FlaggedBy:      &f,
		},
	}
}

func importReplyFromPost(post *model.ReplyForExport) *imports.ReplyImportData {
	f := []string(post.FlaggedBy)
	return &imports.ReplyImportData{
		User:      &post.Username,
		Type:      &post.Type,
		Message:   &post.Message,
		CreateAt:  &post.CreateAt,
		EditAt:    &post.EditAt,
		IsPinned:  &post.IsPinned,
		FlaggedBy: &f,
		Props:     &post.Props,
	}
}

func importReactionFromPost(user *model.User, reaction *model.Reaction) *imports.ReactionImportData {
	return &imports.ReactionImportData{
		User:      &user.Username,
		EmojiName: &reaction.EmojiName,
		CreateAt:  &reaction.CreateAt,
	}
}

func importLineFromEmoji(emoji *model.Emoji, filePath string) *imports.LineImportData {
	return &imports.LineImportData{
		Type: "emoji",
		Emoji: &imports.EmojiImportData{
			Name:  &emoji.Name,
			Image: &filePath,
		},
	}
}

func importRoleDataFromRole(role *model.Role) *imports.RoleImportData {
	return &imports.RoleImportData{
		Name:          &role.Name,
		DisplayName:   &role.DisplayName,
		Description:   &role.Description,
		Permissions:   &role.Permissions,
		SchemeManaged: &role.SchemeManaged,
	}
}

func importLineFromRole(role *model.Role) *imports.LineImportData {
	return &imports.LineImportData{
		Type: "role",
		Role: importRoleDataFromRole(role),
	}
}

func importLineFromScheme(scheme *model.Scheme, rolesMap map[string]*model.Role) *imports.LineImportData {
	data := &imports.SchemeImportData{
		Name:        &scheme.Name,
		DisplayName: &scheme.DisplayName,
		Description: &scheme.Description,
		Scope:       &scheme.Scope,
	}

	if scheme.Scope == model.SchemeScopeTeam {
		data.DefaultTeamAdminRole = importRoleDataFromRole(rolesMap[scheme.DefaultTeamAdminRole])
		data.DefaultTeamUserRole = importRoleDataFromRole(rolesMap[scheme.DefaultTeamUserRole])
		data.DefaultTeamGuestRole = importRoleDataFromRole(rolesMap[scheme.DefaultTeamGuestRole])
	}

	if scheme.Scope == model.SchemeScopeTeam || scheme.Scope == model.SchemeScopeChannel {
		data.DefaultChannelAdminRole = importRoleDataFromRole(rolesMap[scheme.DefaultChannelAdminRole])
		data.DefaultChannelUserRole = importRoleDataFromRole(rolesMap[scheme.DefaultChannelUserRole])
		data.DefaultChannelGuestRole = importRoleDataFromRole(rolesMap[scheme.DefaultChannelGuestRole])
	}

	return &imports.LineImportData{
		Type:   "scheme",
		Scheme: data,
	}
}

func importFollowerFromThreadMember(threadMember *model.ThreadMembershipForExport) *imports.ThreadFollowerImportData {
	return &imports.ThreadFollowerImportData{
		User:           &threadMember.Username,
		LastViewed:     &threadMember.LastViewed,
		UnreadMentions: &threadMember.UnreadMentions,
	}
}
