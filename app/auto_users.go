// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type AutoUserCreator struct {
	app          *App
	client       *model.Client4
	team         *model.Team
	EmailLength  utils.Range
	EmailCharset string
	NameLength   utils.Range
	NameCharset  string
	Fuzzy        bool
}

func NewAutoUserCreator(a *App, client *model.Client4, team *model.Team) *AutoUserCreator {
	return &AutoUserCreator{
		app:          a,
		client:       client,
		team:         team,
		EmailLength:  USER_EMAIL_LEN,
		EmailCharset: utils.LOWERCASE,
		NameLength:   USER_NAME_LEN,
		NameCharset:  utils.LOWERCASE,
		Fuzzy:        false,
	}
}

// Basic test team and user so you always know one
func (a *App) CreateBasicUser(client *model.Client4) *model.AppError {
	found, _ := client.TeamExists(BTEST_TEAM_NAME, "")
	if !found {
		newteam := &model.Team{DisplayName: BTEST_TEAM_DISPLAY_NAME, Name: BTEST_TEAM_NAME, Email: BTEST_TEAM_EMAIL, Type: BTEST_TEAM_TYPE}
		basicteam, resp := client.CreateTeam(newteam)
		if resp.Error != nil {
			return resp.Error
		}
		newuser := &model.User{Email: BTEST_USER_EMAIL, Nickname: BTEST_USER_NAME, Password: BTEST_USER_PASSWORD}
		ruser, resp := client.CreateUser(newuser)
		if resp.Error != nil {
			return resp.Error
		}
		store.Must(a.Srv.Store.User().VerifyEmail(ruser.Id))
		store.Must(a.Srv.Store.Team().SaveMember(&model.TeamMember{TeamId: basicteam.Id, UserId: ruser.Id}, *a.Config().TeamSettings.MaxUsersPerTeam))
	}
	return nil
}

func (cfg *AutoUserCreator) createRandomUser() (*model.User, bool) {
	var userEmail string
	var userName string
	if cfg.Fuzzy {
		userEmail = "success+" + model.NewId() + "@simulator.amazonses.com"
		userName = utils.FuzzName()
	} else {
		userEmail = "success+" + model.NewId() + "@simulator.amazonses.com"
		userName = utils.RandomName(cfg.NameLength, cfg.NameCharset)
	}

	user := &model.User{
		Email:    userEmail,
		Nickname: userName,
		Password: USER_PASSWORD}

	ruser, resp := cfg.client.CreateUserWithInviteId(user, cfg.team.InviteId)
	if resp.Error != nil {
		mlog.Error(resp.Error.Error())
		return nil, false
	}

	status := &model.Status{UserId: ruser.Id, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	if result := <-cfg.app.Srv.Store.Status().SaveOrUpdate(status); result.Err != nil {
		mlog.Error(result.Err.Error())
		return nil, false
	}

	// We need to cheat to verify the user's email
	store.Must(cfg.app.Srv.Store.User().VerifyEmail(ruser.Id))

	return ruser, true
}

func (cfg *AutoUserCreator) CreateTestUsers(num utils.Range) ([]*model.User, bool) {
	numUsers := utils.RandIntFromRange(num)
	users := make([]*model.User, numUsers)

	for i := 0; i < numUsers; i++ {
		var err bool
		users[i], err = cfg.createRandomUser()
		if !err {
			return users, false
		}
	}

	return users, true
}
