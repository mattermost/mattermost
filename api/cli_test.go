// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"os/exec"
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestCliVersion(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	cmd := exec.Command("bash", "-c", `go run ../cmd/platform/*.go version`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}
}

func TestCliCreateTeam(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitSystemAdmin()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	cmd := exec.Command("bash", "-c", `go run ../cmd/platform/*.go team create --name "`+name+`" --display_name "`+displayName+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	found := th.SystemAdminClient.Must(th.SystemAdminClient.FindTeamByName(name)).Data.(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestCliCreateUserWithTeam(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitSystemAdmin()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	cmd := exec.Command("bash", "-c", `go run ../cmd/platform/*.go user create --email "`+email+`" --password "mypassword1" --username "`+username+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	cmd2 := exec.Command("bash", "-c", `go run ../cmd/platform/*.go team add `+th.SystemAdminTeam.Id+" "+email)
	output2, err2 := cmd2.CombinedOutput()
	if err2 != nil {
		t.Log(string(output2))
		t.Fatal(err2)
	}

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
	if testing.Short() {
		t.SkipNow()
	}

	Setup()
	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	cmd := exec.Command("bash", "-c", `go run ../cmd/platform/*.go user create --email "`+email+`" --password "mypassword1" --username "`+username+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	if result := <-app.Srv.Store.User().GetByEmail(email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Email != email {
			t.Fatal()
		}
	}
}

func TestCliAssignRole(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()

	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go roles system_admin "+th.BasicUser.Email)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	if result := <-app.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_admin system_user" {
			t.Fatal()
		}
	}
}

func TestCliJoinChannel(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	// These test cannot run since this feature requires an enteprise license

	// cmd := exec.Command("bash", "-c", `go run ../*.go -join_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`" -email="`+th.BasicUser2.Email+`"`)
	// output, err := cmd.CombinedOutput()
	// if err != nil {
	// 	t.Log(string(output))
	// 	t.Fatal(err)
	// }

	// // Joining twice should succeed
	// cmd1 := exec.Command("bash", "-c", `go run ../*.go -join_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`" -email="`+th.BasicUser2.Email+`"`)
	// output1, err1 := cmd1.CombinedOutput()
	// if err1 != nil {
	// 	t.Log(string(output1))
	// 	t.Fatal(err1)
	// }

	// should fail because channel does not exist
	cmd2 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel add "+th.BasicTeam.Name+":"+channel.Name+"asdf "+th.BasicUser2.Email)
	output2, err2 := cmd2.CombinedOutput()
	if err2 == nil {
		t.Log(string(output2))
		t.Fatal()
	}

	// should fail because channel does not have license
	cmd3 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel add "+th.BasicTeam.Name+":"+channel.Name+" "+th.BasicUser2.Email)
	output3, err3 := cmd3.CombinedOutput()
	if err3 == nil {
		t.Log(string(output3))
		t.Fatal()
	}
}

func TestCliRemoveChannel(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	// These test cannot run since this feature requires an enteprise license

	// cmd := exec.Command("bash", "-c", `go run ../*.go -join_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`" -email="`+th.BasicUser2.Email+`"`)
	// output, err := cmd.CombinedOutput()
	// if err != nil {
	// 	t.Log(string(output))
	// 	t.Fatal(err)
	// }

	// cmd0 := exec.Command("bash", "-c", `go run ../*.go -leave_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`" -email="`+th.BasicUser2.Email+`"`)
	// output0, err0 := cmd0.CombinedOutput()
	// if err0 != nil {
	// 	t.Log(string(output0))
	// 	t.Fatal(err0)
	// }

	// // Leaving twice should succeed
	// cmd1 := exec.Command("bash", "-c", `go run ../*.go -leave_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`" -email="`+th.BasicUser2.Email+`"`)
	// output1, err1 := cmd1.CombinedOutput()
	// if err1 != nil {
	// 	t.Log(string(output1))
	// 	t.Fatal(err1)
	// }

	// cannot leave town-square
	cmd1a := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel remove "+th.BasicTeam.Name+":town-square "+th.BasicUser2.Email)
	output1a, err1a := cmd1a.CombinedOutput()
	if err1a == nil {
		t.Log(string(output1a))
		t.Fatal()
	}

	// should fail because channel does not exist
	cmd2 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel remove "+th.BasicTeam.Name+":doesnotexist "+th.BasicUser2.Email)
	output2, err2 := cmd2.CombinedOutput()
	if err2 == nil {
		t.Log(string(output2))
		t.Fatal()
	}

	// should fail because channel does not have license
	cmd3 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel remove "+th.BasicTeam.Name+":"+channel.Name+" "+th.BasicUser2.Email)
	output3, err3 := cmd3.CombinedOutput()
	if err3 == nil {
		t.Log(string(output3))
		t.Fatal()
	}
}

func TestCliListChannels(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	// These test cannot run since this feature requires an enteprise license

	// cmd := exec.Command("bash", "-c", `go run ../*.go -list_channels -team_name="`+th.BasicTeam.Name+`"`)
	// output, err := cmd.CombinedOutput()
	// if err != nil {
	// 	t.Log(string(output))
	// 	t.Fatal(err)
	// }

	// if !strings.Contains(string(output), "town-square") {
	// 	t.Fatal("should have channels")
	// }

	// if !strings.Contains(string(output), channel.Name+" (archived)") {
	// 	t.Fatal("should have archived channel")
	// }

	// should fail because channel does not have license
	cmd3 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel list "+th.BasicTeam.Name)
	output3, err3 := cmd3.CombinedOutput()
	if err3 == nil {
		t.Log(string(output3))
		t.Fatal()
	}
}

func TestCliRestoreChannel(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	// These test cannot run since this feature requires an enteprise license

	// cmd := exec.Command("bash", "-c", `go run ../*.go -restore_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`"`)
	// output, err := cmd.CombinedOutput()
	// if err != nil {
	// 	t.Log(string(output))
	// 	t.Fatal(err)
	// }

	// // restoring twice should succeed
	// cmd1 := exec.Command("bash", "-c", `go run ../*.go -restore_channel -team_name="`+th.BasicTeam.Name+`" -channel_name="`+channel.Name+`"`)
	// output1, err1 := cmd1.CombinedOutput()
	// if err1 != nil {
	// 	t.Log(string(output1))
	// 	t.Fatal(err1)
	// }

	// should fail because channel does not have license
	cmd3 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel restore "+th.BasicTeam.Name+":"+channel.Name)
	output3, err3 := cmd3.CombinedOutput()
	if err3 == nil {
		t.Log(string(output3))
		t.Fatal()
	}
}

func TestCliJoinTeam(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitSystemAdmin().InitBasic()

	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go team add "+th.SystemAdminTeam.Name+" "+th.BasicUser.Email)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

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
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()

	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go team remove "+th.BasicTeam.Name+" "+th.BasicUser.Email)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

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

	if result := <-app.Srv.Store.Team().GetTeamsByUserId(th.BasicUser.Id); result.Err != nil {
		teamMembers := result.Data.([]*model.TeamMember)
		if len(teamMembers) > 0 {
			t.Fatal("Shouldn't be in team")
		}
	}
}

func TestCliResetPassword(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()

	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go user password "+th.BasicUser.Email+" password2")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	th.BasicClient.Logout()
	th.BasicUser.Password = "password2"
	th.LoginBasic()
}

func TestCliCreateChannel(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()

	id := model.NewId()
	name := "name" + id

	// should fail because channel does not have license
	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel create --display_name "+name+" --team "+th.BasicTeam.Name+" --name "+name)
	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Log(string(output))
		t.Fatal()
	}

	// should fail because channel does not have license
	name = name + "-private"
	cmd2 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go channel create --display_name="+name+" --team "+th.BasicTeam.Name+" --private --name "+name)
	output2, err2 := cmd2.CombinedOutput()
	if err2 == nil {
		t.Log(string(output2))
		t.Fatal()
	}
}

func TestCliMakeUserActiveAndInactive(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()

	// first inactivate the user
	cmd := exec.Command("bash", "-c", "go run ../cmd/platform/*.go user deactivate "+th.BasicUser.Email)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal()
	}

	// activate the inactive user
	cmd2 := exec.Command("bash", "-c", "go run ../cmd/platform/*.go user activate "+th.BasicUser.Email)
	output2, err2 := cmd2.CombinedOutput()
	if err2 != nil {
		t.Log(string(output2))
		t.Fatal()
	}
}
