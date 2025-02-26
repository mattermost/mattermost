// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (ts *TeamService) CreateTeam(rctx request.CTX, team *model.Team) (*model.Team, error) {
	team.InviteId = ""
	rteam, err := ts.store.Save(team)
	if err != nil {
		return nil, err
	}

	if _, err := ts.createDefaultChannels(rctx, rteam.Id); err != nil {
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

func (ts *TeamService) GetTeams(teamIDs []string) ([]*model.Team, error) {
	teams, err := ts.store.GetMany(teamIDs)
	if err != nil {
		return nil, err
	}

	return teams, nil
}

// CreateDefaultChannels creates channels in the given team for each channel returned by (*App).DefaultChannelNames.
func (ts *TeamService) createDefaultChannels(rctx request.CTX, teamID string) ([]*model.Channel, error) {
	displayNames := map[string]string{
		"town-square": i18n.T("api.channel.create_default_channels.town_square"),
		"off-topic":   i18n.T("api.channel.create_default_channels.off_topic"),
	}
	channels := []*model.Channel{}
	defaultChannelNames := ts.DefaultChannelNames()
	for _, name := range defaultChannelNames {
		var displayName string
		if displayNameValue, ok := displayNames[name]; ok {
			displayName = i18n.TDefault(displayNameValue, name)
		} else {
			// If the default channel is experimental (from config.json)
			// we don't have to translate
			displayName = name
		}
		channel := &model.Channel{DisplayName: displayName, Name: name, Type: model.ChannelTypeOpen, TeamId: teamID}
		// We should use the channel service here (coming soon). Ideally, we should just emit an event
		// and let the subscribers do the job, in this case it would be the channels service.
		// Currently we are adding services to the server and because of that we are using
		// the channel store here. This should be replaced in the future.
		if _, err := ts.channelStore.Save(rctx, channel, *ts.config().TeamSettings.MaxChannelsPerTeam); err != nil {
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
// 3. a pointer to an AppError if something went wrong.
func (ts *TeamService) JoinUserToTeam(rctx request.CTX, team *model.Team, user *model.User) (*model.TeamMember, bool, error) {
	if !ts.IsTeamEmailAllowed(user, team) {
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
		userShouldBeAdmin, err := ts.userIsInAdminRoleGroup(user.Id, team.Id, model.GroupSyncableTypeTeam)
		if err != nil {
			return nil, false, err
		}
		tm.SchemeAdmin = userShouldBeAdmin
	}

	if team.Email == user.Email {
		tm.SchemeAdmin = true
	}

	rtm, err := ts.store.GetMember(rctx, team.Id, user.Id)
	if err != nil {
		// Membership appears to be missing. Lets try to add.
		tmr, nErr := ts.store.SaveMember(rctx, tm, *ts.config().TeamSettings.MaxUsersPerTeam)
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

	member, nErr := ts.store.UpdateMember(rctx, tm)
	if nErr != nil {
		return nil, false, nErr
	}

	return member, false, nil
}

// RemoveTeamMember removes the team member from the team. This method sends
// the websocket message before actually removing so the user being removed gets it.
func (ts *TeamService) RemoveTeamMember(rctx request.CTX, teamMember *model.TeamMember) error {
	/*
		MM-43850: send leave_team event to user using `ReliableClusterSend` to improve safety
	*/
	// message for other team members
	omitUsers := make(map[string]bool, 1)
	omitUsers[teamMember.UserId] = true
	messageTeam := model.NewWebSocketEvent(model.WebsocketEventLeaveTeam, teamMember.TeamId, "", "", omitUsers, "")
	messageTeam.Add("user_id", teamMember.UserId)
	messageTeam.Add("team_id", teamMember.TeamId)
	ts.wh.Publish(messageTeam)

	// message for teamMember.UserId
	messageUser := model.NewWebSocketEvent(model.WebsocketEventLeaveTeam, "", "", teamMember.UserId, nil, "")
	messageUser.Add("user_id", teamMember.UserId)
	messageUser.Add("team_id", teamMember.TeamId)

	ts.wh.Publish(messageUser)

	// delete team member
	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if _, nErr := ts.store.UpdateMember(rctx, teamMember); nErr != nil {
		return nErr
	}

	return nil
}

// GetMember return the team member from the team.
func (ts *TeamService) GetMember(c request.CTX, teamID string, userID string) (*model.TeamMember, error) {
	member, err := ts.store.GetMember(c, teamID, userID)
	if err != nil {
		return nil, err
	}

	return member, err
}
