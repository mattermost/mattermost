// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

var (
	realisticFirstNames = []string{
		"James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
		"William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
		"Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
		"Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
		"Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
		"Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
		"Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
		"Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
		"Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
	}
	realisticLastNames = []string{
		"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
		"Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
		"Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
		"Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
		"Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
		"Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
		"Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
		"Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
	}
)

type AutoUserCreator struct {
	app            *app.App
	client         *model.Client4
	team           *model.Team
	EmailLength    utils.Range
	EmailCharset   string
	NameLength     utils.Range
	NameCharset    string
	Fuzzy          bool
	RealisticNames bool
	JoinTime       int64
}

func NewAutoUserCreator(a *app.App, client *model.Client4, team *model.Team) *AutoUserCreator {
	return &AutoUserCreator{
		app:            a,
		client:         client,
		team:           team,
		EmailLength:    UserEmailLen,
		EmailCharset:   utils.LOWERCASE,
		NameLength:     UserNameLen,
		NameCharset:    utils.LOWERCASE,
		Fuzzy:          false,
		RealisticNames: false,
		JoinTime:       0,
	}
}

// Basic test team and user so you always know one
func CreateBasicUser(rctx request.CTX, a *app.App, client *model.Client4) error {
	found, _, _ := client.TeamExists(context.Background(), BTestTeamName, "")
	if found {
		return nil
	}

	newteam := &model.Team{DisplayName: BTestTeamDisplayName, Name: BTestTeamName, Email: BTestTeamEmail, Type: BTestTeamType}
	basicteam, _, err := client.CreateTeam(context.Background(), newteam)
	if err != nil {
		return err
	}
	newuser := &model.User{Email: BTestUserEmail, Nickname: BTestUserName, Password: BTestUserPassword}
	ruser, _, err := client.CreateUser(context.Background(), newuser)
	if err != nil {
		return err
	}
	_, err = a.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	if err != nil {
		return model.NewAppError("CreateBasicUser", "app.user.verify_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, nErr := a.Srv().Store().Team().SaveMember(rctx, &model.TeamMember{TeamId: basicteam.Id, UserId: ruser.Id, CreateAt: model.GetMillis()}, *a.Config().TeamSettings.MaxUsersPerTeam); nErr != nil {
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

func randomRealisticName() (firstName, lastName, username string) {
	firstName = realisticFirstNames[rand.IntN(len(realisticFirstNames))]
	lastName = realisticLastNames[rand.IntN(len(realisticLastNames))]
	// Suffix keeps usernames unique while remaining human-readable.
	username = fmt.Sprintf("%s.%s.%d", strings.ToLower(firstName), strings.ToLower(lastName), rand.IntN(100000))
	return firstName, lastName, username
}

func (cfg *AutoUserCreator) createRandomUser(rctx request.CTX) (*model.User, error) {
	userEmail := "success+" + model.NewId() + "@simulator.amazonses.com"

	user := &model.User{
		Email:    userEmail,
		Password: UserPassword,
		CreateAt: cfg.JoinTime,
	}

	switch {
	case cfg.RealisticNames:
		firstName, lastName, username := randomRealisticName()
		user.FirstName = firstName
		user.LastName = lastName
		user.Username = username
		user.Nickname = firstName + " " + lastName
	case cfg.Fuzzy:
		user.Nickname = "a" + utils.FuzzName()
	default:
		user.Nickname = "a" + utils.RandomName(cfg.NameLength, cfg.NameCharset)
	}

	ruser, appErr := cfg.app.CreateUserWithInviteId(rctx, user, cfg.team.InviteId, "")
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
		teamMember, appErr := cfg.app.GetTeamMember(rctx, cfg.team.Id, ruser.Id)
		if appErr != nil {
			return nil, appErr
		}
		teamMember.CreateAt = cfg.JoinTime
		_, err := cfg.app.Srv().Store().Team().UpdateMember(rctx, teamMember)
		if err != nil {
			return nil, err
		}
	}

	return ruser, nil
}

func (cfg *AutoUserCreator) CreateTestUsers(rctx request.CTX, num utils.Range) ([]*model.User, error) {
	numUsers := utils.RandIntFromRange(num)
	users := make([]*model.User, numUsers)

	for i := range numUsers {
		var err error
		users[i], err = cfg.createRandomUser(rctx)
		if err != nil {
			return nil, err
		}
	}

	return users, nil
}
