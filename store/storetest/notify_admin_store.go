// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/stretchr/testify/require"
)

func TestNotifyAdminStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testNotifyAdminStoreSave(t, ss) })
	t.Run("testGetDataByUserIdAndFeature", func(t *testing.T) { testGetDataByUserIdAndFeature(t, ss) })
	t.Run("testGet", func(t *testing.T) { testGet(t, ss) })
	t.Run("testDeleteAll", func(t *testing.T) { testDeleteAll(t, ss) })
}

func tearDown(t *testing.T, ss store.Store) {
	err := ss.NotifyAdmin().DeleteAll(true)
	require.NoError(t, err)

	err = ss.NotifyAdmin().DeleteAll(false)
	require.NoError(t, err)
}

func testNotifyAdminStoreSave(t *testing.T, ss store.Store) {
	d1 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Professional features",
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	d2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "Unknown feature",
	}

	_, err = ss.NotifyAdmin().Save(d2)
	require.Error(t, err)

	d3 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "Unknown plan",
		RequiredFeature: "All Professional features",
	}
	_, err = ss.NotifyAdmin().Save(d3)
	require.Error(t, err)

	tearDown(t, ss)
}

func testGet(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Professional features",
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	d1Trial := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Enterprise features",
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial)
	require.NoError(t, err)

	d1Trial2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Enterprise features",
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial2)
	require.NoError(t, err)

	upgradeRequests, err := ss.NotifyAdmin().Get(false)
	require.NoError(t, err)
	require.Equal(t, len(upgradeRequests), 1)

	trialRequests, err := ss.NotifyAdmin().Get(true)
	require.NoError(t, err)
	require.Equal(t, len(trialRequests), 2)

	tearDown(t, ss)
}

func testGetDataByUserIdAndFeature(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Professional features",
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	userId2 := model.NewId()
	d2 := &model.NotifyAdminData{
		UserId:          userId2,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "Custom User groups",
	}

	_, err = ss.NotifyAdmin().Save(d2)
	require.NoError(t, err)

	user1Request, err := ss.NotifyAdmin().GetDataByUserIdAndFeature(userId1, "All Professional features")
	require.NoError(t, err)
	require.Equal(t, len(user1Request), 1)
	require.Equal(t, user1Request[0].RequiredFeature, "All Professional features")

	tearDown(t, ss)
}

func testDeleteAll(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Professional features",
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	d1Trial := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Enterprise features",
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial)
	require.NoError(t, err)

	d1Trial2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "cloud-professional",
		RequiredFeature: "All Enterprise features",
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial2)
	require.NoError(t, err)

	err = ss.NotifyAdmin().DeleteAll(false) // delete all upgrade requests
	require.NoError(t, err)

	upgradeRequests, err := ss.NotifyAdmin().Get(false)
	require.NoError(t, err)
	require.Equal(t, len(upgradeRequests), 0)

	trialRequests, err := ss.NotifyAdmin().Get(true)
	require.NoError(t, err)
	require.Equal(t, len(trialRequests), 2) // trial requests should still exist

	err = ss.NotifyAdmin().DeleteAll(true) // delete all trial requests
	require.NoError(t, err)

	trialRequests, err = ss.NotifyAdmin().Get(false)
	require.NoError(t, err)
	require.Equal(t, len(trialRequests), 0)
}
