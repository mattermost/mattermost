package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestStatusTransitionManager(t *testing.T) {
	t.Run("basic Online transition from Offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonConnect,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.OldStatus)
		assert.Equal(t, model.StatusOnline, result.NewStatus)
	})

	t.Run("DND restoration from Offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.OldStatus)
		assert.Equal(t, model.StatusDnd, result.NewStatus)
		assert.True(t, result.Status.Manual)
		assert.Equal(t, "", result.Status.PrevStatus)
	})

	t.Run("Away blocked for DND-Offline user", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusAway,
			Reason:    TransitionReasonInactivity,
			Manual:    false,
		})

		require.False(t, result.Changed)
		assert.Equal(t, "away_blocked_dnd_offline", result.Reason)
	})

	t.Run("manual status protected from automatic change", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.False(t, result.Changed)
		assert.Equal(t, "manual_status_protected", result.Reason)
	})

	t.Run("NoOffline overrides manual for Offline->Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOnline, result.NewStatus)
	})

	t.Run("DND cannot be changed by automatic action", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.False(t, result.Changed)
		assert.Equal(t, "dnd_ooo_protected", result.Reason)
	})

	t.Run("DND inactivity to Offline is allowed", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOffline,
			Reason:    TransitionReasonDNDInactivity,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.NewStatus)
		assert.Equal(t, model.StatusDnd, result.Status.PrevStatus)
	})

	t.Run("timed DND sets DNDEndTime and PrevStatus", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		endTime := model.GetMillis()/1000 + 3600
		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:     th.BasicUser.Id,
			NewStatus:  model.StatusDnd,
			Reason:     TransitionReasonManual,
			Manual:     true,
			DNDEndTime: endTime,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusDnd, result.NewStatus)
		assert.Equal(t, endTime, result.Status.DNDEndTime)
		assert.Equal(t, model.StatusOnline, result.Status.PrevStatus)
	})
}
