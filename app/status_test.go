// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
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
