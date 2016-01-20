// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type AutoUserCreator struct {
	client       *model.Client
	teamID       string
	EmailLength  utils.Range
	EmailCharset string
	NameLength   utils.Range
	NameCharset  string
	Fuzzy        bool
}

func NewAutoUserCreator(client *model.Client, teamID string) *AutoUserCreator {
	return &AutoUserCreator{
		client:       client,
		teamID:       teamID,
		EmailLength:  USER_EMAIL_LEN,
		EmailCharset: utils.LOWERCASE,
		NameLength:   USER_NAME_LEN,
		NameCharset:  utils.LOWERCASE,
		Fuzzy:        false,
	}
}

// Basic test team and user so you always know one
func CreateBasicUser(client *model.Client) *model.AppError {
	result, _ := client.FindTeamByName(BTEST_TEAM_NAME, true)
	if result.Data.(bool) == false {
		newteam := &model.Team{DisplayName: BTEST_TEAM_DISPLAY_NAME, Name: BTEST_TEAM_NAME, Email: BTEST_TEAM_EMAIL, Type: BTEST_TEAM_TYPE}
		result, err := client.CreateTeam(newteam)
		if err != nil {
			return err
		}
		basicteam := result.Data.(*model.Team)
		newuser := &model.User{TeamId: basicteam.Id, Email: BTEST_USER_EMAIL, Nickname: BTEST_USER_NAME, Password: BTEST_USER_PASSWORD}
		result, err = client.CreateUser(newuser, "")
		if err != nil {
			return err
		}
		store.Must(Srv.Store.User().VerifyEmail(result.Data.(*model.User).Id))
	}
	return nil
}

func (cfg *AutoUserCreator) createRandomUser() (*model.User, bool) {
	var userEmail string
	var userName string
	if cfg.Fuzzy {
		userEmail = utils.RandString(FUZZ_USER_EMAIL_PREFIX_LEN, utils.LOWERCASE) + "-" + utils.FuzzEmail()
		userName = utils.FuzzName()
	} else {
		userEmail = utils.RandomEmail(cfg.EmailLength, cfg.EmailCharset)
		userName = utils.RandomName(cfg.NameLength, cfg.NameCharset)
	}

	user := &model.User{
		TeamId:   cfg.teamID,
		Email:    userEmail,
		Nickname: userName,
		Password: USER_PASSWORD}

	result, err := cfg.client.CreateUser(user, "")
	if err != nil {
		return nil, false
	}
	// We need to cheat to verify the user's email
	store.Must(Srv.Store.User().VerifyEmail(result.Data.(*model.User).Id))
	return result.Data.(*model.User), true
}

func (cfg *AutoUserCreator) CreateTestUsers(num utils.Range) ([]*model.User, bool) {
	numUsers := utils.RandIntFromRange(num)
	users := make([]*model.User, numUsers)

	for i := 0; i < numUsers; i++ {
		var err bool
		users[i], err = cfg.createRandomUser()
		if err != true {
			return users, false
		}
	}

	return users, true
}
