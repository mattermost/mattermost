// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestSaveStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	for _, statusString := range []string{
		model.StatusOnline,
		model.StatusAway,
		model.StatusDnd,
		model.StatusOffline,
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

func TestCustomStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	cs := &model.CustomStatus{
		Emoji: ":smile:",
		Text:  "honk!",
	}

	err := th.App.SetCustomStatus(user.Id, cs)
	require.Nil(t, err, "failed to set custom status %v", err)

	csSaved, err := th.App.GetCustomStatus(user.Id)
	require.Nil(t, err, "failed to get custom status after save %v", err)
	require.Equal(t, cs, csSaved)

	err = th.App.RemoveCustomStatus(user.Id)
	require.Nil(t, err, "failed to to clear custom status %v", err)

	var csClear *model.CustomStatus
	csSaved, err = th.App.GetCustomStatus(user.Id)
	require.Nil(t, err, "failed to get custom status after clear %v", err)
	require.Equal(t, csClear, csSaved)
}
