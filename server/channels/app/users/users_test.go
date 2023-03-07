// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/model"

	"github.com/stretchr/testify/require"
)

func TestIsUsernameTaken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	taken := th.service.IsUsernameTaken(user.Username)

	if !taken {
		t.Logf("the username '%v' should be taken", user.Username)
		t.FailNow()
	}

	newUsername := "randomUsername"
	taken = th.service.IsUsernameTaken(newUsername)

	if taken {
		t.Logf("the username '%v' should not be taken", newUsername)
		t.FailNow()
	}
}

func TestFirstUserPromoted(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	user, err := th.service.CreateUser(&model.User{
		Username: model.NewId(),
		Password: model.NewId(),
		Email:    "user@example.com",
	}, UserCreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, user)

	require.Equal(t, model.SystemAdminRoleId+" "+model.SystemUserRoleId, user.Roles)

	user2, err := th.service.CreateUser(&model.User{
		Username: model.NewId(),
		Password: model.NewId(),
		Email:    "user2@example.com",
	}, UserCreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, user2)

	require.Equal(t, model.SystemUserRoleId, user2.Roles)

	th.dbStore.User().PermanentDelete(user.Id)

	b := &model.Bot{
		UserId:   user2.Id,
		OwnerId:  model.NewId(),
		Username: model.NewId(),
	}

	_, err = th.dbStore.Bot().Save(b)
	require.NoError(t, err)

	user3, err := th.service.CreateUser(&model.User{
		Username: model.NewId(),
		Password: model.NewId(),
		Email:    "user3@example.com",
	}, UserCreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, user3)

	require.Equal(t, model.SystemAdminRoleId+" "+model.SystemUserRoleId, user3.Roles)

	user4, err := th.service.CreateUser(&model.User{
		Username: model.NewId(),
		Password: model.NewId(),
		Email:    "user4@example.com",
	}, UserCreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, user4)

	require.Equal(t, model.SystemUserRoleId, user4.Roles)
}
