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

func TestSetStatusOffline(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser

	t.Run("when user statuses are disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = false
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline
		th.Service.SetStatusOffline(user.Id, false, false)

		// Enable user statuses to see what is really in the database
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Status should remain unchanged
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("when setting status manually over manually set status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online manually
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline non-manually
		th.Service.SetStatusOffline(user.Id, false, false)

		// Status should remain unchanged because manual status takes precedence
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.True(t, after.Manual)
	})

	t.Run("when force flag is true over manually set status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online manually
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline with force flag
		th.Service.SetStatusOffline(user.Id, false, true)

		// Status should change despite being manual
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.False(t, after.Manual)
	})

	t.Run("when setting status normally", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: false,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set offline
		th.Service.SetStatusOffline(user.Id, false, false)

		// Status should change
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.False(t, after.Manual)
	})

	t.Run("when setting status manually over normal status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: false,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set offline manually
		th.Service.SetStatusOffline(user.Id, true, false)

		// Status should change and be marked as manual
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.True(t, after.Manual)
	})
}
