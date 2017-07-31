// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestShortcutsCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	rs := Client.Must(Client.Command(channel.Id, "/shortcuts ")).Data.(*model.CommandResponse)
	if !strings.Contains(rs.Text, "Ctrl") {
		t.Fatal("failed to display shortcuts")
	}

	rs = Client.Must(Client.Command(channel.Id, "/shortcuts mac")).Data.(*model.CommandResponse)
	if !strings.Contains(rs.Text, "Cmd") {
		t.Fatal("failed to display Mac shortcuts")
	}
}
