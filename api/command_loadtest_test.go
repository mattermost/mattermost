// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestLoadTestHelpCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	rs := Client.Must(Client.Command(channel.Id, "/loadtest help", false)).Data.(*model.CommandResponse)
	if !strings.Contains(rs.Text, "Mattermost load testing commands to help") {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestSetupCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	rs := Client.Must(Client.Command(channel.Id, "/loadtest setup fuzz 1 1 1", false)).Data.(*model.CommandResponse)
	if rs.Text != "Creating enviroment..." {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestUsersCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	rs := Client.Must(Client.Command(channel.Id, "/loadtest users fuzz 1 2", false)).Data.(*model.CommandResponse)
	if rs.Text != "Adding users..." {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestChannelsCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	rs := Client.Must(Client.Command(channel.Id, "/loadtest channels fuzz 1 2", false)).Data.(*model.CommandResponse)
	if rs.Text != "Adding channels..." {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestPostsCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	rs := Client.Must(Client.Command(channel.Id, "/loadtest posts fuzz 2 3 2", false)).Data.(*model.CommandResponse)
	if rs.Text != "Adding posts..." {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestUrlCommands(t *testing.T) {
	Setup()
	// enable testing to use /loadtest but don't save it since we don't want to overwrite config.json
	enableTesting := utils.Cfg.ServiceSettings.EnableTesting
	defer func() {
		utils.Cfg.ServiceSettings.EnableTesting = enableTesting
	}()

	utils.Cfg.ServiceSettings.EnableTesting = true

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	command := "/loadtest url "
	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.CommandResponse); r.Text != "Command must contain a url" {
		t.Fatal("/loadtest url with no url should've failed")
	}

	command = "/loadtest url http://www.hopefullynonexistent.file/path/asdf/qwerty"
	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.CommandResponse); r.Text != "Unable to get file" {
		t.Fatal("/loadtest url with invalid url should've failed")
	}

	command = "/loadtest url https://raw.githubusercontent.com/mattermost/platform/master/README.md"
	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.CommandResponse); r.Text != "Loading url..." {
		t.Fatal("/loadtest url for README.md should've executed")
	}

	command = "/loadtest url test-emoticons.md"
	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.CommandResponse); r.Text != "Loading url..." {
		t.Fatal("/loadtest url for test-emoticons.md should've executed")
	}

	command = "/loadtest url test-emoticons"
	if r := Client.Must(Client.Command(channel.Id, command, false)).Data.(*model.CommandResponse); r.Text != "Loading url..." {
		t.Fatal("/loadtest url for test-emoticons should've executed")
	}

	posts := Client.Must(Client.GetPosts(channel.Id, 0, 5, "")).Data.(*model.PostList)
	// note that this may make more than 3 posts if files are too long to fit in an individual post
	if len(posts.Order) < 3 {
		t.Fatal("/loadtest url made too few posts, perhaps there needs to be a delay before GetPosts in the test?")
	}

	time.Sleep(2 * time.Second)
}
