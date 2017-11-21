// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, err := Client.CreateTeam(&team)
	if err != nil {
		t.Fatal(err)
	}

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

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
		if err.Message != "A team with that name already exists" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/teams/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestCreateTeamSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	// Non-admin users can create a team, but they become a team admin by doing so

	t.Run("team admin", func(t *testing.T) {
		team := &model.Team{
			DisplayName:    t.Name() + "_1",
			Name:           GenerateTestTeamName(),
			Email:          GenerateTestEmail(),
			Type:           model.TEAM_OPEN,
			AllowedDomains: "simulator.amazonses.com",
		}

		if res, err := th.BasicClient.CreateTeam(team); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		team := &model.Team{
			DisplayName:    t.Name() + "_2",
			Name:           GenerateTestTeamName(),
			Email:          GenerateTestEmail(),
			Type:           model.TEAM_OPEN,
			AllowedDomains: "simulator.amazonses.com",
		}

		if res, err := th.SystemAdminClient.CreateTeam(team); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	th.BasicClient.Logout()

	// Test adding a user to a team you are not a member of.
	th.SystemAdminClient.SetTeamId(th.BasicTeam.Id)
	th.SystemAdminClient.Must(th.SystemAdminClient.RemoveUserFromTeam(th.BasicTeam.Id, th.BasicUser2.Id))

	th.LoginBasic2()

	user2 := th.CreateUser(th.BasicClient)

	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user2.Id); err == nil {
		t.Fatal("Should have failed because of not being a team member")
	}

	// Test adding a user to a team you are a member of.
	th.BasicClient.Logout()
	th.LoginBasic()

	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Check it worked properly.
	if result, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user2.Id); err != nil {
		t.Fatal(err)
	} else {
		rm := result.Data.(map[string]string)
		if rm["user_id"] != user2.Id {
			t.Fatal("ids didn't match")
		}
	}

	if _, err := th.BasicClient.GetTeamMember(th.BasicTeam.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	// Restore config/license at end of test case.
	restrictTeamInvite := *th.App.Config().TeamSettings.RestrictTeamInvite
	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = restrictTeamInvite })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()

	// Set the config so that only team admins can add a user to a team.
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_TEAM_ADMIN })
	th.App.SetDefaultRolesBasedOnConfig()

	// Test without the EE license to see that the permission restriction is ignored.
	user3 := th.CreateUser(th.BasicClient)
	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user3.Id); err != nil {
		t.Fatal(err)
	}

	// Add an EE license.
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	// Check that a regular user can't add someone to the team.
	user4 := th.CreateUser(th.BasicClient)
	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user4.Id); err == nil {
		t.Fatal("should have failed due to permissions error")
	}

	// Should work as team admin.
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.App.InvalidateAllCaches()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_TEAM_ADMIN })
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	user5 := th.CreateUser(th.BasicClient)
	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user5.Id); err != nil {
		t.Fatal(err)
	}

	// Change permission level to System Admin
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_SYSTEM_ADMIN })
	th.App.SetDefaultRolesBasedOnConfig()

	// Should not work as team admin.
	user6 := th.CreateUser(th.BasicClient)
	if _, err := th.BasicClient.AddUserToTeam(th.BasicTeam.Id, user6.Id); err == nil {
		t.Fatal("should have failed due to permissions error")
	}

	// Should work as system admin.
	user7 := th.CreateUser(th.BasicClient)
	if _, err := th.SystemAdminClient.AddUserToTeam(th.BasicTeam.Id, user7.Id); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveUserFromTeam(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

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
	defer th.TearDown()

	user2 := th.CreateUser(th.BasicClient)
	th.BasicClient.Must(th.BasicClient.Logout())
	th.BasicClient.Must(th.BasicClient.Login(user2.Email, user2.Password))

	if result, err := th.BasicClient.AddUserToTeamFromInvite("", "", th.BasicTeam.InviteId); err != nil {
		t.Fatal(err)
	} else {
		rtm := result.Data.(*model.Team)
		if rtm.Id != th.BasicTeam.Id {
			t.Fatal()
		}
	}
}

func TestGetAllTeams(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

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

	Client.Logout()
	if _, err := Client.GetAllTeams(); err == nil {
		t.Fatal("Should have failed due to not being logged in.")
	}
}

func TestGetAllTeamsSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	var team *model.Team
	if res, err := th.BasicClient.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com",
	}); err != nil {
		t.Fatal(err)
	} else {
		team = res.Data.(*model.Team)
	}

	var team2 *model.Team
	if res, err := th.SystemAdminClient.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_2",
		Name:           GenerateTestTeamName(),
		Email:          GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com",
	}); err != nil {
		t.Fatal(err)
	} else {
		team2 = res.Data.(*model.Team)
	}

	t.Run("team admin/team user", func(t *testing.T) {
		if res, err := th.BasicClient.GetAllTeams(); err != nil {
			t.Fatal(err)
		} else {
			for _, rteam := range res.Data.(map[string]*model.Team) {
				if rteam.Id == team.Id {
					if rteam.Email == "" {
						t.Fatal("should not have sanitized email for team admin")
					} else if rteam.AllowedDomains == "" {
						t.Fatal("should not have sanitized allowed domains for team admin")
					}
				} else if rteam.Id == team2.Id {
					if rteam.Email != "" {
						t.Fatal("should've sanitized email for non-admin")
					} else if rteam.AllowedDomains != "" {
						t.Fatal("should've sanitized allowed domains for non-admin")
					}
				}
			}
		}
	})

	t.Run("system admin", func(t *testing.T) {
		if res, err := th.SystemAdminClient.GetAllTeams(); err != nil {
			t.Fatal(err)
		} else {
			for _, rteam := range res.Data.(map[string]*model.Team) {
				if rteam.Id != team.Id && rteam.Id != team2.Id {
					continue
				}

				if rteam.Email == "" {
					t.Fatal("should not have sanitized email")
				} else if rteam.AllowedDomains == "" {
					t.Fatal("should not have sanitized allowed domains")
				}
			}
		}
	})
}

func TestGetAllTeamListings(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN, AllowOpenInvite: true}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if r1, err := Client.GetAllTeamListings(); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal("team name doesn't match")
		}
	}

	th.App.UpdateUserRoles(user.Id, model.SYSTEM_ADMIN_ROLE_ID, false)

	Client.Login(user.Email, "passwd1")
	Client.SetTeamId(team.Id)

	if r1, err := Client.GetAllTeams(); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal("team name doesn't match")
		}
	}
}

func TestGetAllTeamListingsSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	var team *model.Team
	if res, err := th.BasicClient.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_1",
		Name:            GenerateTestTeamName(),
		Email:           GenerateTestEmail(),
		Type:            model.TEAM_OPEN,
		AllowedDomains:  "simulator.amazonses.com",
		AllowOpenInvite: true,
	}); err != nil {
		t.Fatal(err)
	} else {
		team = res.Data.(*model.Team)
	}

	var team2 *model.Team
	if res, err := th.SystemAdminClient.CreateTeam(&model.Team{
		DisplayName:     t.Name() + "_2",
		Name:            GenerateTestTeamName(),
		Email:           GenerateTestEmail(),
		Type:            model.TEAM_OPEN,
		AllowedDomains:  "simulator.amazonses.com",
		AllowOpenInvite: true,
	}); err != nil {
		t.Fatal(err)
	} else {
		team2 = res.Data.(*model.Team)
	}

	t.Run("team admin/non-admin", func(t *testing.T) {
		if res, err := th.BasicClient.GetAllTeamListings(); err != nil {
			t.Fatal(err)
		} else {
			for _, rteam := range res.Data.(map[string]*model.Team) {
				if rteam.Id == team.Id {
					if rteam.Email == "" {
						t.Fatal("should not have sanitized email for team admin")
					} else if rteam.AllowedDomains == "" {
						t.Fatal("should not have sanitized allowed domains for team admin")
					}
				} else if rteam.Id == team2.Id {
					if rteam.Email != "" {
						t.Fatal("should've sanitized email for non-admin")
					} else if rteam.AllowedDomains != "" {
						t.Fatal("should've sanitized allowed domains for non-admin")
					}
				}
			}
		}
	})

	t.Run("system admin", func(t *testing.T) {
		if res, err := th.SystemAdminClient.GetAllTeamListings(); err != nil {
			t.Fatal(err)
		} else {
			for _, rteam := range res.Data.(map[string]*model.Team) {
				if rteam.Id != team.Id && rteam.Id != team2.Id {
					continue
				}

				if rteam.Email == "" {
					t.Fatal("should not have sanitized email")
				} else if rteam.AllowedDomains == "" {
					t.Fatal("should not have sanitized allowed domains")
				}
			}
		}
	})
}

func TestTeamPermDelete(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user1 := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	th.LinkUserToTeam(user1, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user1.Id))

	Client.Login(user1.Email, "passwd1")
	Client.SetTeamId(team.Id)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "zz" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
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

	err := th.App.PermanentDeleteTeam(team)
	if err != nil {
		t.Fatal(err)
	}

	Client.ClearOAuthToken()
}

func TestInviteMembers(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	SystemAdminClient := th.SystemAdminClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.LinkUserToTeam(user, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user.Id))

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

	restrictTeamInvite := *th.App.Config().TeamSettings.RestrictTeamInvite
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = restrictTeamInvite })
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_TEAM_ADMIN })
	th.App.SetDefaultRolesBasedOnConfig()

	th.LoginBasic2()
	th.LinkUserToTeam(th.BasicUser2, team)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	defer func() {
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.InviteMembers(invites); err == nil {
		t.Fatal("should have errored not team admin and licensed")
	}

	th.UpdateUserToTeamAdmin(th.BasicUser2, team)
	Client.Logout()
	th.LoginBasic2()
	Client.SetTeamId(team.Id)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictTeamInvite = model.PERMISSIONS_SYSTEM_ADMIN })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.InviteMembers(invites); err == nil {
		t.Fatal("should have errored not system admin and licensed")
	}

	th.LinkUserToTeam(th.SystemAdminUser, team)

	if _, err := SystemAdminClient.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateTeamDisplayName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	vteam := &model.Team{DisplayName: team.DisplayName, Name: team.Name, Email: team.Email, Type: team.Type}
	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	th.LoginBasic()

	vteam.DisplayName = ""
	if _, err := Client.UpdateTeam(vteam); err == nil {
		t.Fatal("Should have errored, empty name")
	}

	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateTeamSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	var team *model.Team
	if res, err := th.BasicClient.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com",
	}); err != nil {
		t.Fatal(err)
	} else {
		team = res.Data.(*model.Team)
	}

	// Non-admin users cannot update the team

	t.Run("team admin", func(t *testing.T) {
		// API v3 always assumes you're updating the current team
		th.BasicClient.SetTeamId(team.Id)

		if res, err := th.BasicClient.UpdateTeam(team); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email for admin")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		// API v3 always assumes you're updating the current team
		th.SystemAdminClient.SetTeamId(team.Id)

		if res, err := th.SystemAdminClient.UpdateTeam(team); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email for admin")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})
}

func TestFuzzyTeamCreate(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(team)
	team = rteam.Data.(*model.Team)

	Client.Logout()

	user := model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	th.LinkUserToTeam(ruser.Data.(*model.User), rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

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

func TestGetMyTeamSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	var team *model.Team
	if res, err := th.BasicClient.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com",
	}); err != nil {
		t.Fatal(err)
	} else {
		team = res.Data.(*model.Team)
	}

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		client.Must(client.Login(th.BasicUser2.Email, th.BasicUser2.Password))

		client.SetTeamId(team.Id)

		if res, err := client.GetMyTeam(""); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email != "" {
			t.Fatal("should've sanitized email")
		} else if rteam.AllowedDomains != "" {
			t.Fatal("should've sanitized allowed domains")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		th.BasicClient.SetTeamId(team.Id)

		if res, err := th.BasicClient.GetMyTeam(""); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		th.SystemAdminClient.SetTeamId(team.Id)

		if res, err := th.SystemAdminClient.GetMyTeam(""); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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

func TestGetMyTeamMembers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if result, err := th.BasicClient.GetMyTeamMembers(); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.([]*model.TeamMember)
		if len(members) == 0 {
			t.Fatal("should have results")
		}
	}
}

func TestGetMyTeamsUnread(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if result, err := th.BasicClient.GetMyTeamsUnread(""); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.([]*model.TeamUnread)
		if len(members) == 0 {
			t.Fatal("should have results")
		}
	}

	if result, err := th.BasicClient.GetMyTeamsUnread(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		members := result.Data.([]*model.TeamUnread)
		if len(members) != 0 {
			t.Fatal("should not have results")
		}
	}
}

func TestGetTeamMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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
	defer th.TearDown()

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
	defer th.TearDown()

	th.SystemAdminClient.SetTeamId(th.BasicTeam.Id)
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

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
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := th.SystemAdminClient.GetTeamStats(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).TotalMemberCount != 2 {
			t.Fatal("wrong count")
		}

		if result.Data.(*model.TeamStats).ActiveMemberCount != 2 {
			t.Fatal("wrong count")
		}
	}

	th.SystemAdminClient.Must(th.SystemAdminClient.UpdateActive(th.BasicUser2.Id, false))

	if result, err := th.SystemAdminClient.GetTeamStats(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).TotalMemberCount != 2 {
			t.Fatal("wrong count")
		}

		if result.Data.(*model.TeamStats).ActiveMemberCount != 1 {
			t.Fatal("wrong count")
		}
	}

	if _, err := th.SystemAdminClient.GetTeamStats("junk"); err == nil {
		t.Fatal("should fail invalid teamid")
	} else {
		if err.Id != "store.sql_team.get.find.app_error" {
			t.Fatal("wrong error. Got: " + err.Id)
		}
	}

	if result, err := th.SystemAdminClient.GetTeamStats(th.BasicTeam.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.TeamStats).TotalMemberCount != 2 {
			t.Fatal("wrong count")
		}
	}

	user := model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.Login(user.Email, user.Password)

	if _, err := Client.GetTeamStats(th.BasicTeam.Id); err == nil {
		t.Fatal("should have errored - not on team")
	}
}

func TestUpdateTeamDescription(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	Client.Logout()

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Jabba the Hutt", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	th.LinkUserToTeam(user2, team)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")
	Client.SetTeamId(team.Id)

	vteam := &model.Team{DisplayName: team.DisplayName, Name: team.Name, Description: team.Description, Email: team.Email, Type: team.Type}
	vteam.Description = "yommamma"
	if _, err := Client.UpdateTeam(vteam); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	th.LoginBasic()

	vteam.Description = ""
	if _, err := Client.UpdateTeam(vteam); err != nil {
		t.Fatal("Should have errored, should save blank Description")
	}

	vteam.Description = "yommamma"
	if _, err := Client.UpdateTeam(vteam); err != nil {
		t.Fatal(err)
	}
}

func TestGetTeamByName(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN, AllowOpenInvite: false}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_OPEN, AllowOpenInvite: true}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	team3 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "success+" + model.NewId() + "@simulator.amazonses.com", Type: model.TEAM_INVITE, AllowOpenInvite: true}
	team3 = Client.Must(Client.CreateTeam(team3)).Data.(*model.Team)

	if _, err := Client.GetTeamByName(team.Name); err != nil {
		t.Fatal("Failed to get team")
	}

	if _, err := Client.GetTeamByName("InvalidTeamName"); err == nil {
		t.Fatal("Should not exist this team")
	}

	if _, err := Client.GetTeamByName(team2.Name); err != nil {
		t.Fatal("Failed to get team")
	}

	Client.Must(Client.Logout())

	user2 := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "Jabba the Hutt", Password: "passwd1"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(th.App.Srv.Store.User().VerifyEmail(user2.Id))

	Client.Login(user2.Email, "passwd1")

	// AllowInviteOpen is false and team is open and user is not part of the team
	if _, err := Client.GetTeamByName(team.Name); err == nil {
		t.Fatal("Should fail dont have permissions to get the team")
	}

	if _, err := Client.GetTeamByName("InvalidTeamName"); err == nil {
		t.Fatal("Should not exist this team")
	}

	// AllowInviteOpen is true and is open and user is not part of the team
	if _, err := Client.GetTeamByName(team2.Name); err != nil {
		t.Fatal("Should not fail team is open")
	}

	// AllowInviteOpen is true and is invite only and user is not part of the team
	if _, err := Client.GetTeamByName(team3.Name); err == nil {
		t.Fatal("Should fail team is invite only")
	}

	Client.Must(Client.Logout())
	th.BasicClient.Logout()
	th.LoginSystemAdmin()

	if _, err := th.SystemAdminClient.GetTeamByName(team.Name); err != nil {
		t.Fatal("Should not fail to get team the user is admin")
	}

	if _, err := th.SystemAdminClient.GetTeamByName(team2.Name); err != nil {
		t.Fatal("Should not fail to get team the user is admin and team is open")
	}

	if _, err := th.SystemAdminClient.GetTeamByName(team3.Name); err != nil {
		t.Fatal("Should not fail to get team the user is admin and team is invite")
	}

	if _, err := Client.GetTeamByName("InvalidTeamName"); err == nil {
		t.Fatal("Should not exist this team")
	}

	Client.Logout()
	if _, err := Client.GetTeamByName(th.BasicTeam.Name); err == nil {
		t.Fatal("Should have failed when not logged in.")
	}
}

func TestGetTeamByNameSanitization(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	var team *model.Team
	if res, err := th.BasicClient.CreateTeam(&model.Team{
		DisplayName:    t.Name() + "_1",
		Name:           GenerateTestTeamName(),
		Email:          GenerateTestEmail(),
		Type:           model.TEAM_OPEN,
		AllowedDomains: "simulator.amazonses.com",
	}); err != nil {
		t.Fatal(err)
	} else {
		team = res.Data.(*model.Team)
	}

	t.Run("team user", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser2, team)

		client := th.CreateClient()
		client.Must(client.Login(th.BasicUser2.Email, th.BasicUser2.Password))

		if res, err := client.GetTeamByName(team.Name); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email != "" {
			t.Fatal("should've sanitized email")
		} else if rteam.AllowedDomains != "" {
			t.Fatal("should've sanitized allowed domains")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		if res, err := th.BasicClient.GetTeamByName(team.Name); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})

	t.Run("system admin", func(t *testing.T) {
		th.SystemAdminClient.SetTeamId(team.Id)

		if res, err := th.SystemAdminClient.GetTeamByName(team.Name); err != nil {
			t.Fatal(err)
		} else if rteam := res.Data.(*model.Team); rteam.Email == "" {
			t.Fatal("should not have sanitized email")
		} else if rteam.AllowedDomains == "" {
			t.Fatal("should not have sanitized allowed domains")
		}
	})
}

func TestFindTeamByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	Client.Logout()

	if _, err := Client.FindTeamByName(th.BasicTeam.Name); err == nil {
		t.Fatal("Should have failed when not logged in.")
	}
}
