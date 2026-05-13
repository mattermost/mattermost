// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecapStore(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		t.Run("SaveAndGetRecap", func(t *testing.T) {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            model.NewId(),
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusPending,
				BotID:             "test-bot-id",
			}

			savedRecap, err := ss.Recap().SaveRecap(recap)
			require.NoError(t, err)
			assert.Equal(t, recap.Id, savedRecap.Id)
			assert.Equal(t, recap.UserId, savedRecap.UserId)
			assert.Equal(t, recap.Title, savedRecap.Title)
			assert.Equal(t, recap.BotID, savedRecap.BotID)

			retrievedRecap, err := ss.Recap().GetRecap(recap.Id)
			require.NoError(t, err)
			assert.Equal(t, recap.Id, retrievedRecap.Id)
			assert.Equal(t, recap.UserId, retrievedRecap.UserId)
			assert.Equal(t, recap.Title, retrievedRecap.Title)
			assert.Equal(t, recap.TotalMessageCount, retrievedRecap.TotalMessageCount)
			assert.Equal(t, recap.Status, retrievedRecap.Status)
			assert.Equal(t, recap.BotID, retrievedRecap.BotID)
		})

		t.Run("GetRecapsForUser", func(t *testing.T) {
			userId := model.NewId()

			// Create multiple recaps for the same user
			for range 3 {
				recap := &model.Recap{
					Id:                model.NewId(),
					UserId:            userId,
					Title:             "Test Recap",
					CreateAt:          model.GetMillis(),
					UpdateAt:          model.GetMillis(),
					DeleteAt:          0,
					ReadAt:            0,
					TotalMessageCount: 10,
					Status:            model.RecapStatusCompleted,
					BotID:             "test-bot-id",
				}
				_, err := ss.Recap().SaveRecap(recap)
				require.NoError(t, err)
			}

			recaps, err := ss.Recap().GetRecapsForUser(userId, 0, 10)
			require.NoError(t, err)
			assert.Len(t, recaps, 3)
		})

		t.Run("UpdateRecapStatus", func(t *testing.T) {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            model.NewId(),
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusPending,
				BotID:             "test-bot-id",
			}

			_, err := ss.Recap().SaveRecap(recap)
			require.NoError(t, err)

			err = ss.Recap().UpdateRecapStatus(recap.Id, model.RecapStatusCompleted)
			require.NoError(t, err)

			updatedRecap, err := ss.Recap().GetRecap(recap.Id)
			require.NoError(t, err)
			assert.Equal(t, model.RecapStatusCompleted, updatedRecap.Status)
		})

		t.Run("SaveAndGetRecapChannels", func(t *testing.T) {
			recapId := model.NewId()

			// Create a recap first
			recap := &model.Recap{
				Id:                recapId,
				UserId:            model.NewId(),
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusPending,
				BotID:             "test-bot-id",
			}
			_, err := ss.Recap().SaveRecap(recap)
			require.NoError(t, err)

			// Create recap channels
			recapChannel1 := &model.RecapChannel{
				Id:            model.NewId(),
				RecapId:       recapId,
				ChannelId:     model.NewId(),
				ChannelName:   "Test Channel 1",
				Highlights:    []string{"Highlight 1", "Highlight 2"},
				ActionItems:   []string{"Action 1"},
				SourcePostIds: []string{model.NewId(), model.NewId()},
				CreateAt:      model.GetMillis(),
			}

			recapChannel2 := &model.RecapChannel{
				Id:            model.NewId(),
				RecapId:       recapId,
				ChannelId:     model.NewId(),
				ChannelName:   "Test Channel 2",
				Highlights:    []string{},
				ActionItems:   []string{"Action 2", "Action 3"},
				SourcePostIds: []string{model.NewId()},
				CreateAt:      model.GetMillis(),
			}

			err = ss.Recap().SaveRecapChannel(recapChannel1)
			require.NoError(t, err)

			err = ss.Recap().SaveRecapChannel(recapChannel2)
			require.NoError(t, err)

			// Retrieve recap channels
			channels, err := ss.Recap().GetRecapChannelsByRecapId(recapId)
			require.NoError(t, err)
			assert.Len(t, channels, 2)

			// Verify data integrity
			for _, ch := range channels {
				if ch.Id == recapChannel1.Id {
					assert.Equal(t, recapChannel1.ChannelName, ch.ChannelName)
					assert.Equal(t, recapChannel1.Highlights, ch.Highlights)
					assert.Equal(t, recapChannel1.ActionItems, ch.ActionItems)
					assert.Equal(t, recapChannel1.SourcePostIds, ch.SourcePostIds)
				} else if ch.Id == recapChannel2.Id {
					assert.Equal(t, recapChannel2.ChannelName, ch.ChannelName)
					assert.Equal(t, recapChannel2.Highlights, ch.Highlights)
					assert.Equal(t, recapChannel2.ActionItems, ch.ActionItems)
					assert.Equal(t, recapChannel2.SourcePostIds, ch.SourcePostIds)
				}
			}
		})

		t.Run("MarkRecapsAsViewed", func(t *testing.T) {
			userId := model.NewId()
			otherUserId := model.NewId()

			save := func(userID, status string, viewedAt int64) string {
				r := &model.Recap{
					Id:                model.NewId(),
					UserId:            userID,
					Title:             "T",
					CreateAt:          model.GetMillis(),
					UpdateAt:          model.GetMillis(),
					Status:            status,
					ViewedAt:          viewedAt,
					BotID:             "bot",
					TotalMessageCount: 1,
				}
				_, err := ss.Recap().SaveRecap(r)
				require.NoError(t, err)
				return r.Id
			}

			completed := save(userId, model.RecapStatusCompleted, 0)
			failed := save(userId, model.RecapStatusFailed, 0)
			pending := save(userId, model.RecapStatusPending, 0)
			processing := save(userId, model.RecapStatusProcessing, 0)
			alreadyViewed := save(userId, model.RecapStatusCompleted, 1234)
			otherUser := save(otherUserId, model.RecapStatusCompleted, 0)

			ids, err := ss.Recap().MarkRecapsAsViewed(userId, []string{model.RecapStatusCompleted, model.RecapStatusFailed})
			require.NoError(t, err)
			assert.ElementsMatch(t, []string{completed, failed}, ids)

			// completed and failed are now viewed
			r1, err := ss.Recap().GetRecap(completed)
			require.NoError(t, err)
			assert.NotZero(t, r1.ViewedAt)
			r2, err := ss.Recap().GetRecap(failed)
			require.NoError(t, err)
			assert.NotZero(t, r2.ViewedAt)

			// pending/processing untouched
			r3, err := ss.Recap().GetRecap(pending)
			require.NoError(t, err)
			assert.Zero(t, r3.ViewedAt)
			r4, err := ss.Recap().GetRecap(processing)
			require.NoError(t, err)
			assert.Zero(t, r4.ViewedAt)

			// already-viewed unchanged
			r5, err := ss.Recap().GetRecap(alreadyViewed)
			require.NoError(t, err)
			assert.Equal(t, int64(1234), r5.ViewedAt)

			// other user untouched
			r6, err := ss.Recap().GetRecap(otherUser)
			require.NoError(t, err)
			assert.Zero(t, r6.ViewedAt)

			// idempotent: second call returns no ids
			ids2, err := ss.Recap().MarkRecapsAsViewed(userId, []string{model.RecapStatusCompleted, model.RecapStatusFailed})
			require.NoError(t, err)
			assert.Empty(t, ids2)
		})

		t.Run("UpdateRecap persists ReadAt and ViewedAt resets", func(t *testing.T) {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            model.NewId(),
				Title:             "T",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				ReadAt:            500,
				ViewedAt:          600,
				Status:            model.RecapStatusCompleted,
				TotalMessageCount: 1,
				BotID:             "bot",
			}
			_, err := ss.Recap().SaveRecap(recap)
			require.NoError(t, err)

			// RegenerateRecap-style reset: clear both timestamps and revert status.
			recap.ReadAt = 0
			recap.ViewedAt = 0
			recap.Status = model.RecapStatusPending
			recap.UpdateAt = model.GetMillis()
			_, err = ss.Recap().UpdateRecap(recap)
			require.NoError(t, err)

			fresh, err := ss.Recap().GetRecap(recap.Id)
			require.NoError(t, err)
			assert.Zero(t, fresh.ReadAt, "ReadAt should be reset by UpdateRecap")
			assert.Zero(t, fresh.ViewedAt, "ViewedAt should be reset by UpdateRecap")
			assert.Equal(t, model.RecapStatusPending, fresh.Status)
		})

		t.Run("DeleteRecap", func(t *testing.T) {
			recap := &model.Recap{
				Id:                model.NewId(),
				UserId:            model.NewId(),
				Title:             "Test Recap",
				CreateAt:          model.GetMillis(),
				UpdateAt:          model.GetMillis(),
				DeleteAt:          0,
				ReadAt:            0,
				TotalMessageCount: 10,
				Status:            model.RecapStatusCompleted,
				BotID:             "test-bot-id",
			}

			_, err := ss.Recap().SaveRecap(recap)
			require.NoError(t, err)

			err = ss.Recap().DeleteRecap(recap.Id)
			require.NoError(t, err)

			// Verify soft delete - should not appear in user's recaps
			recaps, err := ss.Recap().GetRecapsForUser(recap.UserId, 0, 10)
			require.NoError(t, err)
			assert.Len(t, recaps, 0)
		})
	})
}
