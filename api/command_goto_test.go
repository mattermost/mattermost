// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestGotoCommands(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	gt := Client.Must(Client.Command(channel.Id, "/goto "+"google.com", false)).Data.(*model.CommandResponse)
	if !strings.Contains(gt.GotoLocation, "google.com") {
		t.Fatal("failed to goto google")
	}
}
