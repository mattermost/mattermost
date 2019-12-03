// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserTermsOfServiceStore(t *testing.T, ss store.Store) {
	t.Run("TestSaveUserTermsOfService", func(t *testing.T) { testSaveUserTermsOfService(t, ss) })
	t.Run("TestGetByUserTermsOfService", func(t *testing.T) { testGetByUserTermsOfService(t, ss) })
	t.Run("TestDeleteUserTermsOfService", func(t *testing.T) { testDeleteUserTermsOfService(t, ss) })
}

func testSaveUserTermsOfService(t *testing.T, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	savedUserTermsOfService, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.Nil(t, err)
	assert.Equal(t, userTermsOfService.UserId, savedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, savedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, savedUserTermsOfService.CreateAt)
}

func testGetByUserTermsOfService(t *testing.T, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	_, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.Nil(t, err)

	fetchedUserTermsOfService, err := ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	require.Nil(t, err)
	assert.Equal(t, userTermsOfService.UserId, fetchedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, fetchedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, fetchedUserTermsOfService.CreateAt)
}

func testDeleteUserTermsOfService(t *testing.T, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	_, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.Nil(t, err)

	_, err = ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	require.Nil(t, err)

	err = ss.UserTermsOfService().Delete(userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
	require.Nil(t, err)

	_, err = ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	assert.Equal(t, "store.sql_user_terms_of_service.get_by_user.no_rows.app_error", err.Id)
}
