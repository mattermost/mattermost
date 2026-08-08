// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"sort"
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

func scheduledRecapIDs(recaps []*model.ScheduledRecap) []string {
	ids := make([]string, 0, len(recaps))
	for _, recap := range recaps {
		ids = append(ids, recap.Id)
	}
	return ids
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
			for i := range 3 {
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

		t.Run("SaveIfUnderLimit", func(t *testing.T) {
			user, err := ss.User().Save(rctx, &model.User{
				Username: model.NewUsername(),
				Email:    model.NewId() + "@example.com",
			})
			require.NoError(t, err)
			userId := user.Id

			firstRecap := createTestScheduledRecap(userId)
			_, err = ss.ScheduledRecap().SaveIfUnderLimit(firstRecap, 1)
			require.NoError(t, err)

			secondRecap := createTestScheduledRecap(userId)
			secondRecap.Id = model.NewId()
			_, err = ss.ScheduledRecap().SaveIfUnderLimit(secondRecap, 1)
			require.Error(t, err)

			var limitErr *store.ErrLimitExceeded
			require.ErrorAs(t, err, &limitErr)
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

		t.Run("UpdateNotFound", func(t *testing.T) {
			sr := createTestScheduledRecap(model.NewId())

			_, err := ss.ScheduledRecap().Update(sr)
			require.Error(t, err)

			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)
		})

		t.Run("UpdateSoftDeletedReturnsNotFound", func(t *testing.T) {
			userId := model.NewId()
			sr := createTestScheduledRecap(userId)
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			err = ss.ScheduledRecap().Delete(sr.Id)
			require.NoError(t, err)

			sr.Title = "Should Not Update"
			_, err = ss.ScheduledRecap().Update(sr)
			require.Error(t, err)

			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)
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

			// Direct Get should not return soft-deleted records
			_, err = ss.ScheduledRecap().Get(sr.Id)
			require.Error(t, err)
			var nfErr *store.ErrNotFound
			require.ErrorAs(t, err, &nfErr)
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
			dueRecaps, err := ss.ScheduledRecap().GetDueBefore(now, 0, "", 10)
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

		t.Run("GetDueBeforeKeysetPagination", func(t *testing.T) {
			userId := model.NewId()
			base := model.GetMillis() - 30*24*3600*1000
			queryAt := base + 3600000

			ties := make([]*model.ScheduledRecap, 3)
			for i := range ties {
				ties[i] = createTestScheduledRecap(userId)
				ties[i].NextRunAt = base
				_, err := ss.ScheduledRecap().Save(ties[i])
				require.NoError(t, err)
			}

			sortedTies := scheduledRecapIDs(ties)
			sort.Strings(sortedTies)

			later1 := createTestScheduledRecap(userId)
			later1.NextRunAt = base + 1000
			_, err := ss.ScheduledRecap().Save(later1)
			require.NoError(t, err)

			later2 := createTestScheduledRecap(userId)
			later2.NextRunAt = base + 2000
			_, err = ss.ScheduledRecap().Save(later2)
			require.NoError(t, err)

			disabledInWindow := createTestScheduledRecap(userId)
			disabledInWindow.NextRunAt = base
			disabledInWindow.Enabled = false
			_, err = ss.ScheduledRecap().Save(disabledInWindow)
			require.NoError(t, err)

			seededIDs := map[string]struct{}{
				ties[0].Id:          {},
				ties[1].Id:          {},
				ties[2].Id:          {},
				later1.Id:           {},
				later2.Id:           {},
				disabledInWindow.Id: {},
			}
			filterSeeded := func(recaps []*model.ScheduledRecap) []string {
				ids := make([]string, 0, len(recaps))
				for _, recap := range recaps {
					if _, ok := seededIDs[recap.Id]; ok {
						ids = append(ids, recap.Id)
					}
				}
				return ids
			}

			tests := []struct {
				name     string
				cursorAt int64
				cursorID string
				limit    int
				want     []string
			}{
				{
					name:  "zero cursor starts at beginning",
					limit: 2,
					want:  []string{sortedTies[0], sortedTies[1]},
				},
				{
					name:     "cursor resumes inside tie",
					cursorAt: base,
					cursorID: sortedTies[1],
					limit:    2,
					want:     []string{sortedTies[2], later1.Id},
				},
				{
					name:     "short final page",
					cursorAt: later1.NextRunAt,
					cursorID: later1.Id,
					limit:    2,
					want:     []string{later2.Id},
				},
				{
					name:     "cursor at last row",
					cursorAt: later2.NextRunAt,
					cursorID: later2.Id,
					limit:    2,
					want:     []string{},
				},
				{
					name:     "cursor row excluded",
					cursorAt: base,
					cursorID: sortedTies[2],
					limit:    10,
					want:     []string{later1.Id, later2.Id},
				},
				{
					name:  "limit one",
					limit: 1,
					want:  []string{sortedTies[0]},
				},
				{
					name:  "full ordered drain",
					limit: 10,
					want:  []string{sortedTies[0], sortedTies[1], sortedTies[2], later1.Id, later2.Id},
				},
			}

			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					recaps, err := ss.ScheduledRecap().GetDueBefore(queryAt, tt.cursorAt, tt.cursorID, tt.limit)
					require.NoError(t, err)
					require.Equal(t, tt.want, filterSeeded(recaps))
				})
			}
		})

		t.Run("GetDueBeforeReflectsMarkExecuted", func(t *testing.T) {
			userId := model.NewId()
			now := model.GetMillis()

			sr := createTestScheduledRecap(userId)
			sr.NextRunAt = now - 3600000
			_, err := ss.ScheduledRecap().Save(sr)
			require.NoError(t, err)

			dueRecaps, err := ss.ScheduledRecap().GetDueBefore(now, 0, "", 10)
			require.NoError(t, err)
			require.Contains(t, scheduledRecapIDs(dueRecaps), sr.Id)

			err = ss.ScheduledRecap().MarkExecuted(sr.Id, now, now+3600000)
			require.NoError(t, err)

			dueRecaps, err = ss.ScheduledRecap().GetDueBefore(now, 0, "", 10)
			require.NoError(t, err)
			require.NotContains(t, scheduledRecapIDs(dueRecaps), sr.Id)
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
			assert.Equal(t, model.StringArray{"ch1", "ch2", "ch3"}, retrievedSR.ChannelIds)
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
