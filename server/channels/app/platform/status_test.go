// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

			th.Service.SaveAndBroadcastStatus(status)

			after, err := th.Service.GetStatus(user.Id)
			require.Nil(t, err, "failed to get status after save: %v", err)
			require.Equal(t, statusString, after.Status, "failed to save status, got %v, expected %v", after.Status, statusString)
		})
	}
}

func TestTruncateDNDEndTime(t *testing.T) {
	// 2025-Jan-20 at 17:13:32 GMT becomes 17:13:00
	assert.Equal(t, int64(1737393180), truncateDNDEndTime(1737393212))

	// 2025-Jan-20 at 17:13:00 GMT remains unchanged
	assert.Equal(t, int64(1737393180), truncateDNDEndTime(1737393180))

	// 2025-Jan-20 at 00:00:10 GMT becomes 00:00:00
	assert.Equal(t, int64(1737331200), truncateDNDEndTime(1737331210))

	// 2025-Jan-20 at 00:00:10 GMT remains unchanged
	assert.Equal(t, int64(1737331200), truncateDNDEndTime(1737331200))
}
