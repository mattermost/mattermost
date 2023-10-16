// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const PluginIdJenkins = "jenkins"

func TestNotifyAdminStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testNotifyAdminStoreSave(t, ss) })
	t.Run("testGetDataByUserIdAndFeature", func(t *testing.T) { testGetDataByUserIdAndFeature(t, ss) })
	t.Run("testGet", func(t *testing.T) { testGet(t, ss) })
	t.Run("testDeleteBefore", func(t *testing.T) { testDeleteBefore(t, ss) })
	t.Run("testUpdate", func(t *testing.T) { testUpdate(t, ss) })
}

func tearDown(t *testing.T, ss store.Store) {
	err := ss.NotifyAdmin().DeleteBefore(true, model.GetMillis()+model.GetMillis())
	require.NoError(t, err)

	err = ss.NotifyAdmin().DeleteBefore(false, model.GetMillis()+model.GetMillis())
	require.NoError(t, err)
}

func testNotifyAdminStoreSave(t *testing.T, ss store.Store) {
	d1 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	// unknow plan error
	d2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: "Unknown feature",
	}

	_, err = ss.NotifyAdmin().Save(d2)
	require.Error(t, err)

	// unknown feature error
	d3 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    "Unknown plan",
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}
	_, err = ss.NotifyAdmin().Save(d3)
	require.Error(t, err)

	// same user requesting same feature error
	singleUserId := model.NewId()
	d5 := &model.NotifyAdminData{
		UserId:          singleUserId,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}
	_, err = ss.NotifyAdmin().Save(d5)
	require.NoError(t, err)

	d6 := &model.NotifyAdminData{
		UserId:          singleUserId,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}
	_, err = ss.NotifyAdmin().Save(d6)
	require.Error(t, err)

	tearDown(t, ss)
}

func testGet(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	d1Trial := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    model.LicenseShortSkuEnterprise,
		RequiredFeature: model.PaidFeatureAllEnterprisefeatures,
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial)
	require.NoError(t, err)

	d1Trial2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    model.LicenseShortSkuEnterprise,
		RequiredFeature: model.PaidFeatureAllEnterprisefeatures,
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
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	userId2 := model.NewId()
	d2 := &model.NotifyAdminData{
		UserId:          userId2,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureCustomUsergroups,
	}

	_, err = ss.NotifyAdmin().Save(d2)
	require.NoError(t, err)

	user1Request, err := ss.NotifyAdmin().GetDataByUserIdAndFeature(userId1, model.PaidFeatureAllProfessionalfeatures)
	require.NoError(t, err)
	require.Equal(t, len(user1Request), 1)
	require.Equal(t, user1Request[0].RequiredFeature, model.PaidFeatureAllProfessionalfeatures)

	tearDown(t, ss)
}

func testUpdate(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    PluginIdJenkins,
		RequiredFeature: model.PluginFeature,
	}
	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	err = ss.NotifyAdmin().Update(d1.UserId, d1.RequiredPlan, d1.RequiredFeature, 100)
	require.NoError(t, err)

	userRequest, err := ss.NotifyAdmin().GetDataByUserIdAndFeature(d1.UserId, d1.RequiredFeature)
	require.NoError(t, err)

	require.Equal(t, len(userRequest), 1)
	require.Equal(t, userRequest[0].SentAt, sql.NullInt64{Int64: 100, Valid: true})

	tearDown(t, ss)
}

func testDeleteBefore(t *testing.T, ss store.Store) {
	userId1 := model.NewId()
	d1 := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllProfessionalfeatures,
	}

	_, err := ss.NotifyAdmin().Save(d1)
	require.NoError(t, err)

	d1Trial := &model.NotifyAdminData{
		UserId:          userId1,
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllEnterprisefeatures,
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial)
	require.NoError(t, err)

	d1Trial2 := &model.NotifyAdminData{
		UserId:          model.NewId(),
		RequiredPlan:    model.LicenseShortSkuProfessional,
		RequiredFeature: model.PaidFeatureAllEnterprisefeatures,
		Trial:           true,
	}
	_, err = ss.NotifyAdmin().Save(d1Trial2)
	require.NoError(t, err)

	err = ss.NotifyAdmin().DeleteBefore(false, model.GetMillis()+model.GetMillis()) // delete all upgrade requests
	require.NoError(t, err)

	upgradeRequests, err := ss.NotifyAdmin().Get(false)
	require.NoError(t, err)
	require.Equal(t, len(upgradeRequests), 0)

	trialRequests, err := ss.NotifyAdmin().Get(true)
	require.NoError(t, err)
	require.Equal(t, len(trialRequests), 2) // trial requests should still exist

	err = ss.NotifyAdmin().DeleteBefore(true, model.GetMillis()+model.GetMillis()) // delete all trial requests
	require.NoError(t, err)

	trialRequests, err = ss.NotifyAdmin().Get(false)
	require.NoError(t, err)
	require.Equal(t, len(trialRequests), 0)
}
