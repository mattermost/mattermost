// mattermost-extended-test
package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCheckInactivityTimeouts(t *testing.T) {
	t.Run("inactive Online user gets set to Away", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(5)
		})

		// Set user Online with activity 10 minutes ago (past the 5-minute timeout)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, updated.Status)
	})

	t.Run("active Online user within timeout is untouched", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(5)
		})

		// Set user Online with activity 2 minutes ago (within the 5-minute timeout)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 2*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, updated.Status)
	})

	t.Run("manually-set Online user is NOT protected - AccurateStatuses overrides", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(5)
		})

		// Manually set user Online with activity 10 minutes ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, updated.Status, "AccurateStatuses should override manual status protection")
	})

	t.Run("status-paused user is protected", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(5)
			cfg.MattermostExtendedSettings.Statuses.StatusPauseAllowedUsers = model.NewPointer(th.BasicUser.Username)
		})

		// Set the status_paused preference
		err := th.Service.Store.Preference().Save(model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "mattermost_extended",
				Name:     "status_paused",
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Set user Online with activity 10 minutes ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, updated.Status, "paused users should not be transitioned")
	})

	t.Run("disabled feature flag skips check", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(5)
		})

		// Set user Online with activity 10 minutes ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, updated.Status, "should not transition when AccurateStatuses is disabled")
	})

	t.Run("timeout of 0 disables check", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = model.NewPointer(0)
		})

		// Set user Online with activity 10 minutes ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckInactivityTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, updated.Status, "should not transition when timeout is 0")
	})
}

func TestCheckDNDTimeoutsViaTransitionManager(t *testing.T) {
	t.Run("DND user goes Offline with PrevStatus preserved", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = model.NewPointer(30)
		})

		// Set user to DND with activity 60 minutes ago (past the 30-minute timeout)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 60*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckDNDTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, updated.Status)
		assert.Equal(t, model.StatusDnd, updated.PrevStatus, "PrevStatus should be preserved for DND restoration")
	})

	t.Run("active DND user within timeout is untouched", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = model.NewPointer(30)
		})

		// Set user to DND with activity 10 minutes ago (within the 30-minute timeout)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10*60*1000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		th.Service.CheckDNDTimeouts()

		updated, err := th.Service.GetStatus(th.BasicUser.Id)
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, updated.Status, "DND user within timeout should not be changed")
	})
}
