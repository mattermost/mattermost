// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"context"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

// func (ts *SuiteService) CreateTeam(team *model.Team) (*model.Team, error) {
// 	team.InviteId = ""
// 	rteam, err := ts.platform.Store.Team().Save(team)
// 	if err != nil {
// 		return nil, err
// 	}

// 	if _, err := ts.createDefaultChannels(rteam.Id); err != nil {
// 		return nil, err
// 	}

// 	return rteam, nil
// }

func (s *SuiteService) getTeam(teamID string) (*model.Team, error) {
	team, err := s.platform.Store.Team().Get(teamID)
	if err != nil {
		return nil, err
	}

	return team, nil
}

func (s *SuiteService) getTeams(teamIDs []string) ([]*model.Team, error) {
	teams, err := s.platform.Store.Team().GetMany(teamIDs)
	if err != nil {
		return nil, err
	}

	return teams, nil
}

// CreateDefaultChannels creates channels in the given team for each channel returned by (*App).DefaultChannelNames.
func (s *SuiteService) createDefaultChannels(teamID string) ([]*model.Channel, error) {
	displayNames := map[string]string{
		"town-square": i18n.T("api.channel.create_default_channels.town_square"),
		"off-topic":   i18n.T("api.channel.create_default_channels.off_topic"),
	}
	channels := []*model.Channel{}
	defaultChannelNames := s.defaultChannelNames()
	for _, name := range defaultChannelNames {
		displayName := i18n.TDefault(displayNames[name], name)
		channel := &model.Channel{DisplayName: displayName, Name: name, Type: model.ChannelTypeOpen, TeamId: teamID}
		// We should use the channel service here (coming soon). Ideally, we should just emit an event
		// and let the subscribers do the job, in this case it would be the channels service.
		// Currently we are adding services to the server and because of that we are using
		// the channel store here. This should be replaced in the future.
		if _, err := s.platform.Store.Channel().Save(channel, *s.platform.Config().TeamSettings.MaxChannelsPerTeam); err != nil {
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

func (s *SuiteService) updateTeam(team *model.Team, opts UpdateOptions) (*model.Team, error) {
	oldTeam := team
	var err error

	if !opts.Imported {
		oldTeam, err = s.platform.Store.Team().Get(team.Id)
		if err != nil {
			return nil, err
		}

		if err = s.checkValidDomains(team); err != nil {
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

	oldTeam, err = s.platform.Store.Team().Update(oldTeam)
	if err != nil {
		return team, err
	}

	return oldTeam, nil
}

func (s *SuiteService) patchTeam(teamID string, patch *model.TeamPatch) (*model.Team, error) {
	team, err := s.platform.Store.Team().Get(teamID)
	if err != nil {
		return nil, err
	}

	team.Patch(patch)
	if patch.AllowOpenInvite != nil && !*patch.AllowOpenInvite {
		team.InviteId = model.NewId()
	}

	if err = s.checkValidDomains(team); err != nil {
		return nil, err
	}

	team, err = s.platform.Store.Team().Update(team)
	if err != nil {
		return team, err
	}

	return team, nil
}

// JoinUserToTeam adds a user to the team and it returns three values:
// 1. a pointer to the team member, if successful
// 2. a boolean: true if the user has a non-deleted team member for that team already, otherwise false.
// 3. a pointer to an AppError if something went wrong.
func (s *SuiteService) joinUserToTeam(team *model.Team, user *model.User) (*model.TeamMember, bool, error) {
	if !s.IsTeamEmailAllowed(user, team) {
		return nil, false, AcceptedDomainError
	}

	tm := &model.TeamMember{
		TeamId:      team.Id,
		UserId:      user.Id,
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
		CreateAt:    model.GetMillis(),
	}

	if !user.IsGuest() {
		userShouldBeAdmin, err := s.userIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
		if err != nil {
			return nil, false, err
		}
		tm.SchemeAdmin = userShouldBeAdmin
	}

	if team.Email == user.Email {
		tm.SchemeAdmin = true
	}

	rtm, err := s.platform.Store.Team().GetMember(context.Background(), team.Id, user.Id)
	if err != nil {
		// Membership appears to be missing. Lets try to add.
		tmr, nErr := s.platform.Store.Team().SaveMember(tm, *s.platform.Config().TeamSettings.MaxUsersPerTeam)
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

	membersCount, err := s.platform.Store.Team().GetActiveMemberCount(tm.TeamId, nil)
	if err != nil {
		return nil, false, MemberCountError
	}

	if membersCount >= int64(*s.platform.Config().TeamSettings.MaxUsersPerTeam) {
		return nil, false, MaxMemberCountError
	}

	member, nErr := s.platform.Store.Team().UpdateMember(tm)
	if nErr != nil {
		return nil, false, nErr
	}

	return member, false, nil
}

// RemoveTeamMember removes the team member from the team. This method sends
// the websocket message before actually removing so the user being removed gets it.
func (s *SuiteService) removeTeamMember(teamMember *model.TeamMember) error {
	message := model.NewWebSocketEvent(model.WebsocketEventLeaveTeam, teamMember.TeamId, "", "", nil, "")
	message.Add("user_id", teamMember.UserId)
	message.Add("team_id", teamMember.TeamId)
	s.platform.Publish(message)

	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if _, nErr := s.platform.Store.Team().UpdateMember(teamMember); nErr != nil {
		return nErr
	}

	return nil
}
