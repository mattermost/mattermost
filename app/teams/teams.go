// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

func (ts *TeamService) CreateTeam(team *model.Team) (*model.Team, error) {
	team.InviteId = ""
	rteam, err := ts.store.Save(team)
	if err != nil {
		return nil, err
	}

	if _, err := ts.createDefaultChannels(rteam.Id); err != nil {
		return nil, err
	}

	return rteam, nil
}

func (ts *TeamService) GetTeam(teamID string) (*model.Team, error) {
	team, err := ts.store.Get(teamID)
	if err != nil {
		return nil, err
	}

	return team, nil
}

// CreateDefaultChannels creates channels in the given team for each channel returned by (*App).DefaultChannelNames.
//
func (ts *TeamService) createDefaultChannels(teamID string) ([]*model.Channel, error) {
	displayNames := map[string]string{
		"town-square": i18n.T("api.channel.create_default_channels.town_square"),
		"off-topic":   i18n.T("api.channel.create_default_channels.off_topic"),
	}
	channels := []*model.Channel{}
	defaultChannelNames := ts.DefaultChannelNames()
	for _, name := range defaultChannelNames {
		displayName := i18n.TDefault(displayNames[name], name)
		channel := &model.Channel{DisplayName: displayName, Name: name, Type: model.ChannelTypeOpen, TeamId: teamID}
		// We should use the channel service here (coming soon). Ideally, we should just emit an event
		// and let the subscribers do the job, in this case it would be the channels service.
		// Currently we are adding services to the server and because of that we are using
		// the channel store here. This should be replaced in the future.
		if _, err := ts.channelStore.Save(channel, *ts.config().TeamSettings.MaxChannelsPerTeam); err != nil {
			return nil, err
		}
		channels = append(channels, channel)
	}
	return channels, nil
}

type UpdateOptions struct {
	Sanitized bool
	Imported  bool
}

func (ts *TeamService) UpdateTeam(team *model.Team, opts UpdateOptions) (*model.Team, error) {
	oldTeam := team
	var err error

	if !opts.Imported {
		oldTeam, err = ts.store.Get(team.Id)
		if err != nil {
			return nil, err
		}

		if err = ts.checkValidDomains(team); err != nil {
			return nil, err
		}
	}

	if opts.Sanitized {
		oldTeam.DisplayName = team.DisplayName
		oldTeam.Description = team.Description
		oldTeam.AllowOpenInvite = team.AllowOpenInvite
		oldTeam.CompanyName = team.CompanyName
		oldTeam.AllowedDomains = team.AllowedDomains
		oldTeam.LastTeamIconUpdate = team.LastTeamIconUpdate
		oldTeam.GroupConstrained = team.GroupConstrained
	}

	oldTeam, err = ts.store.Update(oldTeam)
	if err != nil {
		return team, err
	}

	return oldTeam, nil
}

func (ts *TeamService) PatchTeam(teamID string, patch *model.TeamPatch) (*model.Team, error) {
	team, err := ts.store.Get(teamID)
	if err != nil {
		return nil, err
	}

	team.Patch(patch)
	if patch.AllowOpenInvite != nil && !*patch.AllowOpenInvite {
		team.InviteId = model.NewId()
	}

	if err = ts.checkValidDomains(team); err != nil {
		return nil, err
	}

	team, err = ts.store.Update(team)
	if err != nil {
		return team, err
	}

	return team, nil
}

// JoinUserToTeam adds a user to the team and it returns three values:
// 1. a pointer to the team member, if successful
// 2. a boolean: true if the user has a non-deleted team member for that team already, otherwise false.
// 3. an error if something went wrong.
func (ts *TeamService) JoinUserToTeam(team *model.Team, user *model.User) (*model.TeamMember, bool, error) {
	if !ts.IsTeamEmailAllowed(user, team) {
		return nil, false, AcceptedDomainError
	}

	tm := &model.TeamMember{
		TeamId:      team.Id,
		UserId:      user.Id,
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}

	if !user.IsGuest() {
		userShouldBeAdmin, err := ts.userIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
		if err != nil {
			return nil, false, err
		}
		tm.SchemeAdmin = userShouldBeAdmin
	}

	if team.Email == user.Email {
		tm.SchemeAdmin = true
	}

	rtm, err := ts.store.GetMember(context.Background(), team.Id, user.Id)
	if err != nil {
		// Membership appears to be missing. Lets try to add.
		tmr, nErr := ts.store.SaveMember(tm, *ts.config().TeamSettings.MaxUsersPerTeam)
		if nErr != nil {
			return nil, false, nErr
		}
		return tmr, false, nil
	}

	// Membership already exists.  Check if deleted and update, otherwise do nothing
	// Do nothing if already added
	if rtm.DeleteAt == 0 {
		return rtm, true, nil
	}

	membersCount, err := ts.store.GetActiveMemberCount(tm.TeamId, nil)
	if err != nil {
		return nil, false, MemberCountError
	}

	if membersCount >= int64(*ts.config().TeamSettings.MaxUsersPerTeam) {
		return nil, false, MaxMemberCountError
	}

	member, nErr := ts.store.UpdateMember(tm)
	if nErr != nil {
		return nil, false, nErr
	}

	return member, false, nil
}

// RemoveTeamMember removes the team member from the team. This method sends
// the websocket message before actually removing so the user being removed gets it.
func (ts *TeamService) RemoveTeamMember(teamMember *model.TeamMember) error {
	message := model.NewWebSocketEvent(model.WebsocketEventLeaveTeam, teamMember.TeamId, "", "", nil)
	message.Add("user_id", teamMember.UserId)
	message.Add("team_id", teamMember.TeamId)
	ts.wh.Publish(message)

	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if _, nErr := ts.store.UpdateMember(teamMember); nErr != nil {
		return nErr
	}

	return nil
}

func (ts *TeamService) RegenerateTeamInviteId(teamID string) (*model.Team, error) {
	team, err := ts.GetTeam(teamID)
	if err != nil {
		return nil, err
	}

	team.InviteId = model.NewId()

	updatedTeam, err := ts.store.Update(team)
	if err != nil {
		return nil, err
	}

	ts.sendEvent(updatedTeam, model.WebsocketEventUpdateTeam)

	return updatedTeam, nil
}

func (ts *TeamService) GetSchemeRolesForTeam(teamID string) (string, string, string, error) {
	team, err := ts.GetTeam(teamID)
	if err != nil {
		return "", "", "", err
	}

	if team.SchemeId != nil && *team.SchemeId != "" {
		scheme, err := ts.schemeStore.Get(*team.SchemeId)
		if err != nil {
			return "", "", "", err
		}
		return scheme.DefaultTeamGuestRole, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole, nil
	}

	return model.TeamGuestRoleId, model.TeamUserRoleId, model.TeamAdminRoleId, nil
}

func (ts *TeamService) UpdateTeamMemberRoles(teamID string, userID string, newRoles string) (*model.TeamMember, error) {
	member, err := ts.store.GetMember(context.Background(), teamID, userID)
	if err != nil {
		return nil, err
	}

	if member == nil {
		return nil, NotTeamMemberError

	}

	schemeGuestRole, schemeUserRole, schemeAdminRole, err := ts.GetSchemeRolesForTeam(teamID)
	if err != nil {
		return nil, err
	}

	prevSchemeGuestValue := member.SchemeGuest

	var newExplicitRoles []string
	member.SchemeGuest = false
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		var role *model.Role
		role, err = ts.roleStore.GetByName(context.Background(), roleName)
		if err != nil {
			// err.StatusCode = http.StatusBadRequest
			return nil, RoleNotFoundError
		}
		if !role.SchemeManaged {
			// The role is not scheme-managed, so it's OK to apply it to the explicit roles field.
			newExplicitRoles = append(newExplicitRoles, roleName)
		} else {
			// The role is scheme-managed, so need to check if it is part of the scheme for this channel or not.
			switch roleName {
			case schemeAdminRole:
				member.SchemeAdmin = true
			case schemeUserRole:
				member.SchemeUser = true
			case schemeGuestRole:
				member.SchemeGuest = true
			default:
				// If not part of the scheme for this team, then it is not allowed to apply it as an explicit role.
				return nil, &ManagedRoleApplyError{role: roleName}
			}
		}
	}

	if member.SchemeGuest && member.SchemeUser {
		return nil, UserGuestRoleConflictError
	}

	if prevSchemeGuestValue != member.SchemeGuest {
		return nil, UpdateGuestRoleError
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	member, err = ts.store.UpdateMember(member)
	if err != nil {
		return nil, err
	}

	return member, nil
}

func (ts *TeamService) UpdateTeamMemberSchemeRoles(teamID string, userID string, isSchemeGuest, isSchemeUser, isSchemeAdmin, phase2MigrationCompleted bool) (*model.TeamMember, error) {
	member, err := ts.store.GetMember(context.Background(), teamID, userID)
	if err != nil {
		return nil, err
	}

	member.SchemeAdmin = isSchemeAdmin
	member.SchemeUser = isSchemeUser
	member.SchemeGuest = isSchemeGuest

	if member.SchemeUser && member.SchemeGuest {
		return nil, UserGuestRoleConflictError
	}

	// If the migration is not completed, we also need to check the default team_admin/team_user roles are not present in the roles field.
	if !phase2MigrationCompleted {
		member.ExplicitRoles = removeRoles([]string{model.TeamGuestRoleId, model.TeamUserRoleId, model.TeamAdminRoleId}, member.ExplicitRoles)
	}

	member, nErr := ts.store.UpdateMember(member)
	if nErr != nil {
		return nil, err
	}

	return member, nil
}

func (ts *TeamService) GetTeamByName(name string) (*model.Team, error) {
	return ts.store.GetByName(name)
}

func (ts *TeamService) GetTeamByInviteId(inviteId string) (*model.Team, error) {
	return ts.store.GetByInviteId(inviteId)
}

func (ts *TeamService) GetAllTeams() ([]*model.Team, error) {
	return ts.store.GetAll()
}

func (ts *TeamService) GetAllTeamsPage(offset int, limit int, opts *model.TeamSearch) ([]*model.Team, error) {
	return ts.store.GetAllPage(offset, limit, opts)
}

func (ts *TeamService) GetAllTeamsCount(opts *model.TeamSearch) (int64, error) {
	return ts.store.AnalyticsTeamCount(opts)
}

func (ts *TeamService) GetAllPrivateTeams() ([]*model.Team, error) {
	return ts.store.GetAllPrivateTeamListing()
}

func (ts *TeamService) GetAllPublicTeams() ([]*model.Team, error) {
	return ts.store.GetAllTeamListing()
}
