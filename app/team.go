// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().Save(team); result.Err != nil {
		return nil, result.Err
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := a.CreateDefaultChannels(rteam.Id); err != nil {
			return nil, err
		}

		return rteam, nil
	}
}

func (a *App) CreateTeamWithUser(team *model.Team, userId string) (*model.Team, *model.AppError) {
	var user *model.User
	var err *model.AppError
	if user, err = a.GetUser(userId); err != nil {
		return nil, err
	} else {
		team.Email = user.Email
	}

	if !a.isTeamEmailAllowed(user) {
		return nil, model.NewAppError("isTeamEmailAllowed", "api.team.is_team_creation_allowed.domain.app_error", nil, "", http.StatusBadRequest)
	}

	var rteam *model.Team
	if rteam, err = a.CreateTeam(team); err != nil {
		return nil, err
	}

	if err = a.JoinUserToTeam(rteam, user, ""); err != nil {
		return nil, err
	}

	return rteam, nil
}

func (a *App) isTeamEmailAddressAllowed(email string) bool {
	email = strings.ToLower(email)
	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	domains := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(a.Config().TeamSettings.RestrictCreationToDomains, "@", " ", -1), ",", " ", -1))))

	matched := false
	for _, d := range domains {
		if strings.HasSuffix(email, "@"+d) {
			matched = true
			break
		}
	}

	if len(a.Config().TeamSettings.RestrictCreationToDomains) > 0 && !matched {
		return false
	}

	return true
}

func (a *App) isTeamEmailAllowed(user *model.User) bool {
	email := strings.ToLower(user.Email)

	if len(user.AuthService) > 0 && len(*user.AuthData) > 0 {
		return true
	}

	return a.isTeamEmailAddressAllowed(email)
}

func (a *App) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	var oldTeam *model.Team
	var err *model.AppError
	if oldTeam, err = a.GetTeam(team.Id); err != nil {
		return nil, err
	}

	oldTeam.DisplayName = team.DisplayName
	oldTeam.Description = team.Description
	oldTeam.InviteId = team.InviteId
	oldTeam.AllowOpenInvite = team.AllowOpenInvite
	oldTeam.CompanyName = team.CompanyName
	oldTeam.AllowedDomains = team.AllowedDomains

	if result := <-a.Srv.Store.Team().Update(oldTeam); result.Err != nil {
		return nil, result.Err
	}

	a.sendTeamEvent(oldTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return oldTeam, nil
}

func (a *App) UpdateTeamScheme(team *model.Team) (*model.Team, *model.AppError) {
	var oldTeam *model.Team
	var err *model.AppError
	if oldTeam, err = a.GetTeam(team.Id); err != nil {
		return nil, err
	}

	oldTeam.SchemeId = team.SchemeId

	if result := <-a.Srv.Store.Team().Update(oldTeam); result.Err != nil {
		return nil, result.Err
	}

	a.sendTeamEvent(oldTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return oldTeam, nil
}

func (a *App) PatchTeam(teamId string, patch *model.TeamPatch) (*model.Team, *model.AppError) {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return nil, err
	}

	team.Patch(patch)

	updatedTeam, err := a.UpdateTeam(team)
	if err != nil {
		return nil, err
	}

	a.sendTeamEvent(updatedTeam, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return updatedTeam, nil
}

func (a *App) sendTeamEvent(team *model.Team, event string) {
	sanitizedTeam := &model.Team{}
	*sanitizedTeam = *team
	sanitizedTeam.Sanitize()

	message := model.NewWebSocketEvent(event, "", "", "", nil)
	message.Add("team", sanitizedTeam.ToJson())
	a.Publish(message)
}

func (a *App) GetSchemeRolesForTeam(teamId string) (string, string, *model.AppError) {
	var team *model.Team
	var err *model.AppError

	if team, err = a.GetTeam(teamId); err != nil {
		return "", "", err
	}

	if team.SchemeId != nil && len(*team.SchemeId) != 0 {
		if scheme, err := a.GetScheme(*team.SchemeId); err != nil {
			return "", "", err
		} else {
			return scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole, nil
		}
	}

	return model.TEAM_USER_ROLE_ID, model.TEAM_ADMIN_ROLE_ID, nil
}

func (a *App) UpdateTeamMemberRoles(teamId string, userId string, newRoles string) (*model.TeamMember, *model.AppError) {
	var member *model.TeamMember
	if result := <-a.Srv.Store.Team().GetMember(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		member = result.Data.(*model.TeamMember)
	}

	if member == nil {
		err := model.NewAppError("UpdateTeamMemberRoles", "api.team.update_member_roles.not_a_member", nil, "userId="+userId+" teamId="+teamId, http.StatusBadRequest)
		return nil, err
	}

	schemeUserRole, schemeAdminRole, err := a.GetSchemeRolesForTeam(teamId)
	if err != nil {
		return nil, err
	}

	var newExplicitRoles []string
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		if role, err := a.GetRoleByName(roleName); err != nil {
			err.StatusCode = http.StatusBadRequest
			return nil, err
		} else if !role.SchemeManaged {
			// The role is not scheme-managed, so it's OK to apply it to the explicit roles field.
			newExplicitRoles = append(newExplicitRoles, roleName)
		} else {
			// The role is scheme-managed, so need to check if it is part of the scheme for this channel or not.
			switch roleName {
			case schemeAdminRole:
				member.SchemeAdmin = true
			case schemeUserRole:
				member.SchemeUser = true
			default:
				// If not part of the scheme for this channel, then it is not allowed to apply it as an explicit role.
				return nil, model.NewAppError("UpdateTeamMemberRoles", "api.channel.update_team_member_roles.scheme_role.app_error", nil, "role_name="+roleName, http.StatusBadRequest)
			}
		}
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	if result := <-a.Srv.Store.Team().UpdateMember(member); result.Err != nil {
		return nil, result.Err
	} else {
		member = result.Data.(*model.TeamMember)
	}

	a.ClearSessionCacheForUser(userId)

	a.sendUpdatedMemberRoleEvent(userId, member)

	return member, nil
}

func (a *App) sendUpdatedMemberRoleEvent(userId string, member *model.TeamMember) {
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_MEMBERROLE_UPDATED, "", "", userId, nil)
	message.Add("member", member.ToJson())
	a.Publish(message)
}

func (a *App) AddUserToTeam(teamId string, userId string, userRequestorId string) (*model.Team, *model.AppError) {
	tchan := a.Srv.Store.Team().Get(teamId)
	uchan := a.Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if err := a.JoinUserToTeam(team, user, userRequestorId); err != nil {
		return nil, err
	}

	return team, nil
}

func (a *App) AddUserToTeamByTeamId(teamId string, user *model.User) *model.AppError {
	if result := <-a.Srv.Store.Team().Get(teamId); result.Err != nil {
		return result.Err
	} else {
		return a.JoinUserToTeam(result.Data.(*model.Team), user, "")
	}
}

func (a *App) AddUserToTeamByToken(userId string, tokenId string) (*model.Team, *model.AppError) {
	result := <-a.Srv.Store.Token().GetByToken(tokenId)
	if result.Err != nil {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}

	token := result.Data.(*model.Token)
	if token.Type != TOKEN_TYPE_TEAM_INVITATION {
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= TEAM_INVITATION_EXPIRY_TIME {
		a.DeleteToken(token)
		return nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJson(strings.NewReader(token.Extra))

	tchan := a.Srv.Store.Team().Get(tokenData["teamId"])
	uchan := a.Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		return nil, err
	}

	if err := a.DeleteToken(token); err != nil {
		return nil, err
	}

	return team, nil
}

func (a *App) AddUserToTeamByInviteId(inviteId string, userId string) (*model.Team, *model.AppError) {
	tchan := a.Srv.Store.Team().GetByInviteId(inviteId)
	uchan := a.Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if err := a.JoinUserToTeam(team, user, ""); err != nil {
		return nil, err
	}

	return team, nil
}

// Returns three values:
// 1. a pointer to the team member, if successful
// 2. a boolean: true if the user has a non-deleted team member for that team already, otherwise false.
// 3. a pointer to an AppError if something went wrong.
func (a *App) joinUserToTeam(team *model.Team, user *model.User) (*model.TeamMember, bool, *model.AppError) {
	tm := &model.TeamMember{
		TeamId:     team.Id,
		UserId:     user.Id,
		SchemeUser: true,
	}

	if team.Email == user.Email {
		tm.SchemeAdmin = true
	}

	if etmr := <-a.Srv.Store.Team().GetMember(team.Id, user.Id); etmr.Err == nil {
		// Membership already exists.  Check if deleted and and update, otherwise do nothing
		rtm := etmr.Data.(*model.TeamMember)

		// Do nothing if already added
		if rtm.DeleteAt == 0 {
			return rtm, true, nil
		}

		if membersCount := <-a.Srv.Store.Team().GetActiveMemberCount(tm.TeamId); membersCount.Err != nil {
			return nil, false, membersCount.Err
		} else if membersCount.Data.(int64) >= int64(*a.Config().TeamSettings.MaxUsersPerTeam) {
			return nil, false, model.NewAppError("joinUserToTeam", "app.team.join_user_to_team.max_accounts.app_error", nil, "teamId="+tm.TeamId, http.StatusBadRequest)
		} else {
			if tmr := <-a.Srv.Store.Team().UpdateMember(tm); tmr.Err != nil {
				return nil, false, tmr.Err
			} else {
				return tmr.Data.(*model.TeamMember), false, nil
			}
		}
	} else {
		// Membership appears to be missing.  Lets try to add.
		if tmr := <-a.Srv.Store.Team().SaveMember(tm, *a.Config().TeamSettings.MaxUsersPerTeam); tmr.Err != nil {
			return nil, false, tmr.Err
		} else {
			return tmr.Data.(*model.TeamMember), false, nil
		}
	}
}

func (a *App) JoinUserToTeam(team *model.Team, user *model.User, userRequestorId string) *model.AppError {
	if _, alreadyAdded, err := a.joinUserToTeam(team, user); err != nil {
		return err
	} else if alreadyAdded {
		return nil
	}

	if uua := <-a.Srv.Store.User().UpdateUpdateAt(user.Id); uua.Err != nil {
		return uua.Err
	}

	shouldBeAdmin := team.Email == user.Email

	// Soft error if there is an issue joining the default channels
	if err := a.JoinDefaultChannels(team.Id, user, shouldBeAdmin, userRequestorId); err != nil {
		l4g.Error(utils.T("api.user.create_user.joining.error"), user.Id, team.Id, err)
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", user.Id, nil)
	message.Add("team_id", team.Id)
	message.Add("user_id", user.Id)
	a.Publish(message)

	return nil
}

func (a *App) GetTeam(teamId string) (*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().Get(teamId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Team), nil
	}
}

func (a *App) GetTeamByName(name string) (*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetByName(name); result.Err != nil {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else {
		return result.Data.(*model.Team), nil
	}
}

func (a *App) GetTeamByInviteId(inviteId string) (*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Team), nil
	}
}

func (a *App) GetAllTeams() ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetAll(); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) GetAllTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetAllPage(offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) GetAllOpenTeams() ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetAllTeamListing(); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) SearchAllTeams(term string) ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().SearchAll(term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) SearchOpenTeams(term string) ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().SearchOpen(term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) GetAllOpenTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetAllTeamPageListing(offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) GetTeamsForUser(userId string) ([]*model.Team, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetTeamsByUserId(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Team), nil
	}
}

func (a *App) GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetMember(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.TeamMember), nil
	}
}

func (a *App) GetTeamMembersForUser(userId string) ([]*model.TeamMember, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetTeamsForUser(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.TeamMember), nil
	}
}

func (a *App) GetTeamMembers(teamId string, offset int, limit int) ([]*model.TeamMember, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetMembers(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.TeamMember), nil
	}
}

func (a *App) GetTeamMembersByIds(teamId string, userIds []string) ([]*model.TeamMember, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetMembersByIds(teamId, userIds); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.TeamMember), nil
	}
}

func (a *App) AddTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	if _, err := a.AddUserToTeam(teamId, userId, ""); err != nil {
		return nil, err
	}

	var teamMember *model.TeamMember
	var err *model.AppError
	if teamMember, err = a.GetTeamMember(teamId, userId); err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", userId, nil)
	message.Add("team_id", teamId)
	message.Add("user_id", userId)
	a.Publish(message)

	return teamMember, nil
}

func (a *App) AddTeamMembers(teamId string, userIds []string, userRequestorId string) ([]*model.TeamMember, *model.AppError) {
	var members []*model.TeamMember

	for _, userId := range userIds {
		if _, err := a.AddUserToTeam(teamId, userId, userRequestorId); err != nil {
			return nil, err
		}

		if teamMember, err := a.GetTeamMember(teamId, userId); err != nil {
			return nil, err
		} else {
			members = append(members, teamMember)
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ADDED_TO_TEAM, "", "", userId, nil)
		message.Add("team_id", teamId)
		message.Add("user_id", userId)
		a.Publish(message)
	}

	return members, nil
}

func (a *App) AddTeamMemberByToken(userId, tokenId string) (*model.TeamMember, *model.AppError) {
	var team *model.Team
	var err *model.AppError

	if team, err = a.AddUserToTeamByToken(userId, tokenId); err != nil {
		return nil, err
	}

	if teamMember, err := a.GetTeamMember(team.Id, userId); err != nil {
		return nil, err
	} else {
		return teamMember, nil
	}
}

func (a *App) AddTeamMemberByInviteId(inviteId, userId string) (*model.TeamMember, *model.AppError) {
	var team *model.Team
	var err *model.AppError

	if team, err = a.AddUserToTeamByInviteId(inviteId, userId); err != nil {
		return nil, err
	}

	if teamMember, err := a.GetTeamMember(team.Id, userId); err != nil {
		return nil, err
	} else {
		return teamMember, nil
	}
}

func (a *App) GetTeamUnread(teamId, userId string) (*model.TeamUnread, *model.AppError) {
	result := <-a.Srv.Store.Team().GetChannelUnreadsForTeam(teamId, userId)
	if result.Err != nil {
		return nil, result.Err
	}

	channelUnreads := result.Data.([]*model.ChannelUnread)
	var teamUnread = &model.TeamUnread{
		MsgCount:     0,
		MentionCount: 0,
		TeamId:       teamId,
	}

	for _, cu := range channelUnreads {
		teamUnread.MentionCount += cu.MentionCount

		if cu.NotifyProps["mark_unread"] != model.CHANNEL_MARK_UNREAD_MENTION {
			teamUnread.MsgCount += cu.MsgCount
		}
	}

	return teamUnread, nil
}

func (a *App) RemoveUserFromTeam(teamId string, userId string, requestorId string) *model.AppError {
	tchan := a.Srv.Store.Team().Get(teamId)
	uchan := a.Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if err := a.LeaveTeam(team, user, requestorId); err != nil {
		return err
	}

	return nil
}

func (a *App) LeaveTeam(team *model.Team, user *model.User, requestorId string) *model.AppError {
	var teamMember *model.TeamMember
	var err *model.AppError

	if teamMember, err = a.GetTeamMember(team.Id, user.Id); err != nil {
		return model.NewAppError("LeaveTeam", "api.team.remove_user_from_team.missing.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	var channelList *model.ChannelList

	if result := <-a.Srv.Store.Channel().GetChannels(team.Id, user.Id); result.Err != nil {
		if result.Err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			channelList = &model.ChannelList{}
		} else {
			return result.Err
		}

	} else {
		channelList = result.Data.(*model.ChannelList)
	}

	for _, channel := range *channelList {
		if !channel.IsGroupOrDirect() {
			a.InvalidateCacheForChannelMembers(channel.Id)
			if result := <-a.Srv.Store.Channel().RemoveMember(channel.Id, user.Id); result.Err != nil {
				return result.Err
			}
		}
	}

	var channel *model.Channel
	if result := <-a.Srv.Store.Channel().GetByName(team.Id, model.DEFAULT_CHANNEL, false); result.Err != nil {
		return result.Err
	} else {
		channel = result.Data.(*model.Channel)
	}

	if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
		if requestorId == user.Id {
			if err := a.postLeaveTeamMessage(user, channel); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		} else {
			if err := a.postRemoveFromTeamMessage(user, channel); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		}
	}

	// Send the websocket message before we actually do the remove so the user being removed gets it.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LEAVE_TEAM, team.Id, "", "", nil)
	message.Add("user_id", user.Id)
	message.Add("team_id", team.Id)
	a.Publish(message)

	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if result := <-a.Srv.Store.Team().UpdateMember(teamMember); result.Err != nil {
		return result.Err
	}

	if uua := <-a.Srv.Store.User().UpdateUpdateAt(user.Id); uua.Err != nil {
		return uua.Err
	}

	// delete the preferences that set the last channel used in the team and other team specific preferences
	if result := <-a.Srv.Store.Preference().DeleteCategory(user.Id, team.Id); result.Err != nil {
		return result.Err
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) postLeaveTeamMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.leave.left"), user.Username),
		Type:      model.POST_LEAVE_TEAM,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) postRemoveFromTeamMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.remove_user_from_team.removed"), user.Username),
		Type:      model.POST_REMOVE_FROM_TEAM,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postRemoveFromTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) InviteNewUsersToTeam(emailList []string, teamId, senderId string) *model.AppError {
	if len(emailList) == 0 {
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.no_one.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	var invalidEmailList []string

	for _, email := range emailList {
		if !a.isTeamEmailAddressAllowed(email) {
			invalidEmailList = append(invalidEmailList, email)
		}
	}

	if len(invalidEmailList) > 0 {
		s := strings.Join(invalidEmailList, ", ")
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]interface{}{"Addresses": s}, "", http.StatusBadRequest)
		return err
	}

	tchan := a.Srv.Store.Team().Get(teamId)
	uchan := a.Srv.Store.User().Get(senderId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		return result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		return result.Err
	} else {
		user = result.Data.(*model.User)
	}

	nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
	a.SendInviteEmails(team, user.GetDisplayName(nameFormat), emailList, a.GetSiteURL())

	return nil
}

func (a *App) FindTeamByName(name string) bool {
	if result := <-a.Srv.Store.Team().GetByName(name); result.Err != nil {
		return false
	} else {
		return true
	}
}

func (a *App) GetTeamsUnreadForUser(excludeTeamId string, userId string) ([]*model.TeamUnread, *model.AppError) {
	if result := <-a.Srv.Store.Team().GetChannelUnreadsForAllTeams(excludeTeamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		data := result.Data.([]*model.ChannelUnread)
		members := []*model.TeamUnread{}
		membersMap := make(map[string]*model.TeamUnread)

		unreads := func(cu *model.ChannelUnread, tu *model.TeamUnread) *model.TeamUnread {
			tu.MentionCount += cu.MentionCount

			if cu.NotifyProps["mark_unread"] != model.CHANNEL_MARK_UNREAD_MENTION {
				tu.MsgCount += cu.MsgCount
			}

			return tu
		}

		for i := range data {
			id := data[i].TeamId
			if mu, ok := membersMap[id]; ok {
				membersMap[id] = unreads(data[i], mu)
			} else {
				membersMap[id] = unreads(data[i], &model.TeamUnread{
					MsgCount:     0,
					MentionCount: 0,
					TeamId:       id,
				})
			}
		}

		for _, val := range membersMap {
			members = append(members, val)
		}

		return members, nil
	}
}

func (a *App) PermanentDeleteTeamId(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	return a.PermanentDeleteTeam(team)
}

func (a *App) PermanentDeleteTeam(team *model.Team) *model.AppError {
	team.DeleteAt = model.GetMillis()
	if result := <-a.Srv.Store.Team().Update(team); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Channel().GetTeamChannels(team.Id); result.Err != nil {
		if result.Err.Id != "store.sql_channel.get_channels.not_found.app_error" {
			return result.Err
		}
	} else {
		channels := result.Data.(*model.ChannelList)
		for _, c := range *channels {
			a.PermanentDeleteChannel(c)
		}
	}

	if result := <-a.Srv.Store.Team().RemoveAllMembersByTeam(team.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Command().PermanentDeleteByTeam(team.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Team().PermanentDelete(team.Id); result.Err != nil {
		return result.Err
	}

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_DELETE_TEAM)

	return nil
}

func (a *App) SoftDeleteTeam(teamId string) *model.AppError {
	team, err := a.GetTeam(teamId)
	if err != nil {
		return err
	}

	team.DeleteAt = model.GetMillis()
	if result := <-a.Srv.Store.Team().Update(team); result.Err != nil {
		return result.Err
	}

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_DELETE_TEAM)

	return nil
}

func (a *App) GetTeamStats(teamId string) (*model.TeamStats, *model.AppError) {
	tchan := a.Srv.Store.Team().GetTotalMemberCount(teamId)
	achan := a.Srv.Store.Team().GetActiveMemberCount(teamId)

	stats := &model.TeamStats{}
	stats.TeamId = teamId

	if result := <-tchan; result.Err != nil {
		return nil, result.Err
	} else {
		stats.TotalMemberCount = result.Data.(int64)
	}

	if result := <-achan; result.Err != nil {
		return nil, result.Err
	} else {
		stats.ActiveMemberCount = result.Data.(int64)
	}

	return stats, nil
}

func (a *App) GetTeamIdFromQuery(query url.Values) (string, *model.AppError) {
	tokenId := query.Get("t")
	inviteId := query.Get("id")

	if len(tokenId) > 0 {
		result := <-a.Srv.Store.Token().GetByToken(tokenId)
		if result.Err != nil {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		token := result.Data.(*model.Token)
		if token.Type != TOKEN_TYPE_TEAM_INVITATION {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		if model.GetMillis()-token.CreateAt >= TEAM_INVITATION_EXPIRY_TIME {
			a.DeleteToken(token)
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.expired_link.app_error", nil, "", http.StatusBadRequest)
		}

		tokenData := model.MapFromJson(strings.NewReader(token.Extra))

		return tokenData["teamId"], nil
	} else if len(inviteId) > 0 {
		if result := <-a.Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
			// soft fail, so we still create user but don't auto-join team
			l4g.Error("%v", result.Err)
		} else {
			return result.Data.(*model.Team).Id, nil
		}
	}

	return "", nil
}

func (a *App) SanitizeTeam(session model.Session, team *model.Team) *model.Team {
	if !a.SessionHasPermissionToTeam(session, team.Id, model.PERMISSION_MANAGE_TEAM) {
		team.Sanitize()
	}

	return team
}

func (a *App) SanitizeTeams(session model.Session, teams []*model.Team) []*model.Team {
	for _, team := range teams {
		a.SanitizeTeam(session, team)
	}

	return teams
}

func (a *App) GetTeamIcon(team *model.Team) ([]byte, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.filesettings_no_driver.app_error", nil, "", http.StatusNotImplemented)
	} else {
		path := "teams/" + team.Id + "/teamIcon.png"
		if data, err := a.ReadFile(path); err != nil {
			return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.read_file.app_error", nil, err.Error(), http.StatusNotFound)
		} else {
			return data, nil
		}
	}
}

func (a *App) SetTeamIcon(teamId string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.open.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer file.Close()
	return a.SetTeamIconFromFile(teamId, file)
}

func (a *App) SetTeamIconFromFile(teamId string, file multipart.File) *model.AppError {

	team, getTeamErr := a.GetTeam(teamId)

	if getTeamErr != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.get_team.app_error", nil, getTeamErr.Error(), http.StatusBadRequest)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return model.NewAppError("setTeamIcon", "api.team.set_team_icon.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.decode_config.app_error", nil, err.Error(), http.StatusBadRequest)
	} else if config.Width*config.Height > model.MaxImageSize {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.too_large.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	file.Seek(0, 0)

	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.decode.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	file.Seek(0, 0)

	orientation, _ := getImageOrientation(file)
	img = makeImageUpright(img, orientation)

	// Scale team icon
	teamIconWidthAndHeight := 128
	img = imaging.Fill(img, teamIconWidthAndHeight, teamIconWidthAndHeight, imaging.Center, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	path := "teams/" + teamId + "/teamIcon.png"

	if err := a.WriteFile(buf.Bytes(), path); err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.write_file.app_error", nil, "", http.StatusInternalServerError)
	}

	curTime := model.GetMillis()

	if result := <-a.Srv.Store.Team().UpdateLastTeamIconUpdate(teamId, curTime); result.Err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.update.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}

	// manually set time to avoid possible cluster inconsistencies
	team.LastTeamIconUpdate = curTime

	a.sendTeamEvent(team, model.WEBSOCKET_EVENT_UPDATE_TEAM)

	return nil
}
