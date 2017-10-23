// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestLoadTestHelpCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.Command(channel.Id, "/test help")).Data.(*model.CommandResponse)
	if !strings.Contains(rs.Text, "Mattermost testing commands to help") {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestSetupCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.Command(channel.Id, "/test setup fuzz 1 1 1")).Data.(*model.CommandResponse)
	if rs.Text != "Created enviroment" {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestUsersCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.Command(channel.Id, "/test users fuzz 1 2")).Data.(*model.CommandResponse)
	if rs.Text != "Added users" {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestChannelsCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.Command(channel.Id, "/test channels fuzz 1 2")).Data.(*model.CommandResponse)
	if rs.Text != "Added channels" {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}

func TestLoadTestPostsCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.Command(channel.Id, "/test posts fuzz 2 3 2")).Data.(*model.CommandResponse)
	if rs.Text != "Added posts" {
		t.Fatal(rs.Text)
	}

	time.Sleep(2 * time.Second)
}
