// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestStatusCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	commandAndTest(t, th, "away")
	commandAndTest(t, th, "offline")
	commandAndTest(t, th, "online")
}

func commandAndTest(t *testing.T, th *TestHelper, status string) {
	Client := th.BasicClient
	channel := th.BasicChannel
	user := th.BasicUser

	r1 := Client.Must(Client.Command(channel.Id, "/"+status)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(1000 * time.Millisecond)

	statuses := Client.Must(Client.GetStatuses()).Data.(map[string]string)

	if status == "offline" {
		status = ""
	}
	if statuses[user.Id] != status {
		t.Fatal("Error setting status " + status)
	}
}
