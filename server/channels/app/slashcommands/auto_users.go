// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/channels/app"
	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/channels/utils"
	"github.com/mattermost/mattermost-server/v6/model"
)

type AutoUserCreator struct {
	app          *app.App
	client       *model.Client4
	team         *model.Team
	EmailLength  utils.Range
	EmailCharset string
	NameLength   utils.Range
	NameCharset  string
	Fuzzy        bool
	JoinTime     int64
}

func NewAutoUserCreator(a *app.App, client *model.Client4, team *model.Team) *AutoUserCreator {
	return &AutoUserCreator{
		app:          a,
		client:       client,
		team:         team,
		EmailLength:  UserEmailLen,
		EmailCharset: utils.LOWERCASE,
		NameLength:   UserNameLen,
		NameCharset:  utils.LOWERCASE,
		Fuzzy:        false,
		JoinTime:     0,
	}
}

// Basic test team and user so you always know one
func CreateBasicUser(a *app.App, client *model.Client4) error {
	found, _, _ := client.TeamExists(BTestTeamName, "")
	if found {
		return nil
	}

	newteam := &model.Team{DisplayName: BTestTeamDisplayName, Name: BTestTeamName, Email: BTestTeamEmail, Type: BTestTeamType}
	basicteam, _, err := client.CreateTeam(newteam)
	if err != nil {
		return err
	}
	newuser := &model.User{Email: BTestUserEmail, Nickname: BTestUserName, Password: BTestUserPassword}
	ruser, _, err := client.CreateUser(newuser)
	if err != nil {
		return err
	}
	_, err = a.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return model.NewAppError("CreateBasicUser", "app.user.verify_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, nErr := a.Srv().Store().Team().SaveMember(&model.TeamMember{TeamId: basicteam.Id, UserId: ruser.Id, CreateAt: model.GetMillis()}, *a.Config().TeamSettings.MaxUsersPerTeam); nErr != nil {
		var appErr *model.AppError
		var conflictErr *store.ErrConflict
		var limitExceededErr *store.ErrLimitExceeded
		switch {
		case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
			return appErr
		case errors.As(nErr, &conflictErr):
			return model.NewAppError("CreateBasicUser", "app.create_basic_user.save_member.conflict.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &limitExceededErr):
			return model.NewAppError("CreateBasicUser", "app.create_basic_user.save_member.max_accounts.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		default: // last fallback in case it doesn't map to an existing app error.
			return model.NewAppError("CreateBasicUser", "app.create_basic_user.save_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return nil
}

func (cfg *AutoUserCreator) createRandomUser(c request.CTX) (*model.User, error) {
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
		Password: UserPassword,
		CreateAt: cfg.JoinTime,
	}

	ruser, appErr := cfg.app.CreateUserWithInviteId(c, user, cfg.team.InviteId, "")
	if appErr != nil {
		return nil, appErr
	}

	status := &model.Status{
		UserId:         ruser.Id,
		Status:         model.StatusOnline,
		Manual:         false,
		LastActivityAt: ruser.CreateAt,
		ActiveChannel:  "",
	}
	if err := cfg.app.Srv().Store().Status().SaveOrUpdate(status); err != nil {
		return nil, err
	}

	// We need to cheat to verify the user's email
	_, err := cfg.app.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return nil, err
	}

	if cfg.JoinTime != 0 {
		teamMember, appErr := cfg.app.GetTeamMember(cfg.team.Id, ruser.Id)
		if appErr != nil {
			return nil, appErr
		}
		teamMember.CreateAt = cfg.JoinTime
		_, err := cfg.app.Srv().Store().Team().UpdateMember(teamMember)
		if err != nil {
			return nil, err
		}
	}

	return ruser, nil
}

func (cfg *AutoUserCreator) CreateTestUsers(c request.CTX, num utils.Range) ([]*model.User, error) {
	numUsers := utils.RandIntFromRange(num)
	users := make([]*model.User, numUsers)

	for i := 0; i < numUsers; i++ {
		var err error
		users[i], err = cfg.createRandomUser(c)
		if err != nil {
			return nil, err
		}
	}

	return users, nil
}
