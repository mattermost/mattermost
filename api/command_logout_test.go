// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestLogoutTestCommand(t *testing.T) {
	th := Setup().InitBasic()

	rs1 := th.BasicClient.Must(th.BasicClient.Command(th.BasicChannel.Id, "/logout", false)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs1.GotoLocation, "logout") {
		t.Fatal("failed to logout")
	}
}
