// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/client"
	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

func createTestSubscriptions(client *client.Client, num int) ([]*model.Subscription, string, error) {
	newSubs := make([]*model.Subscription, 0, num)

	user, resp := client.GetMe()
	if resp.Error != nil {
		return nil, "", fmt.Errorf("cannot get current user: %w", resp.Error)
	}

	board := &model.Board{
		TeamID:   "0",
		Type:     model.BoardTypeOpen,
		CreateAt: 1,
		UpdateAt: 1,
	}
	board, resp = client.CreateBoard(board)
	if resp.Error != nil {
		return nil, "", fmt.Errorf("cannot insert test board block: %w", resp.Error)
	}

	for n := 0; n < num; n++ {
		newBlock := &model.Block{
			ID:       utils.NewID(utils.IDTypeCard),
			BoardID:  board.ID,
			CreateAt: 1,
			UpdateAt: 1,
			Type:     model.TypeCard,
		}

		newBlocks, resp := client.InsertBlocks(board.ID, []*model.Block{newBlock}, false)
		if resp.Error != nil {
			return nil, "", fmt.Errorf("cannot insert test card block: %w", resp.Error)
		}
		newBlock = newBlocks[0]

		sub := &model.Subscription{
			BlockType:      newBlock.Type,
			BlockID:        newBlock.ID,
			SubscriberType: model.SubTypeUser,
			SubscriberID:   user.ID,
		}

		subNew, resp := client.CreateSubscription(sub)
		if resp.Error != nil {
			return nil, "", resp.Error
		}
		newSubs = append(newSubs, subNew)
	}
	return newSubs, user.ID, nil
}

func TestCreateSubscription(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	t.Run("Create valid subscription", func(t *testing.T) {
		subs, userID, err := createTestSubscriptions(th.Client, 5)
		require.NoError(t, err)
		require.Len(t, subs, 5)

		// fetch the newly created subscriptions and compare
		subsFound, resp := th.Client.GetSubscriptions(userID)
		require.NoError(t, resp.Error)
		require.Len(t, subsFound, 5)
		assert.ElementsMatch(t, subs, subsFound)
	})

	t.Run("Create invalid subscription", func(t *testing.T) {
		user, resp := th.Client.GetMe()
		require.NoError(t, resp.Error)

		sub := &model.Subscription{
			SubscriberID: user.ID,
		}
		_, resp = th.Client.CreateSubscription(sub)
		require.Error(t, resp.Error)
	})

	t.Run("Create subscription for another user", func(t *testing.T) {
		sub := &model.Subscription{
			SubscriberID: utils.NewID(utils.IDTypeUser),
		}
		_, resp := th.Client.CreateSubscription(sub)
		require.Error(t, resp.Error)
	})
}

func TestGetSubscriptions(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	t.Run("Get subscriptions for user", func(t *testing.T) {
		mySubs, user1ID, err := createTestSubscriptions(th.Client, 5)
		require.NoError(t, err)
		require.Len(t, mySubs, 5)

		// create more subscriptions with different user
		otherSubs, _, err := createTestSubscriptions(th.Client2, 10)
		require.NoError(t, err)
		require.Len(t, otherSubs, 10)

		// fetch the newly created subscriptions for current user, making sure only
		// the ones created for the current user are returned.
		subsFound, resp := th.Client.GetSubscriptions(user1ID)
		require.NoError(t, resp.Error)
		require.Len(t, subsFound, 5)
		assert.ElementsMatch(t, mySubs, subsFound)
	})
}

func TestDeleteSubscription(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	t.Run("Delete valid subscription", func(t *testing.T) {
		subs, userID, err := createTestSubscriptions(th.Client, 3)
		require.NoError(t, err)
		require.Len(t, subs, 3)

		resp := th.Client.DeleteSubscription(subs[1].BlockID, userID)
		require.NoError(t, resp.Error)

		// fetch the subscriptions and ensure the list is correct
		subsFound, resp := th.Client.GetSubscriptions(userID)
		require.NoError(t, resp.Error)
		require.Len(t, subsFound, 2)

		assert.Contains(t, subsFound, subs[0])
		assert.Contains(t, subsFound, subs[2])
		assert.NotContains(t, subsFound, subs[1])
	})

	t.Run("Delete invalid subscription", func(t *testing.T) {
		user, resp := th.Client.GetMe()
		require.NoError(t, resp.Error)

		resp = th.Client.DeleteSubscription("bogus", user.ID)
		require.Error(t, resp.Error)
	})
}
