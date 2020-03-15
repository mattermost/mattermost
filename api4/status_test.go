// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func TestGetUserStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	userStatus, resp := Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "offline", userStatus.Status)

	th.App.SetStatusOnline(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "online", userStatus.Status)

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "away", userStatus.Status)

	th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "dnd", userStatus.Status)

	th.App.SetStatusOffline(th.BasicUser.Id, true)
	userStatus, resp = Client.GetUserStatus(th.BasicUser.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "offline", userStatus.Status)

	//Get user2 status logged as user1
	userStatus, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "offline", userStatus.Status)

	Client.Logout()

	_, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckUnauthorizedStatus(t, resp)

	th.LoginBasic2()
	userStatus, resp = Client.GetUserStatus(th.BasicUser2.Id, "")
	CheckNoError(t, resp)
	assert.Equal(t, "offline", userStatus.Status)
}

func TestGetUsersStatusesByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	usersIds := []string{th.BasicUser.Id, th.BasicUser2.Id}

	usersStatuses, resp := Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		assert.Equal(t, "offline", userStatus.Status)
	}

	th.App.SetStatusOnline(th.BasicUser.Id, true)
	th.App.SetStatusOnline(th.BasicUser2.Id, true)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		assert.Equal(t, "online", userStatus.Status)
	}

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
	th.App.SetStatusAwayIfNeeded(th.BasicUser2.Id, true)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		assert.Equal(t, "away", userStatus.Status)
	}

	th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
	th.App.SetStatusDoNotDisturb(th.BasicUser2.Id)
	usersStatuses, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckNoError(t, resp)
	for _, userStatus := range usersStatuses {
		assert.Equal(t, "dnd", userStatus.Status)
	}

	Client.Logout()

	_, resp = Client.GetUsersStatusesByIds(usersIds)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdateUserStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser.Id}
	updateUserStatus, resp := Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	assert.Equal(t, "online", updateUserStatus.Status)

	toUpdateUserStatus.Status = "away"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	assert.Equal(t, "away", updateUserStatus.Status)

	toUpdateUserStatus.Status = "dnd"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	assert.Equal(t, "dnd", updateUserStatus.Status)

	toUpdateUserStatus.Status = "offline"
	updateUserStatus, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckNoError(t, resp)
	assert.Equal(t, "offline", updateUserStatus.Status)

	toUpdateUserStatus.Status = "online"
	toUpdateUserStatus.UserId = th.BasicUser2.Id
	_, resp = Client.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	CheckForbiddenStatus(t, resp)

	toUpdateUserStatus.Status = "online"
	updateUserStatus, _ = th.SystemAdminClient.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	assert.Equal(t, "online", updateUserStatus.Status)

	_, resp = Client.UpdateUserStatus(th.BasicUser.Id, toUpdateUserStatus)
	CheckBadRequestStatus(t, resp)

	Client.Logout()

	_, resp = Client.UpdateUserStatus(th.BasicUser2.Id, toUpdateUserStatus)
	CheckUnauthorizedStatus(t, resp)
}
