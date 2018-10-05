// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"os"
	"os/exec"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateCommand(t *testing.T) {
	th := api4.Setup().InitBasic()
	th.InitSystemAdmin()
	defer th.TearDown()
	team := th.BasicTeam
	user := th.BasicUser

	testCases := []struct {
		Description string
		Args        []string
		ExpectedErr string
	}{
		{
			"nil error",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"",
		},
		{
			"Team not specified",
			[]string{"command", "create", "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: requires at least 1 arg(s), only received 0",
		},
		{
			"Team not found",
			[]string{"command", "create", "fakeTeam", "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: unable to find team",
		},
		{
			"Creator not specified",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler"},
			`Error: required flag(s) "creator" not set`,
		},
		{
			"Creator not found",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", "fakeuser"},
			"unable to find user",
		},
		{
			"Command not specified",
			[]string{"command", "", team.Name, "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: unknown flag: --trigger-word",
		},
		{
			"Trigger not specified",
			[]string{"command", "create", team.Name, "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			`Error: required flag(s) "trigger-word" not set`,
		},
		{
			"Blank trigger",
			[]string{"command", "create", team.Name, "--trigger-word", "", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Invalid trigger",
		},
		{
			"Trigger with space",
			[]string{"command", "create", team.Name, "--trigger-word", "test cmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: a trigger word must not contain spaces",
		},
		{
			"Trigger starting with /",
			[]string{"command", "create", team.Name, "--trigger-word", "/testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: a trigger word cannot begin with a /",
		},
		{
			"URL not specified",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd", "--creator", user.Username},
			`Error: required flag(s) "url" not set`,
		},
		{
			"Blank URL",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd2", "--url", "", "--creator", user.Username},
			"Invalid URL",
		},
		{
			"Invalid URL",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd2", "--url", "localhost:8000/my-slash-handler", "--creator", user.Username},
			"Invalid URL",
		},
		{
			"Duplicate Command",
			[]string{"command", "create", team.Name, "--trigger-word", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"This trigger word is already in use",
		},
		{
			"Misspelled flag",
			[]string{"command", "create", team.Name, "--trigger-wor", "testcmd", "--url", "http://localhost:8000/my-slash-handler", "--creator", user.Username},
			"Error: unknown flag:",
		},
	}

	path, err := os.Executable()
	require.NoError(t, err)

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {

			actual, _ := exec.Command(path, execArgs(t, testCase.Args)...).CombinedOutput()

			cmds, _ := th.SystemAdminClient.ListCommands(team.Id, true)

			if testCase.ExpectedErr == "" {
				if len(cmds) == 0 || cmds[0].Trigger != "testcmd" {
					t.Fatal("Failed to create command")
				}
				assert.Contains(t, string(actual), "PASS")
			} else {
				if len(cmds) > 1 {
					t.Fatal("Created command that shouldn't have been created")
				}
				assert.Contains(t, string(actual), testCase.ExpectedErr)
			}
		})
	}
}
