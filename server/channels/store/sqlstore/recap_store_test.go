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
