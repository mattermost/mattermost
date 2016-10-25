// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"strings"
	"testing"
)

func TestSignupTeam(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	_, err := Client.SignupTeam("test@nowhere.com", "name")
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreateFromSignupTeam(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	props := make(map[string]string)
	props["email"] = strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com"
	props["name"] = "Test Company name"
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	user := model.User{Email: props["email"], Nickname: "Corey Hulen", Password: "hello1"}

	ts := model.TeamSignup{Team: team, User: user, Invites: []string{"success+test@simulator.amazonses.com"}, Data: data, Hash: hash}

	rts, err := Client.CreateTeamFromSignup(&ts)
	if err != nil {
		t.Fatal(err)
	}

	if rts.Data.(*model.TeamSignup).Team.DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	ruser := rts.Data.(*model.TeamSignup).User
	rteam := rts.Data.(*model.TeamSignup).Team
	Client.SetTeamId(rteam.Id)

	if result, err := Client.LoginById(ruser.Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	if len(*c1) != 2 {
		t.Fatal("default channels not created")
	}

	ts.Data = "garbage"
	_, err = Client.CreateTeamFromSignup(&ts)
	if err == nil {
		t.Fatal(err)
	}
}

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, err := Client.CreateTeam(&team)
	if err != nil {
		t.Fatal(err)
	}

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, rteam.Data.(*model.Team))
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(rteam.Data.(*model.Team).Id)

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	if len(*c1) != 2 {
		t.Fatal("default channels not created")
	}

	if rteam.Data.(*model.Team).DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	if _, err := Client.CreateTeam(rteam.Data.(*model.Team)); err == nil {
		t.Fatal("Cannot create an existing")
	}

	rteam.Data.(*model.Team).Id = ""
	if _, err := Client.CreateTeam(rteam.Data.(*model.Team)); err != nil {
		if err.Message != "A team with that domain already exists" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/teams/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	props := make(map[string]string)
	props["email"] = strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com"
	props["name"] = "Test Company name"
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: props["email"], Type: model.TEAM_OPEN}
	user := model.User{Email: props["email"], Nickname: "Corey Hulen", Password: "hello1"}

	ts := model.TeamSignup{Team: team, User: user, Invites: []string{"success+test@simulator.amazonses.com"}, Data: data, Hash: hash}

	rts, err := Client.CreateTeamFromSignup(&ts)
	if err != nil {
		t.Fatal(err)
	}

	if rts.Data.(*model.TeamSignup).Team.DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	ruser := rts.Data.(*model.TeamSignup).User
	rteam := rts.Data.(*model.TeamSignup).Team
	Client.SetTeamId(rteam.Id)

	if result, err := Client.LoginById(ruser.Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	user2 := th.CreateUser(th.BasicClient)
	if result, err := th.BasicClient.AddUserToTeam("", user2.Id); err != nil {
		t.Fatal(err)
	} else {
		rm := result.Data.(map[string]string)
		if rm["user_id"] != user2.Id {
			t.Fatal("email's didn't match")
		}
	}
}

func TestRemoveUserFromTeam(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()

	if _, err := th.BasicClient.RemoveUserFromTeam(th.SystemAdminTeam.Id, th.SystemAdminUser.Id); err == nil {
		t.Fatal("should fail not enough permissions")
	} else {
		if err.Id != "api.context.permissions.app_error" {
			t.Fatal("wrong error. Got: " + err.Id)
		}
	}

	if _, err := th.BasicClient.RemoveUserFromTeam("", th.SystemAdminUser.Id); err == nil {
		t.Fatal("should fail not enough permissions")
	} else {
		if err.Id != "api.context.permissions.app_error" {
			t.Fatal("wrong error")
		}
	}

	if _, err := th.BasicClient.RemoveUserFromTeam("", th.BasicUser.Id); err != nil {
		t.Fatal("should have removed the user from the team")
	}

	th.BasicClient.Logout()
	th.LoginSystemAdmin()

	th.SystemAdminClient.Must(th.SystemAdminClient.AddUserToTeam(th.BasicTeam.Id, th.BasicUser.Id))

	if _, err := th.SystemAdminClient.RemoveUserFromTeam(th.BasicTeam.Id, th.BasicUser.Id); err != nil {
		t.Fatal("should have removed the user from the team")
	}
}

func TestAddUserToTeamFromInvite(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	props := make(map[string]string)
	props["email"] = strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com"
	props["name"] = "Test Company name"
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: props["email"], Type: model.TEAM_OPEN}
	user := model.User{Email: props["email"], Nickname: "Corey Hulen", Password: "hello1"}

	ts := model.TeamSignup{Team: team, User: user, Invites: []string{"success+test@simulator.amazonses.com"}, Data: data, Hash: hash}

	rts, err := Client.CreateTeamFromSignup(&ts)
	if err != nil {
		t.Fatal(err)
	}

	if rts.Data.(*model.TeamSignup).Team.DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	ruser := rts.Data.(*model.TeamSignup).User
	rteam := rts.Data.(*model.TeamSignup).Team
	Client.SetTeamId(rteam.Id)

	if result, err := Client.LoginById(ruser.Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	user2 := th.CreateUser(th.BasicClient)
	Client.Must(Client.Logout())
	Client.Must(Client.Login(user2.Email, user2.Password))

	if result, err := th.BasicClient.AddUserToTeamFromInvite("", "", rteam.InviteId); err != nil {
		t.Fatal(err)
	} else {
		rtm := result.Data.(*model.Team)
		if rtm.Id != rteam.Id {
			t.Fatal()
		}
	}
}

func TestGetAllTeams(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, team)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if r1, err := Client.GetAllTeams(); err != nil {
		t.Fatal(err)
	} else if teams := r1.Data.(map[string]*model.Team); len(teams) != 1 {
		t.Fatal("non admin users only get the teams that they're a member of")
	} else if receivedTeam, ok := teams[team.Id]; !ok || receivedTeam.Id != team.Id {
		t.Fatal("should've received team that the user is a member of")
	}

	if r1, err := th.SystemAdminClient.GetAllTeams(); err != nil {
		t.Fatal(err)
	} else if teams := r1.Data.(map[string]*model.Team); len(teams) == 1 {
		t.Fatal("admin users should receive all teams")
	} else if receivedTeam, ok := teams[team.Id]; !ok || receivedTeam.Id != team.Id {
		t.Fatal("admin should've received team that they aren't a member of")
	}
}

func TestGetAllTeamListings(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN, AllowOpenInvite: true}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, team)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if r1, err := Client.GetAllTeamListings(); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal()
		}
		if teams[team.Id].Email != "" {
			t.Fatal("Non admin users shoudn't get full listings")
		}
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateUserRoles(c, user, model.ROLE_SYSTEM_ADMIN.Id)

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if r1, err := Client.GetAllTeams(); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal()
		}
		if teams[team.Id].Email != team.Email {
			t.Fatal()
		}
	}
}

func TestTeamPermDelete(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	LinkUserToTeam(user1, team)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.Login(user1.Email, "passwd1")
	Client.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "test"

	err := PermanentDeleteTeam(c, team)
	if err != nil {
		t.Fatal(err)
	}

	Client.ClearOAuthToken()
}

func TestInviteMembers(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	th.BasicClient.Logout()
	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, team)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	invite := make(map[string]string)
	invite["email"] = "success+" + model.NewId() + "@simulator.amazonses.com"
	invite["first_name"] = "Test"
	invite["last_name"] = "Guy"
	invites := &model.Invites{Invites: []map[string]string{invite}}
	invites.Invites = append(invites.Invites, invite)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	invites2 := &model.Invites{Invites: []map[string]string{}}
	if _, err := Client.InviteMembers(invites2); err == nil {
		t.Fatal("Should have errored out on no invites to send")
	}

	restrictTeamInvite := *utils.Cfg.TeamSettings.RestrictTeamInvite
	defer func() {
		*utils.Cfg.TeamSettings.RestrictTeamInvite = restrictTeamInvite
		utils.SetDefaultRolesBasedOnConfig()
	}()
	*utils.Cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_TEAM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	th.LoginBasic2()
	LinkUserToTeam(th.BasicUser2, team)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	isLicensed := utils.IsLicensed
	defer func() {
		utils.IsLicensed = isLicensed
	}()
	utils.IsLicensed = true

	if _, err := Client.InviteMembers(invites); err == nil {
		t.Fatal("should have errored not team admin and licensed")
	}

	UpdateUserToTeamAdmin(th.BasicUser2, team)
	Client.Logout()
	th.LoginBasic2()
	Client.SetTeamId(team.Id)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	*utils.Cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_SYSTEM_ADMIN
	utils.SetDefaultRolesBasedOnConfig()

	if _, err := Client.InviteMembers(invites); err == nil {
		t.Fatal("should have errored not system admin and licensed")
	}

	LinkUserToTeam(th.SystemAdminUser, team)

	if _, err := SystemAdminClient.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateTeamDisplayName(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{Email: team.Email, Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, team)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	LinkUserToTeam(user2, team)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	vteam := &model.Team{DisplayName: team.DisplayName, Name: team.Name, Email: team.Email, Type: team.Type}
	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	Client.Login(user.Email, "passwd1")

	vteam.DisplayName = ""
	if _, err := Client.UpdateTeam(vteam); err == nil {
		t.Fatal("Should have errored, empty name")
	}

	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam); err != nil {
		t.Fatal(err)
	}
}

func TestFuzzyTeamCreate(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	for i := 0; i < len(utils.FUZZY_STRINGS_NAMES) || i < len(utils.FUZZY_STRINGS_EMAILS); i++ {
		testDisplayName := "Name"
		testEmail := "test@nowhere.com"

		if i < len(utils.FUZZY_STRINGS_NAMES) {
			testDisplayName = utils.FUZZY_STRINGS_NAMES[i]
		}
		if i < len(utils.FUZZY_STRINGS_EMAILS) {
			testEmail = utils.FUZZY_STRINGS_EMAILS[i]
		}

		team := model.Team{DisplayName: testDisplayName, Name: "z-z-" + model.NewId() + "a", Email: testEmail, Type: model.TEAM_OPEN}

		_, err := Client.CreateTeam(&team)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetMyTeam(t *testing.T) {
	th := Setup().InitBasic()
	th.BasicClient.Logout()
	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(team)
	team = rteam.Data.(*model.Team)

	user := model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.Login(user.Email, user.Password)
	Client.SetTeamId(team.Id)

	if result, err := Client.GetMyTeam(""); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.Team).DisplayName != team.DisplayName {
			t.Fatal("team names did not match")
		}
		if result.Data.(*model.Team).Name != team.Name {
			t.Fatal("team domains did not match")
		}
		if result.Data.(*model.Team).Type != team.Type {
			t.Fatal("team types did not match")
		}
	}
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup().InitBasic()

	if result, err := th.BasicClient.GetTeamMembers(th.BasicTeam.Id, 0, 100); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.([]*model.TeamMember)
		if len(members) == 0 {
			t.Fatal("should have results")
		}
	}

	if _, err := th.BasicClient.GetTeamMembers("junk", 0, 100); err == nil {
		t.Fatal("should have errored - bad team id")
	}
}

func TestGetTeamMember(t *testing.T) {
	th := Setup().InitBasic()

	if result, err := th.BasicClient.GetTeamMember(th.BasicTeam.Id, th.BasicUser.Id); err != nil {
		t.Fatal(err)
	} else {
		member := result.Data.(*model.TeamMember)
		if member == nil {
			t.Fatal("should be valid")
		}
	}

	if _, err := th.BasicClient.GetTeamMember("junk", th.BasicUser.Id); err == nil {
		t.Fatal("should have errored - bad team id")
	}

	if _, err := th.BasicClient.GetTeamMember(th.BasicTeam.Id, ""); err == nil {
		t.Fatal("should have errored - blank user id")
	}

	if _, err := th.BasicClient.GetTeamMember(th.BasicTeam.Id, "junk"); err == nil {
		t.Fatal("should have errored - bad user id")
	}

	if _, err := th.BasicClient.GetTeamMember(th.BasicTeam.Id, "12345678901234567890123456"); err == nil {
		t.Fatal("should have errored - bad user id")
	}
}

func TestGetTeamMembersByIds(t *testing.T) {
	th := Setup().InitBasic()

	if result, err := th.BasicClient.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id}); err != nil {
		t.Fatal(err)
	} else {
		member := result.Data.([]*model.TeamMember)[0]
		if member.UserId != th.BasicUser.Id {
			t.Fatal("user id did not match")
		}
		if member.TeamId != th.BasicTeam.Id {
			t.Fatal("team id did not match")
		}
	}

	if result, err := th.BasicClient.GetTeamMembersByIds(th.BasicTeam.Id, []string{th.BasicUser.Id, th.BasicUser2.Id, model.NewId()}); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.([]*model.TeamMember)
		if len(members) != 2 {
			t.Fatal("length should have been 2")
		}
	}

	if _, err := th.BasicClient.GetTeamMembersByIds("junk", []string{th.BasicUser.Id}); err == nil {
		t.Fatal("should have errored - bad team id")
	}

	if _, err := th.BasicClient.GetTeamMembersByIds(th.BasicTeam.Id, []string{}); err == nil {
		t.Fatal("should have errored - empty user ids")
	}
}

func TestUpdateTeamMemberRoles(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	th.SystemAdminClient.SetTeamId(th.BasicTeam.Id)
	LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

	const BASIC_MEMBER = "team_user"
	const TEAM_ADMIN = "team_user team_admin"

	// user 1 trying to promote user 2
	if _, err := th.BasicClient.UpdateTeamRoles(th.BasicUser2.Id, TEAM_ADMIN); err == nil {
		t.Fatal("Should have errored, not team admin")
	}

	// user 1 trying to promote themselves
	if _, err := th.BasicClient.UpdateTeamRoles(th.BasicUser.Id, TEAM_ADMIN); err == nil {
		t.Fatal("Should have errored, not team admin")
	}

	// user 1 trying to demote someone
	if _, err := th.BasicClient.UpdateTeamRoles(th.SystemAdminUser.Id, BASIC_MEMBER); err == nil {
		t.Fatal("Should have errored, not team admin")
	}

	// system admin promoting user1
	if _, err := th.SystemAdminClient.UpdateTeamRoles(th.BasicUser.Id, TEAM_ADMIN); err != nil {
		t.Fatal("Should have worked: " + err.Error())
	}

	// user 1 trying to promote user 2
	if _, err := th.BasicClient.UpdateTeamRoles(th.BasicUser2.Id, TEAM_ADMIN); err != nil {
		t.Fatal("Should have worked, user is team admin: " + th.BasicUser.Id)
	}

	// user 1 trying to demote user 2
	if _, err := th.BasicClient.UpdateTeamRoles(th.BasicUser2.Id, BASIC_MEMBER); err != nil {
		t.Fatal("Should have worked, user is team admin")
	}

	// user 1 trying to demote a system admin
	if _, err := th.BasicClient.UpdateTeamRoles(th.SystemAdminUser.Id, BASIC_MEMBER); err != nil {
		t.Fatal("Should have worked, user is team admin and has the ability to manage permissions on this team.")
		// Note to anyone who thinks this test is wrong:
		// This operation will not effect the system admin's permissions because they have global access to all teams.
		// Their team level permissions are irrelavent. A team admin should be able to manage team level permissions.
	}

	// System admins should be able to manipulate permission no matter what their team level permissions are.
	// systemAdmin trying to promote user 2
	if _, err := th.SystemAdminClient.UpdateTeamRoles(th.BasicUser2.Id, TEAM_ADMIN); err != nil {
		t.Fatal("Should have worked, user is system admin")
	}

	// system admin trying to demote user 2
	if _, err := th.SystemAdminClient.UpdateTeamRoles(th.BasicUser2.Id, BASIC_MEMBER); err != nil {
		t.Fatal("Should have worked, user is system admin")
	}

	// user 1 trying to demote himself
	if _, err := th.BasicClient.UpdateTeamRoles(th.BasicUser.Id, BASIC_MEMBER); err != nil {
		t.Fatal("Should have worked, user is team admin")
	}
}

func TestGetTeamStats(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.BasicClient

	if result, err := th.SystemAdminClient.GetTeamStats(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).MemberCount != 2 {
			t.Fatal("wrong count")
		}
	}

	if result, err := th.SystemAdminClient.GetTeamStats("junk"); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).MemberCount != 0 {
			t.Fatal("wrong count")
		}
	}

	if result, err := th.SystemAdminClient.GetTeamStats(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).MemberCount != 2 {
			t.Fatal("wrong count")
		}
	}

	user := model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.Login(user.Email, user.Password)

	if _, err := Client.GetTeamStats(th.BasicTeam.Id); err == nil {
		t.Fatal("should have errored - not on team")
	}
}
