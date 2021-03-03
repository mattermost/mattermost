// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestSaveStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	for _, statusString := range []string{
		model.STATUS_ONLINE,
		model.STATUS_AWAY,
		model.STATUS_DND,
		model.STATUS_OFFLINE,
	} {
		t.Run(statusString, func(t *testing.T) {
			status := &model.Status{
				UserId: user.Id,
				Status: statusString,
			}

			th.App.SaveAndBroadcastStatus(status)

			after, err := th.App.GetStatus(user.Id)
			require.Nil(t, err, "failed to get status after save: %v", err)
			require.Equal(t, statusString, after.Status, "failed to save status, got %v, expected %v", after.Status, statusString)
		})
	}
}

func TestGetUserStatusesByIds(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	t.Run("empty list", func(t *testing.T) {
		statuses, err := th.App.GetUserStatusesByIds([]string{})
		require.Nil(t, err)
		require.Len(t, statuses, 0)
	})

	t.Run("not existing user", func(t *testing.T) {
		statuses, err := th.App.GetUserStatusesByIds([]string{model.NewId()})
		require.Nil(t, err)
		require.Len(t, statuses, 1)
		require.Equal(t, statuses[0].Status, model.STATUS_OFFLINE)
	})

	t.Run("user without status", func(t *testing.T) {
		statuses, err := th.App.GetUserStatusesByIds([]string{user.Id})
		require.Nil(t, err)
		require.Len(t, statuses, 1)
		require.Equal(t, statuses[0].Status, model.STATUS_OFFLINE)
	})

	t.Run("user with status", func(t *testing.T) {
		status := &model.Status{
			UserId: user.Id,
			Status: model.STATUS_ONLINE,
		}

		th.App.SaveAndBroadcastStatus(status)

		statuses, err := th.App.GetUserStatusesByIds([]string{user.Id})
		require.Nil(t, err)
		require.Len(t, statuses, 1)
		require.Equal(t, statuses[0].Status, model.STATUS_ONLINE)
	})

	t.Run("valid user and not valid user", func(t *testing.T) {
		status := &model.Status{
			UserId: user.Id,
			Status: model.STATUS_ONLINE,
		}

		th.App.SaveAndBroadcastStatus(status)

		statuses, err := th.App.GetUserStatusesByIds([]string{user.Id, model.NewId()})
		require.Nil(t, err)
		require.Len(t, statuses, 2)
		require.Equal(t, statuses[0].Status, model.STATUS_ONLINE)
		require.Equal(t, statuses[1].Status, model.STATUS_OFFLINE)
	})

	t.Run("user with status and user without status", func(t *testing.T) {
		status := &model.Status{
			UserId: user.Id,
			Status: model.STATUS_ONLINE,
		}

		th.App.SaveAndBroadcastStatus(status)
		user2 := th.CreateUser()

		statuses, err := th.App.GetUserStatusesByIds([]string{user.Id, user2.Id})
		require.Nil(t, err)
		require.Len(t, statuses, 2)
		require.Equal(t, statuses[0].Status, model.STATUS_ONLINE)
		require.Equal(t, statuses[1].Status, model.STATUS_OFFLINE)
	})
}
