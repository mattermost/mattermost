// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	if result := <-Srv.Store.Team().Save(team); result.Err != nil {
		return nil, result.Err
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(rteam.Id); err != nil {
			return nil, err
		}

		return rteam, nil
	}
}

func JoinUserToTeamById(teamId string, user *model.User) *model.AppError {
	if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
		return result.Err
	} else {
		return JoinUserToTeam(result.Data.(*model.Team), user)
	}
}

func JoinUserToTeam(team *model.Team, user *model.User) *model.AppError {

	tm := &model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
		Roles:  model.ROLE_TEAM_USER.Id,
	}

	channelRole := model.ROLE_CHANNEL_USER.Id

	if team.Email == user.Email {
		tm.Roles = model.ROLE_TEAM_USER.Id + " " + model.ROLE_TEAM_ADMIN.Id
		channelRole = model.ROLE_CHANNEL_USER.Id + " " + model.ROLE_CHANNEL_ADMIN.Id
	}

	if etmr := <-Srv.Store.Team().GetMember(team.Id, user.Id); etmr.Err == nil {
		// Membership alredy exists.  Check if deleted and and update, otherwise do nothing
		rtm := etmr.Data.(model.TeamMember)

		// Do nothing if already added
		if rtm.DeleteAt == 0 {
			return nil
		}

		if tmr := <-Srv.Store.Team().UpdateMember(tm); tmr.Err != nil {
			return tmr.Err
		}
	} else {
		// Membership appears to be missing.  Lets try to add.
		if tmr := <-Srv.Store.Team().SaveMember(tm); tmr.Err != nil {
			return tmr.Err
		}
	}

	if uua := <-Srv.Store.User().UpdateUpdateAt(user.Id); uua.Err != nil {
		return uua.Err
	}

	// Soft error if there is an issue joining the default channels
	if err := JoinDefaultChannels(team.Id, user, channelRole); err != nil {
		l4g.Error(utils.T("api.user.create_user.joining.error"), user.Id, team.Id, err)
	}

	RemoveAllSessionsForUserId(user.Id)
	InvalidateCacheForUser(user.Id)

	return nil
}
