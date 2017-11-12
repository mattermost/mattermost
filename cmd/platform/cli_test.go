// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
)

var coverprofileCounters map[string]int = make(map[string]int)

func execArgs(t *testing.T, args []string) []string {
	ret := []string{"-test.run", "ExecCommand"}
	if coverprofile := flag.Lookup("test.coverprofile").Value.String(); coverprofile != "" {
		parts := strings.SplitN(coverprofile, ".", 2)
		coverprofileCounters[t.Name()] = coverprofileCounters[t.Name()] + 1
		parts[0] = fmt.Sprintf("%v-%v-%v", parts[0], t.Name(), coverprofileCounters[t.Name()])
		ret = append(ret, "-test.coverprofile", strings.Join(parts, "."))
	}
	return append(append(ret, "--"), args...)
}

func checkCommand(t *testing.T, args ...string) string {
	path, err := os.Executable()
	require.NoError(t, err)
	output, err := exec.Command(path, execArgs(t, args)...).CombinedOutput()
	require.NoError(t, err, string(output))
	return string(output)
}

func runCommand(t *testing.T, args ...string) error {
	path, err := os.Executable()
	require.NoError(t, err)
	return exec.Command(path, execArgs(t, args)...).Run()
}

func TestCliVersion(t *testing.T) {
	checkCommand(t, "version")
}

func TestCliCreateTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	checkCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.FindTeamByName(name)).Data.(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestCliCreateUserWithTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	checkCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	checkCommand(t, "team", "add", th.SystemAdminTeam.Id, email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfilesInTeam(th.SystemAdminTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == email {
			found = true
		}

	}

	if !found {
		t.Fatal("Failed to create User")
	}
}

func TestCliCreateUserWithoutTeam(t *testing.T) {
	th := api.Setup()
	defer th.TearDown()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	checkCommand(t, "user", "create", "--email", email, "--password", "mypassword1", "--username", username)

	if result := <-th.App.Srv.Store.User().GetByEmail(email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Email != email {
			t.Fatal()
		}
	}
}

func TestCliAssignRole(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "roles", "system_admin", th.BasicUser.Email)

	if result := <-th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_admin system_user" {
			t.Fatal()
		}
	}
}

func TestCliJoinChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Joining twice should succeed
	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, runCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name+"asdf", th.BasicUser2.Email))
}

func TestCliRemoveChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, runCommand(t, "channel", "remove", th.BasicTeam.Name+":doesnotexist", th.BasicUser2.Email))

	checkCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Leaving twice should succeed
	checkCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)
}

func TestCliListChannels(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	output := checkCommand(t, "channel", "list", th.BasicTeam.Name)

	if !strings.Contains(string(output), "town-square") {
		t.Fatal("should have channels")
	}

	if !strings.Contains(string(output), channel.Name+" (archived)") {
		t.Fatal("should have archived channel")
	}
}

func TestCliRestoreChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	checkCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)

	// restoring twice should succeed
	checkCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)
}

func TestCliJoinTeam(t *testing.T) {
	th := api.Setup().InitSystemAdmin().InitBasic()
	defer th.TearDown()

	checkCommand(t, "team", "add", th.SystemAdminTeam.Name, th.BasicUser.Email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfilesInTeam(th.SystemAdminTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if !found {
		t.Fatal("Failed to create User")
	}
}

func TestCliLeaveTeam(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "team", "remove", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.BasicClient.Must(th.BasicClient.GetProfilesInTeam(th.BasicTeam.Id, 0, 1000, "")).Data.(map[string]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if found {
		t.Fatal("profile should not be on team")
	}

	if result := <-th.App.Srv.Store.Team().GetTeamsByUserId(th.BasicUser.Id); result.Err != nil {
		teamMembers := result.Data.([]*model.TeamMember)
		if len(teamMembers) > 0 {
			t.Fatal("Shouldn't be in team")
		}
	}
}

func TestCliResetPassword(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "user", "password", th.BasicUser.Email, "password2")

	th.BasicClient.Logout()
	th.BasicUser.Password = "password2"
	th.LoginBasic()
}

func TestCliCreateChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id

	checkCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--name", name)

	name = name + "-private"
	checkCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--private", "--name", name)
}

func TestCliMakeUserActiveAndInactive(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	// first inactivate the user
	checkCommand(t, "user", "deactivate", th.BasicUser.Email)

	// activate the inactive user
	checkCommand(t, "user", "activate", th.BasicUser.Email)
}

func TestExecCommand(t *testing.T) {
	if filter := flag.Lookup("test.run").Value.String(); filter != "ExecCommand" {
		t.Skip("use -run ExecCommand to execute a command via the test executable")
	}
	rootCmd.SetArgs(flag.Args())
	require.NoError(t, rootCmd.Execute())
}
