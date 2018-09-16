package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetUserStatus(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	userStatus, resp := Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}

	th.App.SetStatusOnline(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "online" {
		t.Fatal("Should return online status")
	}

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "away" {
		t.Fatal("Should return away status")
	}

	th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "dnd" {
		t.Fatal("Should return dnd status")
	}

	th.App.SetStatusOffline(th.BasicUser.Id, true)
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

	_, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	userStatus, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
	if userStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}
}

func TestGetUsersStatusesByIds(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	usersIds := []string{th.BasicUser.Id, th.BasicUser2.Id}

	usersStatuses, resp := Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		if userStatus.Status != "offline" {
			t.Fatal("Status should be offline")
		}
	}

	th.App.SetStatusOnline(th.BasicUser.Id, true)
	th.App.SetStatusOnline(th.BasicUser2.Id, true)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		if userStatus.Status != "online" {
			t.Fatal("Status should be offline")
		}
	}

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
	th.App.SetStatusAwayIfNeeded(th.BasicUser2.Id, true)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		if userStatus.Status != "away" {
			t.Fatal("Status should be offline")
		}
	}

	th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
	th.App.SetStatusDoNotDisturb(th.BasicUser2.Id)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		if userStatus.Status != "dnd" {
			t.Fatal("Status should be offline")
		}
	}

	Client.Logout()

	_, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateUserStatus(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser.Id}
	updateUserStatus, resp := Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	if updateUserStatus.Status != "online" {
		t.Fatal("Should return online status")
	}

	toUpdateUserStatus.Status = "away"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	if updateUserStatus.Status != "away" {
		t.Fatal("Should return away status")
	}

	toUpdateUserStatus.Status = "dnd"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	if updateUserStatus.Status != "dnd" {
		t.Fatal("Should return dnd status")
	}

	toUpdateUserStatus.Status = "offline"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	if updateUserStatus.Status != "offline" {
		t.Fatal("Should return offline status")
	}

	toUpdateUserStatus.Status = "online"
	toUpdateUserStatus.UserId = th.BasicUser2.Id
	_, resp = Client.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	CheckForbiddenStatus(t, resp)

	toUpdateUserStatus.Status = "online"
	updateUserStatus, _ = th.SystemAdminClient.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	if updateUserStatus.Status != "online" {
		t.Fatal("Should return online status")
	}

	_, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckBadRequestStatus(t, resp)

	Client.Logout()

	_, resp = Client.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	CheckUnauthorizedStatus(t, resp)
}
