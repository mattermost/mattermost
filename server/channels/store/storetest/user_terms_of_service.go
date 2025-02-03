// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestUserTermsOfServiceStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("TestSaveUserTermsOfService", func(t *testing.T) { testSaveUserTermsOfService(t, rctx, ss) })
	t.Run("TestGetByUserTermsOfService", func(t *testing.T) { testGetByUserTermsOfService(t, rctx, ss) })
	t.Run("TestDeleteUserTermsOfService", func(t *testing.T) { testDeleteUserTermsOfService(t, rctx, ss) })
}

func testSaveUserTermsOfService(t *testing.T, rctx request.CTX, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	savedUserTermsOfService, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.NoError(t, err)
	assert.Equal(t, userTermsOfService.UserId, savedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, savedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, savedUserTermsOfService.CreateAt)

	// Check we can save a new terms of service id (MM-41611)
	newUserTermsOfService := &model.UserTermsOfService{
		UserId:           userTermsOfService.UserId,
		TermsOfServiceId: model.NewId(),
	}

	savedUserTermsOfService, err = ss.UserTermsOfService().Save(newUserTermsOfService)
	require.NoError(t, err)
	assert.Equal(t, newUserTermsOfService.UserId, savedUserTermsOfService.UserId)
	assert.Equal(t, newUserTermsOfService.TermsOfServiceId, savedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, savedUserTermsOfService.CreateAt)
}

func testGetByUserTermsOfService(t *testing.T, rctx request.CTX, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	_, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.NoError(t, err)

	fetchedUserTermsOfService, err := ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	require.NoError(t, err)
	assert.Equal(t, userTermsOfService.UserId, fetchedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, fetchedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, fetchedUserTermsOfService.CreateAt)
}

func testDeleteUserTermsOfService(t *testing.T, rctx request.CTX, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	_, err := ss.UserTermsOfService().Save(userTermsOfService)
	require.NoError(t, err)

	_, err = ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	require.NoError(t, err)

	err = ss.UserTermsOfService().Delete(userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
	require.NoError(t, err)

	_, err = ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	var nfErr *store.ErrNotFound
	assert.Error(t, err)
	assert.True(t, errors.As(err, &nfErr))
}
