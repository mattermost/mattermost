// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"os/exec"
	"testing"

	"github.com/mattermost/platform/model"
)

var disableCliTests bool = false

func TestCliVersion(t *testing.T) {
	if disableCliTests {
		return
	}

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -version`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}
}

func TestCliCreateTeam(t *testing.T) {
	if disableCliTests {
		return
	}

	th := Setup().InitSystemAdmin()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	name := "name" + id

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -create_team -team_name="`+name+`" -email="`+email+`"`)
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
	if disableCliTests {
		return
	}

	th := Setup().InitSystemAdmin()

	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -create_user -team_name="`+th.SystemAdminTeam.Name+`" -email="`+email+`" -password="mypassword" -username="`+username+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfiles(th.SystemAdminTeam.Id, "")).Data.(map[string]*model.User)

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
	if disableCliTests {
		return
	}

	Setup()
	id := model.NewId()
	email := "success+" + id + "@simulator.amazonses.com"
	username := "name" + id

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -create_user -email="`+email+`" -password="mypassword" -username="`+username+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Email != email {
			t.Fatal()
		}
	}
}

func TestCliAssignRole(t *testing.T) {
	if disableCliTests {
		return
	}

	th := Setup().InitBasic()

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -assign_role -email="`+th.BasicUser.Email+`" -role="system_admin"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	if result := <-Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_admin" {
			t.Fatal()
		}
	}
}

func TestCliJoinTeam(t *testing.T) {
	if disableCliTests {
		return
	}

	th := Setup().InitSystemAdmin().InitBasic()

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -join_team -team_name="`+th.SystemAdminTeam.Name+`" -email="`+th.BasicUser.Email+`"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetProfiles(th.SystemAdminTeam.Id, "")).Data.(map[string]*model.User)

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

func TestCliResetPassword(t *testing.T) {
	if disableCliTests {
		return
	}

	th := Setup().InitBasic()

	cmd := exec.Command("bash", "-c", `go run ../mattermost.go -reset_password -email="`+th.BasicUser.Email+`" -password="password2"`)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Log(string(output))
		t.Fatal(err)
	}

	th.BasicClient.Logout()
	th.BasicUser.Password = "password2"
	th.LoginBasic()
}
