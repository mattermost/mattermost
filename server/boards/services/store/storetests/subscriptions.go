// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/store"
)

//nolint:dupl
func StoreTestSubscriptionsStore(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("CreateSubscription", func(t *testing.T) {
		runStoreTests(t, testCreateSubscription)
	})
	t.Run("DeleteSubscription", func(t *testing.T) {
		runStoreTests(t, testDeleteSubscription)
	})
	t.Run("UndeleteSubscription", func(t *testing.T) {
		runStoreTests(t, testUndeleteSubscription)
	})
	t.Run("GetSubscription", func(t *testing.T) {
		runStoreTests(t, testGetSubscription)
	})
	t.Run("GetSubscriptions", func(t *testing.T) {
		runStoreTests(t, testGetSubscriptions)
	})
	t.Run("GetSubscribersForBlock", func(t *testing.T) {
		runStoreTests(t, testGetSubscribersForBlock)
	})
}

func testCreateSubscription(t *testing.T, store store.Store) {
	t.Run("create subscriptions", func(t *testing.T) {
		users := createTestUsers(t, store, 10)
		blocks := createTestBlocks(t, store, users[0].ID, 50)

		for i, user := range users {
			for j := 0; j < i; j++ {
				sub := &model.Subscription{
					BlockType:      blocks[j].Type,
					BlockID:        blocks[j].ID,
					SubscriberType: "user",
					SubscriberID:   user.ID,
				}
				subNew, err := store.CreateSubscription(sub)
				require.NoError(t, err, "create subscription should not error")

				assert.NotZero(t, subNew.NotifiedAt)
				assert.NotZero(t, subNew.CreateAt)
				assert.Zero(t, subNew.DeleteAt)
			}
		}

		// ensure each user has the right number of subscriptions
		for i, user := range users {
			subs, err := store.GetSubscriptions(user.ID)
			require.NoError(t, err, "get subscriptions should not error")
			assert.Len(t, subs, i)
		}
	})

	t.Run("duplicate subscription", func(t *testing.T) {
		admin := createTestUsers(t, store, 1)[0]
		user := createTestUsers(t, store, 1)[0]
		block := createTestBlocks(t, store, admin.ID, 1)[0]

		sub := &model.Subscription{
			BlockType:      block.Type,
			BlockID:        block.ID,
			SubscriberType: "user",
			SubscriberID:   user.ID,
		}
		subNew, err := store.CreateSubscription(sub)
		require.NoError(t, err, "create subscription should not error")

		sub = &model.Subscription{
			BlockType:      block.Type,
			BlockID:        block.ID,
			SubscriberType: "user",
			SubscriberID:   user.ID,
		}

		subDup, err := store.CreateSubscription(sub)
		require.NoError(t, err, "create duplicate subscription should not error")

		assert.Equal(t, subNew.BlockID, subDup.BlockID)
		assert.Equal(t, subNew.SubscriberID, subDup.SubscriberID)
	})

	t.Run("invalid subscription", func(t *testing.T) {
		admin := createTestUsers(t, store, 1)[0]
		user := createTestUsers(t, store, 1)[0]
		block := createTestBlocks(t, store, admin.ID, 1)[0]

		sub := &model.Subscription{}

		_, err := store.CreateSubscription(sub)
		assert.ErrorAs(t, err, &model.ErrInvalidSubscription{}, "invalid subscription should error")

		sub.BlockType = block.Type
		_, err = store.CreateSubscription(sub)
		assert.ErrorAs(t, err, &model.ErrInvalidSubscription{}, "invalid subscription should error")

		sub.BlockID = block.ID
		_, err = store.CreateSubscription(sub)
		assert.ErrorAs(t, err, &model.ErrInvalidSubscription{}, "invalid subscription should error")

		sub.SubscriberType = "user"
		_, err = store.CreateSubscription(sub)
		assert.ErrorAs(t, err, &model.ErrInvalidSubscription{}, "invalid subscription should error")

		sub.SubscriberID = user.ID
		subNew, err := store.CreateSubscription(sub)
		assert.NoError(t, err, "valid subscription should not error")

		assert.NoError(t, subNew.IsValid(), "created subscription should be valid")
	})
}

func testDeleteSubscription(t *testing.T, s store.Store) {
	t.Run("delete subscription", func(t *testing.T) {
		user := createTestUsers(t, s, 1)[0]
		block := createTestBlocks(t, s, user.ID, 1)[0]

		sub := &model.Subscription{
			BlockType:      block.Type,
			BlockID:        block.ID,
			SubscriberType: "user",
			SubscriberID:   user.ID,
		}
		subNew, err := s.CreateSubscription(sub)
		require.NoError(t, err, "create subscription should not error")

		// check the subscription exists
		subs, err := s.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Len(t, subs, 1)
		assert.Equal(t, subNew.BlockID, subs[0].BlockID)
		assert.Equal(t, subNew.SubscriberID, subs[0].SubscriberID)

		err = s.DeleteSubscription(block.ID, user.ID)
		require.NoError(t, err, "delete subscription should not error")

		// check the subscription was deleted
		subs, err = s.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Empty(t, subs)
	})

	t.Run("delete non-existent subscription", func(t *testing.T) {
		err := s.DeleteSubscription("bogus", "bogus")
		require.Error(t, err, "delete non-existent subscription should error")
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
	})
}

func testUndeleteSubscription(t *testing.T, s store.Store) {
	t.Run("undelete subscription", func(t *testing.T) {
		user := createTestUsers(t, s, 1)[0]
		block := createTestBlocks(t, s, user.ID, 1)[0]

		sub := &model.Subscription{
			BlockType:      block.Type,
			BlockID:        block.ID,
			SubscriberType: "user",
			SubscriberID:   user.ID,
		}
		subNew, err := s.CreateSubscription(sub)
		require.NoError(t, err, "create subscription should not error")

		// check the subscription exists
		subs, err := s.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Len(t, subs, 1)
		assert.Equal(t, subNew.BlockID, subs[0].BlockID)
		assert.Equal(t, subNew.SubscriberID, subs[0].SubscriberID)

		err = s.DeleteSubscription(block.ID, user.ID)
		require.NoError(t, err, "delete subscription should not error")

		// check the subscription was deleted
		subs, err = s.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Empty(t, subs)

		// re-create the subscription
		subUndeleted, err := s.CreateSubscription(sub)
		require.NoError(t, err, "create subscription should not error")

		// check the undeleted subscription exists
		subs, err = s.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Len(t, subs, 1)
		assert.Equal(t, subUndeleted.BlockID, subs[0].BlockID)
		assert.Equal(t, subUndeleted.SubscriberID, subs[0].SubscriberID)
	})
}

func testGetSubscription(t *testing.T, s store.Store) {
	t.Run("get subscription", func(t *testing.T) {
		user := createTestUsers(t, s, 1)[0]
		block := createTestBlocks(t, s, user.ID, 1)[0]

		sub := &model.Subscription{
			BlockType:      block.Type,
			BlockID:        block.ID,
			SubscriberType: "user",
			SubscriberID:   user.ID,
		}
		subNew, err := s.CreateSubscription(sub)
		require.NoError(t, err, "create subscription should not error")

		// make sure subscription can be fetched
		sub, err = s.GetSubscription(block.ID, user.ID)
		require.NoError(t, err, "get subscription should not error")
		assert.Equal(t, subNew, sub)
	})

	t.Run("get non-existent subscription", func(t *testing.T) {
		sub, err := s.GetSubscription("bogus", "bogus")
		require.Error(t, err, "get non-existent subscription should error")
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, sub, "get subscription should return nil")
	})
}

func testGetSubscriptions(t *testing.T, store store.Store) {
	t.Run("get subscriptions", func(t *testing.T) {
		author := createTestUsers(t, store, 1)[0]
		user := createTestUsers(t, store, 1)[0]
		blocks := createTestBlocks(t, store, author.ID, 50)

		for _, block := range blocks {
			sub := &model.Subscription{
				BlockType:      block.Type,
				BlockID:        block.ID,
				SubscriberType: "user",
				SubscriberID:   user.ID,
			}
			_, err := store.CreateSubscription(sub)
			require.NoError(t, err, "create subscription should not error")
		}

		// ensure user has the right number of subscriptions
		subs, err := store.GetSubscriptions(user.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Len(t, subs, len(blocks))

		// ensure author has no subscriptions
		subs, err = store.GetSubscriptions(author.ID)
		require.NoError(t, err, "get subscriptions should not error")
		assert.Empty(t, subs)
	})

	t.Run("get subscriptions for invalid user", func(t *testing.T) {
		subs, err := store.GetSubscriptions("bogus")
		require.NoError(t, err, "get subscriptions should not error")
		assert.Empty(t, subs)
	})
}

func testGetSubscribersForBlock(t *testing.T, store store.Store) {
	t.Run("get subscribers for block", func(t *testing.T) {
		users := createTestUsers(t, store, 50)
		blocks := createTestBlocks(t, store, users[0].ID, 2)

		for _, user := range users {
			sub := &model.Subscription{
				BlockType:      blocks[1].Type,
				BlockID:        blocks[1].ID,
				SubscriberType: "user",
				SubscriberID:   user.ID,
			}
			_, err := store.CreateSubscription(sub)
			require.NoError(t, err, "create subscription should not error")
		}

		// make sure block[1] has the right number of users subscribed
		subs, err := store.GetSubscribersForBlock(blocks[1].ID)
		require.NoError(t, err, "get subscribers for block should not error")
		assert.Len(t, subs, 50)

		count, err := store.GetSubscribersCountForBlock(blocks[1].ID)
		require.NoError(t, err, "get subscribers for block should not error")
		assert.Equal(t, 50, count)

		// make sure block[0] has zero users subscribed
		subs, err = store.GetSubscribersForBlock(blocks[0].ID)
		require.NoError(t, err, "get subscribers for block should not error")
		assert.Empty(t, subs)

		count, err = store.GetSubscribersCountForBlock(blocks[0].ID)
		require.NoError(t, err, "get subscribers for block should not error")
		assert.Zero(t, count)
	})

	t.Run("get subscribers for invalid block", func(t *testing.T) {
		subs, err := store.GetSubscribersForBlock("bogus")
		require.NoError(t, err, "get subscribers for block should not error")
		assert.Empty(t, subs)
	})
}
