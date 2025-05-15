// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

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

func TestQueueSetStatusOffline(t *testing.T) {
	th := Setup(t).InitBasic()

	defer func() {
		// First tear down the test environment
		th.TearDown()

		// Then verify that the status update processor has properly shut down
		// by checking that the done signal channel is closed
		select {
		case _, ok := <-th.Service.statusUpdateDoneSignal:
			// If channel is closed, ok will be false
			assert.False(t, ok, "statusUpdateDoneSignal channel should be closed after teardown")
		case <-time.After(5 * time.Second):
			require.Fail(t, "Timed out waiting for status update processor to shut down")
		}
	}()

	// Create multiple user IDs
	userIDs := []string{
		th.BasicUser.Id,
		model.NewId(),
		model.NewId(),
		model.NewId(),
	}

	// Add duplicate user IDs to test duplicate handling
	// The second occurrence should override the first
	userIDs = append(userIDs, userIDs[0], userIDs[1])

	// Initially set all users to online
	for _, userID := range userIDs {
		th.Service.SetStatusOnline(userID, false)
		status, err := th.Service.GetStatus(userID)
		require.Nil(t, err, "Failed to get initial status")
		require.Equal(t, model.StatusOnline, status.Status, "User should be online initially")
	}

	// Queue status updates to offline
	for i, userID := range userIDs {
		// Set every other status as manual to test both cases
		manual := i%2 == 0
		th.Service.QueueSetStatusOffline(userID, manual)
	}

	// Wait for the background processor to handle the updates
	// Use eventually consistent approach with retries
	for _, userID := range userIDs {
		var status *model.Status
		var err *model.AppError

		// Use poll-wait pattern to account for async processing
		require.Eventually(t, func() bool {
			status, err = th.Service.GetStatus(userID)
			return err == nil && status.Status == model.StatusOffline
		}, 5*time.Second, 100*time.Millisecond, "Status wasn't updated to offline")

		// For the duplicated user IDs, check that manual setting is based on the last call
		// User[0] and User[1] are duplicated at the end of the slice
		if userID == userIDs[0] {
			// Last update for userIDs[0] was at index 4 (i%2 == 0, so manual = true)
			require.True(t, status.Manual, "User should have manual status (duplicate case)")
		} else if userID == userIDs[1] {
			// Last update for userIDs[1] was at index 5 (i%2 == 1, so manual = false)
			require.False(t, status.Manual, "User should have automatic status (duplicate case)")
		} else {
			// Check manual flag is set correctly for other users
			idx := -1
			for i, id := range userIDs[:4] { // original users only
				if id == userID {
					idx = i
					break
				}
			}
			require.Equal(t, idx%2 == 0, status.Manual, "Manual flag incorrect")
		}
	}

	// Verify all relevant status fields
	for _, userID := range model.RemoveDuplicateStrings(userIDs) {
		status, err := th.Service.GetStatus(userID)
		require.Nil(t, err, "Failed to get status")
		require.Equal(t, model.StatusOffline, status.Status, "User should be offline")
		require.Equal(t, "", status.ActiveChannel, "ActiveChannel should be empty")
	}
}
