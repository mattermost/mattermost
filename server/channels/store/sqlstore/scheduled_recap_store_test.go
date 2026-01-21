// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createTestScheduledRecap creates a valid ScheduledRecap for testing
func createTestScheduledRecap(userId string) *model.ScheduledRecap {
	return &model.ScheduledRecap{
		Id:          model.NewId(),
		UserId:      userId,
		Title:       "Test Scheduled Recap",
		DaysOfWeek:  model.Weekdays,
		TimeOfDay:   "09:00",
		Timezone:    "America/New_York",
		TimePeriod:  model.TimePeriodLast24h,
		NextRunAt:   model.GetMillis() + 3600000, // 1 hour from now
		LastRunAt:   0,
		RunCount:    0,
		ChannelMode: model.ChannelModeSpecific,
		ChannelIds:  []string{model.NewId(), model.NewId()},
		AgentId:     "test-agent",
		IsRecurring: true,
		Enabled:     true,
		CreateAt:    model.GetMillis(),
		UpdateAt:    model.GetMillis(),
		DeleteAt:    0,
	}
}

func TestScheduledRecapStore(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		t.Run("SaveAndGet", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)

			savedSR, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)
			assert.Equal(t, sr.Id, savedSR.Id)
			assert.Equal(t, sr.UserId, savedSR.UserId)
			assert.Equal(t, sr.Title, savedSR.Title)
			assert.NotZero(t, savedSR.CreateAt)
			assert.NotZero(t, savedSR.UpdateAt)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, sr.Id, retrievedSR.Id)
			assert.Equal(t, sr.UserId, retrievedSR.UserId)
			assert.Equal(t, sr.Title, retrievedSR.Title)
			assert.Equal(t, sr.DaysOfWeek, retrievedSR.DaysOfWeek)
			assert.Equal(t, sr.TimeOfDay, retrievedSR.TimeOfDay)
			assert.Equal(t, sr.Timezone, retrievedSR.Timezone)
			assert.Equal(t, sr.TimePeriod, retrievedSR.TimePeriod)
			assert.Equal(t, sr.ChannelMode, retrievedSR.ChannelMode)
			assert.Equal(t, sr.ChannelIds, retrievedSR.ChannelIds)
			assert.Equal(t, sr.AgentId, retrievedSR.AgentId)
			assert.Equal(t, sr.IsRecurring, retrievedSR.IsRecurring)
			assert.Equal(t, sr.Enabled, retrievedSR.Enabled)
		})

		t.Run("GetNotFound", func(t *testing.T) {
			_, err := ss.ScheduledRecap().Get(model.NewId())
			require.Error(t, err)
			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)
		})

		t.Run("GetForUser", func(t *testing.T) {
			userId := model.NewId()
			otherUserId := model.NewId()

			// Create 3 scheduled recaps for same user
			for i := 0; i < 3; i++ {
				sr := createTestScheduledRecap(userId)
				sr.Id = model.NewId()
				sr.Title = "Recap " + string(rune('A'+i))
				_, err := ss.ScheduledRecap().Save(sr)
				require.NoError(t, err)
			}

			// Create 1 for different user
			otherSR := createTestScheduledRecap(otherUserId)
			_, err := ss.ScheduledRecap().Save(otherSR)
			require.NoError(t, err)

			// Should only return 3 for first user
			recaps, err := ss.ScheduledRecap().GetForUser(userId, 0, 10)
			require.NoError(t, err)
			assert.Len(t, recaps, 3)

			// Test pagination - page 0, perPage 2 should return 2
			recapsPage, err := ss.ScheduledRecap().GetForUser(userId, 0, 2)
			require.NoError(t, err)
			assert.Len(t, recapsPage, 2)
		})

		t.Run("Update", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			// Modify fields
			sr.Title = "Updated Title"
			sr.DaysOfWeek = model.Weekend
			sr.TimeOfDay = "14:30"
			sr.ChannelIds = []string{model.NewId()}

			updatedSR, err := ss.ScheduledRecap().Update(sr)
			require.NoError(t, err)
			assert.Equal(t, "Updated Title", updatedSR.Title)

			// Verify persisted
			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, "Updated Title", retrievedSR.Title)
			assert.Equal(t, model.Weekend, retrievedSR.DaysOfWeek)
			assert.Equal(t, "14:30", retrievedSR.TimeOfDay)
			assert.Len(t, retrievedSR.ChannelIds, 1)
		})

		t.Run("DeleteSoftDelete", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			// Delete (soft)
			err = ss.ScheduledRecap().Delete(sr.Id)
			require.NoError(t, err)

			// GetForUser should return 0 (soft deleted)
			recaps, err := ss.ScheduledRecap().GetForUser(userId, 0, 10)
			require.NoError(t, err)
			assert.Len(t, recaps, 0)

			// Direct Get should still return the record with DeleteAt set
			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.NotZero(t, retrievedSR.DeleteAt)
		})

		t.Run("GetDueBefore", func(t *testing.T) {
			now := model.GetMillis()
			userId := model.NewId()

			// Create one due in past (should be returned)
			pastSR := createTestScheduledRecap(userId)
			pastSR.Id = model.NewId()
			pastSR.NextRunAt = now - 3600000 // 1 hour ago
			pastSR.Enabled = true
			_, err := ss.ScheduledRecap().Save(pastSR)
			require.NoError(t, err)

			// Create one due now (should be returned)
			nowSR := createTestScheduledRecap(userId)
			nowSR.Id = model.NewId()
			nowSR.NextRunAt = now
			nowSR.Enabled = true
			_, err = ss.ScheduledRecap().Save(nowSR)
			require.NoError(t, err)

			// Create one due in future (should NOT be returned)
			futureSR := createTestScheduledRecap(userId)
			futureSR.Id = model.NewId()
			futureSR.NextRunAt = now + 3600000 // 1 hour from now
			futureSR.Enabled = true
			_, err = ss.ScheduledRecap().Save(futureSR)
			require.NoError(t, err)

			// Create one that's disabled (should NOT be returned)
			disabledSR := createTestScheduledRecap(userId)
			disabledSR.Id = model.NewId()
			disabledSR.NextRunAt = now - 3600000
			disabledSR.Enabled = false
			_, err = ss.ScheduledRecap().Save(disabledSR)
			require.NoError(t, err)

			// Create one that's deleted (should NOT be returned)
			deletedSR := createTestScheduledRecap(userId)
			deletedSR.Id = model.NewId()
			deletedSR.NextRunAt = now - 3600000
			deletedSR.Enabled = true
			_, err = ss.ScheduledRecap().Save(deletedSR)
			require.NoError(t, err)
			err = ss.ScheduledRecap().Delete(deletedSR.Id)
			require.NoError(t, err)

			// Query for due recaps
			dueRecaps, err := ss.ScheduledRecap().GetDueBefore(now, 10)
			require.NoError(t, err)

			// Should have 2: pastSR and nowSR
			assert.Len(t, dueRecaps, 2)

			// Verify ordered by NextRunAt ASC (oldest first)
			if len(dueRecaps) >= 2 {
				assert.True(t, dueRecaps[0].NextRunAt <= dueRecaps[1].NextRunAt)
			}

			// Verify we got the right IDs (past and now)
			ids := make(map[string]bool)
			for _, r := range dueRecaps {
				ids[r.Id] = true
			}
			assert.True(t, ids[pastSR.Id], "past recap should be returned")
			assert.True(t, ids[nowSR.Id], "now recap should be returned")
			assert.False(t, ids[futureSR.Id], "future recap should NOT be returned")
			assert.False(t, ids[disabledSR.Id], "disabled recap should NOT be returned")
			assert.False(t, ids[deletedSR.Id], "deleted recap should NOT be returned")
		})

		t.Run("UpdateNextRunAt", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			originalNextRunAt := sr.NextRunAt
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			// Update NextRunAt
			newNextRunAt := originalNextRunAt + 86400000 // +1 day
			err = ss.ScheduledRecap().UpdateNextRunAt(sr.Id, newNextRunAt)
			require.NoError(t, err)

			// Verify
			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, newNextRunAt, retrievedSR.NextRunAt)
			assert.True(t, retrievedSR.UpdateAt >= sr.UpdateAt)
		})

		t.Run("MarkExecuted", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			sr.RunCount = 0
			sr.LastRunAt = 0
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			now := model.GetMillis()
			nextRun := now + 86400000 // +1 day

			// First execution
			err = ss.ScheduledRecap().MarkExecuted(sr.Id, now, nextRun)
			require.NoError(t, err)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, now, retrievedSR.LastRunAt)
			assert.Equal(t, nextRun, retrievedSR.NextRunAt)
			assert.Equal(t, 1, retrievedSR.RunCount)

			// Second execution
			time.Sleep(10 * time.Millisecond) // ensure different timestamp
			now2 := model.GetMillis()
			nextRun2 := now2 + 86400000

			err = ss.ScheduledRecap().MarkExecuted(sr.Id, now2, nextRun2)
			require.NoError(t, err)

			retrievedSR2, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, now2, retrievedSR2.LastRunAt)
			assert.Equal(t, nextRun2, retrievedSR2.NextRunAt)
			assert.Equal(t, 2, retrievedSR2.RunCount)
		})

		t.Run("SetEnabled", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			sr.Enabled = true
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			// Disable
			err = ss.ScheduledRecap().SetEnabled(sr.Id, false)
			require.NoError(t, err)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.False(t, retrievedSR.Enabled)

			// Re-enable
			err = ss.ScheduledRecap().SetEnabled(sr.Id, true)
			require.NoError(t, err)

			retrievedSR2, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.True(t, retrievedSR2.Enabled)
		})

		t.Run("ChannelIdsJsonSerialization", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			sr.ChannelIds = []string{"ch1", "ch2", "ch3"}
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Equal(t, []string{"ch1", "ch2", "ch3"}, retrievedSR.ChannelIds)
		})

		t.Run("EmptyChannelIds", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			sr.ChannelMode = model.ChannelModeAllUnreads
			sr.ChannelIds = []string{}
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			assert.Empty(t, retrievedSR.ChannelIds)
		})

		t.Run("NilChannelIds", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			sr.ChannelMode = model.ChannelModeAllUnreads
			sr.ChannelIds = nil
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			retrievedSR, err := ss.ScheduledRecap().Get(sr.Id)
			require.NoError(t, err)
			// nil is serialized as "null", should unmarshal back to nil
			assert.Nil(t, retrievedSR.ChannelIds)
		})
	})
}
