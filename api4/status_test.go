package api4

import (
	"testing"

	"github.com/mattermost/platform/app"
)

func TestGetUserStatus(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	userStatus, resp := Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}

	app.SetStatusOnline(th.BasicUser.Id, "", true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "online" {
		t.Fatal("Should return online status")
	}

	app.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "away" {
		t.Fatal("Should return away status")
	}

	app.SetStatusOffline(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}

	//Get user2 status logged as user1
	userStatus, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}

	Client.Logout()
	th.LoginBasic2()
	userStatus, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}
}
