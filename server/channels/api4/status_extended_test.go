// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ============================================================================
// MATTERMOST EXTENDED - Comprehensive Scenario Tests
// These tests verify the complete user flows for AccurateStatuses and NoOffline
// ============================================================================

// TestAccurateStatusesScenario tests the complete flow of the AccurateStatuses feature
func TestAccurateStatusesScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: User goes idle and becomes Away, then returns and becomes Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses feature
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		// Step 1: User starts Online
		th.App.SetStatusOnline(th.BasicUser.Id, false)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status)

		// Step 2: Simulate user going idle (set LastActivityAt to past)
		oldStatus, appErr := th.App.GetStatus(th.BasicUser.Id)
		require.Nil(t, appErr)
		oldStatus.LastActivityAt = model.GetMillis() - (6 * 60 * 1000) // 6 minutes ago
		th.App.SaveAndBroadcastStatus(oldStatus)

		// Step 3: Heartbeat with window inactive should set user to Away
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status, "User should be Away after inactivity timeout")

		// Step 4: User returns with window active - should become Online again
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "User should be Online after returning")
	})

	t.Run("Scenario: User switches channels - counts as activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		// Create a second channel
		channel2 := th.CreatePublicChannel(t)

		// Set user to Away with old activity time
		awayStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (10 * 60 * 1000), // 10 min ago
			ActiveChannel:  th.BasicChannel.Id,
		}
		th.App.SaveAndBroadcastStatus(awayStatus)

		// Verify user is Away
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status)

		// Heartbeat with window INACTIVE but different channel = channel switch = activity
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, channel2.Id, "desktop")

		// User should be Online because channel switch is manual activity
		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Channel switch should set user Online")
	})

	t.Run("Scenario: Manual status should NOT be changed by heartbeat", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User manually sets status to Away via API
		toUpdateStatus := &model.Status{Status: model.StatusAway, UserId: th.BasicUser.Id}
		_, _, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateStatus)
		require.NoError(t, err)

		// Verify manual Away status
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status)

		// Heartbeat with window active should NOT change manual status
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status, "Manual status should NOT be changed by heartbeat")
	})

	t.Run("Scenario: DND user goes offline after extended inactivity, restores on return", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses with DND timeout
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
		})

		// User sets DND
		th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status)

		// Simulate extended inactivity (31 minutes)
		dndStatus, appErr := th.App.GetStatus(th.BasicUser.Id)
		require.Nil(t, appErr)
		dndStatus.LastActivityAt = model.GetMillis() - (31 * 60 * 1000)
		th.App.SaveAndBroadcastStatus(dndStatus)

		// Heartbeat with window inactive - should transition to Offline
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, "", "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status, "DND user should go Offline after timeout")

		// Verify PrevStatus is saved
		savedStatus, appErr := th.App.GetStatus(th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, model.StatusDnd, savedStatus.PrevStatus, "PrevStatus should be DND")

		// User returns with window active - should restore DND
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status, "DND should be restored when user returns")
	})

	t.Run("Scenario: AccurateStatuses disabled - heartbeat has no effect", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Disable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
		})

		// Set user to Away
		awayStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (10 * 60 * 1000),
		}
		th.App.SaveAndBroadcastStatus(awayStatus)

		// Heartbeat should do nothing when feature is disabled
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status, "Status should not change when AccurateStatuses is disabled")
	})
}

// TestNoOfflineScenario tests the complete flow of the NoOffline feature
func TestNoOfflineScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: Offline user shows activity - becomes Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable NoOffline
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Offline
		th.App.SetStatusOffline(th.BasicUser.Id, false, true)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status)

		// User activity detected via SetOnlineIfNoOffline
		th.App.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test_trigger")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Offline user should become Online with NoOffline")
	})

	t.Run("Scenario: Away user shows activity - becomes Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable NoOffline
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Away
		awayStatus := &model.Status{
			UserId: th.BasicUser.Id,
			Status: model.StatusAway,
			Manual: false,
		}
		th.App.SaveAndBroadcastStatus(awayStatus)

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status)

		// User activity detected
		th.App.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test_trigger")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Away user should become Online with NoOffline")
	})

	t.Run("Scenario: DND user is NOT affected by NoOffline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable NoOffline
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to DND
		th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status)

		// User activity detected - should NOT change DND
		th.App.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test_trigger")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status, "DND should not be changed by NoOffline")
	})

	t.Run("Scenario: DND user that went offline restores DND on activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable NoOffline
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// Simulate user who was DND and went offline
		offlineWithDndPrev := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (60 * 60 * 1000), // 1 hour ago
		}
		th.App.SaveAndBroadcastStatus(offlineWithDndPrev)

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status)

		// User activity detected - should restore DND, not Online
		th.App.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test_trigger")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status, "DND should be restored instead of Online")
	})

	t.Run("Scenario: NoOffline disabled - no effect", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Disable NoOffline
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = false
		})

		// Set user to Offline
		th.App.SetStatusOffline(th.BasicUser.Id, false, true)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status)

		// Activity should not change status when feature is disabled
		th.App.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test_trigger")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status, "Status should not change when NoOffline is disabled")
	})
}

// TestManualActionActivityScenario tests UpdateActivityFromManualAction
func TestManualActionActivityScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: User marks message as unread - becomes Online from Away", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set user to Away with old activity
		awayStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (10 * 60 * 1000),
		}
		th.App.SaveAndBroadcastStatus(awayStatus)

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status)

		// User performs manual action (like marking message as unread)
		th.App.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, model.StatusLogTriggerMarkUnread)

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Manual action should set user Online")
	})

	t.Run("Scenario: User sends message - updates LastActivityAt", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set user Online with old activity
		oldTime := model.GetMillis() - (5 * 60 * 1000)
		onlineStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.App.SaveAndBroadcastStatus(onlineStatus)

		// User sends a message (manual action)
		th.App.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, model.StatusLogTriggerSendMessage)

		// Verify LastActivityAt was updated
		status, appErr := th.App.GetStatus(th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.Greater(t, status.LastActivityAt, oldTime, "LastActivityAt should be updated")
	})
}

// TestCombinedFeaturesScenario tests interaction between AccurateStatuses and NoOffline
func TestCombinedFeaturesScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: Both features enabled - Offline user goes Online on heartbeat", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable both features
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Offline
		th.App.SetStatusOffline(th.BasicUser.Id, false, true)
		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOffline, status.Status)

		// Heartbeat with window active
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Combined features should set Offline user to Online")
	})
}

// TestMultiUserStatusScenario tests status visibility across users
func TestMultiUserStatusScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: User2 can see User1's status change", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set User1 to Away directly (SetStatusAwayIfNeeded may not work if user isn't in right state)
		awayStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (10 * 60 * 1000), // 10 min ago
		}
		th.App.SaveAndBroadcastStatus(awayStatus)

		// User2 checks User1's status
		th.LoginBasic2(t)
		status, _, err := th.Client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status, "User1 should be Away")

		// User1 becomes active via heartbeat with window active
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// User2 should see the updated status
		status, _, err = th.Client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "User2 should see User1's updated status")
	})

	t.Run("Scenario: Bulk status check with mixed statuses", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set different statuses for each user
		th.App.SetStatusOnline(th.BasicUser.Id, false)
		th.App.SetStatusAwayIfNeeded(th.BasicUser2.Id, true)

		// Get both statuses
		userIds := []string{th.BasicUser.Id, th.BasicUser2.Id}
		statuses, _, err := client.GetUsersStatusesByIds(context.Background(), userIds)
		require.NoError(t, err)
		require.Len(t, statuses, 2)

		statusMap := make(map[string]string)
		for _, s := range statuses {
			statusMap[s.UserId] = s.Status
		}

		assert.Equal(t, model.StatusOnline, statusMap[th.BasicUser.Id])
		assert.Equal(t, model.StatusAway, statusMap[th.BasicUser2.Id])
	})
}

// TestConfigurationScenario tests different configuration values
func TestConfigurationScenario(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("Scenario: Custom inactivity timeout is respected", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses with 2 minute timeout
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 2
		})

		// Set user Online with activity 1 minute ago (should stay Online)
		onlineStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (1 * 60 * 1000), // 1 min ago
		}
		th.App.SaveAndBroadcastStatus(onlineStatus)

		// Heartbeat with window inactive
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusOnline, status.Status, "Should stay Online - within 2min timeout")

		// Now set activity to 3 minutes ago (should go Away)
		onlineStatus.LastActivityAt = model.GetMillis() - (3 * 60 * 1000)
		th.App.SaveAndBroadcastStatus(onlineStatus)

		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		status, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusAway, status.Status, "Should be Away - exceeded 2min timeout")
	})

	t.Run("Scenario: DND timeout of 0 disables automatic offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable AccurateStatuses with DND timeout disabled
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 0 // Disabled
		})

		// Set DND with very old activity
		dndStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - (24 * 60 * 60 * 1000), // 24 hours ago
		}
		th.App.SaveAndBroadcastStatus(dndStatus)

		// Heartbeat
		th.App.Srv().Platform().UpdateActivityFromHeartbeat(th.BasicUser.Id, false, "", "desktop")

		status, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.StatusDnd, status.Status, "DND should NOT go Offline when timeout is 0")
	})
}

// TestWebSocketStatusEvents tests that status changes trigger WebSocket events
// NOTE: This test is skipped in CI because WebSocket tests are inherently flaky
// in containerized environments. The functionality is tested by:
// 1. Platform tests which verify BroadcastStatus is called
// 2. Manual testing in development
func TestWebSocketStatusEvents(t *testing.T) {
	// Skip in CI environment - WebSocket tests are flaky due to timing issues
	if os.Getenv("CI") == "true" || os.Getenv("GITHUB_ACTIONS") == "true" {
		t.Skip("Skipping WebSocket test in CI - flaky due to timing issues")
	}

	mainHelper.Parallel(t)

	t.Run("Scenario: Status change broadcasts WebSocket event", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create WebSocket client for User2
		th.LoginBasic2(t)
		wsClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer wsClient.Close()

		// Listen for status change events
		wsClient.Listen()

		// Give WebSocket time to connect - increase wait time for CI
		time.Sleep(1 * time.Second)

		// First ensure User1 is offline so the status change is visible
		th.App.SetStatusOffline(th.BasicUser.Id, false, true)

		// Small delay to let the offline status settle
		time.Sleep(100 * time.Millisecond)

		// User1 changes status to online
		th.App.SetStatusOnline(th.BasicUser.Id, false)

		// Wait for and verify WebSocket event with longer timeout for CI
		received := false
		timeout := time.After(10 * time.Second)

	eventLoop:
		for {
			select {
			case event := <-wsClient.EventChannel:
				if event.EventType() == model.WebsocketEventStatusChange {
					data := event.GetData()
					if data["user_id"] == th.BasicUser.Id {
						received = true
						break eventLoop
					}
				}
			case <-timeout:
				break eventLoop
			}
		}

		assert.True(t, received, "Should receive WebSocket status_change event")
	})
}
