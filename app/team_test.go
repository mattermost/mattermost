// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"fmt"

	"sync/atomic"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := th.App.CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

	if _, err := th.App.CreateTeam(th.BasicTeam); err == nil {
		t.Fatal("Should not create a new team - team already exist")
	}
}

func TestCreateTeamWithUser(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := th.App.CreateTeamWithUser(team, th.BasicUser.Id); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team with existing user")
	}

	if _, err := th.App.CreateTeamWithUser(team, model.NewId()); err == nil {
		t.Fatal("Should not create a new team - user does not exist")
	}

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	id = model.NewId()
	team2 := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success2+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	//Fail to create a team with user when user has set email without domain
	if _, err := th.App.CreateTeamWithUser(team2, ruser.Id); err == nil {
		t.Log(err.Message)
		t.Fatal("Should not create a team with user when user has set email without domain")
	} else {
		if err.Id != "model.team.is_valid.email.app_error" {
			t.Log(err)
			t.Fatal("Invalid error message")
		}
	}
}

func TestUpdateTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.BasicTeam.DisplayName = "Testing 123"

	if updatedTeam, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
		t.Log(err)
		t.Fatal("Should update the team")
	} else {
		if updatedTeam.DisplayName != "Testing 123" {
			t.Fatal("Wrong Team DisplayName")
		}
	}
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestAddUserToTeamByTeamId(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	if err := th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	team, err := th.App.CreateTeam(&model.Team{
		DisplayName: "deletion-test",
		Name:        "deletion-test",
		Email:       "foo@foo.com",
		Type:        model.TEAM_OPEN,
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		th.App.PermanentDeleteTeam(team)
	}()

	command, err := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team.Id,
		Trigger:   "foo",
		URL:       "http://foo",
		Method:    model.COMMAND_METHOD_POST,
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteCommand(command.Id)

	if command, err = th.App.GetCommand(command.Id); command == nil || err != nil {
		t.Fatal("unable to get new command")
	}

	if err := th.App.PermanentDeleteTeam(team); err != nil {
		t.Fatal(err.Error())
	}

	if command, err = th.App.GetCommand(command.Id); command != nil || err == nil {
		t.Fatal("command wasn't deleted")
	}

	// Test deleting a team with no channels.
	team = th.CreateTeam()
	defer func() {
		th.App.PermanentDeleteTeam(team)
	}()

	if channels, err := th.App.GetPublicChannelsForTeam(team.Id, 0, 1000); err != nil {
		t.Fatal(err)
	} else {
		for _, channel := range *channels {
			if err2 := th.App.PermanentDeleteChannel(channel); err2 != nil {
				t.Fatal(err)
			}
		}
	}

	if err := th.App.PermanentDeleteTeam(team); err != nil {
		t.Fatal(err)
	}
}

func TestSanitizeTeam(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	team := &model.Team{
		Id:             model.NewId(),
		Email:          th.MakeEmail(),
		AllowedDomains: "example.com",
	}
	copyTeam := func() *model.Team {
		copy := &model.Team{}
		*copy = *team
		return copy
	}

	t.Run("not a user of the team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("user of the team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})

	t.Run("team admin of another team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("system admin, not a user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})

	t.Run("system admin, user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})
}

func TestSanitizeTeams(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	t.Run("not a system admin", func(t *testing.T) {
		teams := []*model.Team{
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
		}

		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
				{
					UserId: userId,
					TeamId: teams[1].Id,
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeams(session, teams)

		if sanitized[0].Email != "" && sanitized[0].AllowedDomains != "" {
			t.Fatal("should've sanitized first team")
		}

		if sanitized[1].Email == "" && sanitized[1].AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized second team")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		teams := []*model.Team{
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
		}

		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeams(session, teams)

		if sanitized[0].Email == "" && sanitized[0].AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized first team")
		}

		if sanitized[1].Email == "" && sanitized[1].AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized second team")
		}
	})
}

func TestAddUserToTeamByHashMismatchedInviteId(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	teamId := model.NewId()
	userId := model.NewId()
	inviteSalt := model.NewId()

	inviteId := model.NewId()
	teamInviteId := model.NewId()

	// generate a fake email invite - stolen from SendInviteEmails() in email.go
	props := make(map[string]string)
	props["email"] = model.NewId() + "@mattermost.com"
	props["id"] = teamId
	props["display_name"] = model.NewId()
	props["name"] = model.NewId()
	props["time"] = fmt.Sprintf("%v", model.GetMillis())
	props["invite_id"] = inviteId
	data := model.MapToJson(props)
	hash := utils.HashSha256(fmt.Sprintf("%v:%v", data, inviteSalt))

	// when the server tries to validate the invite, it will pull the user from our mock store
	// this can return nil, because we'll fail before we get to trying to use it
	mockStore.UserStore.On("Get", userId).Return(
		storetest.NewStoreChannel(store.StoreResult{
			Data: nil,
			Err:  nil,
		}),
	)

	// the server will also pull the team. the one we return has a different invite id than the one in the email invite we made above
	mockStore.TeamStore.On("Get", teamId).Return(
		storetest.NewStoreChannel(store.StoreResult{
			Data: &model.Team{
				InviteId: teamInviteId,
			},
			Err: nil,
		}),
	)

	app := App{
		Srv: &Server{
			Store: mockStore,
		},
		config: atomic.Value{},
	}
	app.config.Store(&model.Config{
		EmailSettings: model.EmailSettings{
			InviteSalt: inviteSalt,
		},
	})

	// this should fail because the invite ids are mismatched
	team, err := app.AddUserToTeamByHash(userId, hash, data)
	assert.Nil(t, team)
	assert.Equal(t, "api.user.create_user.signup_link_mismatched_invite_id.app_error", err.Id)
}

func TestJoinUserToTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := th.App.CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

	maxUsersPerTeam := th.App.Config().TeamSettings.MaxUsersPerTeam
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = maxUsersPerTeam })
		th.App.SetDefaultRolesBasedOnConfig()
		th.App.PermanentDeleteTeam(team)
	}()
	one := 1
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = &one })

	t.Run("new join", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); alreadyAdded || err != nil {
			t.Fatal("Should return already added equal to false and no error")
		}
	})

	t.Run("join when you are a member", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)
		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); !alreadyAdded || err != nil {
			t.Fatal("Should return already added and no error")
		}
	})

	t.Run("re-join after leaving", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)
		th.App.LeaveTeam(team, ruser, ruser.Id)
		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); alreadyAdded || err != nil {
			t.Fatal("Should return already added equal to false and no error")
		}
	})

	t.Run("new join with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)
		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)
		th.App.joinUserToTeam(team, ruser1)
		if _, _, err := th.App.joinUserToTeam(team, ruser2); err == nil {
			t.Fatal("Should fail")
		}
	})

	t.Run("re-join alfter leaving with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)
		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)

		th.App.joinUserToTeam(team, ruser1)
		th.App.LeaveTeam(team, ruser1, ruser1.Id)
		th.App.joinUserToTeam(team, ruser2)
		if _, _, err := th.App.joinUserToTeam(team, ruser1); err == nil {
			t.Fatal("Should fail")
		}
	})
}
