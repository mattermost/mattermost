// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"

	"github.com/mattermost/mattermost-server/api4"
)

func TestCreateCommand(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()
	team := th.BasicTeam
	user := th.BasicUser

	CheckCommand(t, "command", "create", team.Name, "--trigger-word", "testCmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username)
}
