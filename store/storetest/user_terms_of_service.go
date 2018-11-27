// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
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

	r1 := <-ss.UserTermsOfService().Save(userTermsOfService)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	savedUserTermsOfService := r1.Data.(*model.UserTermsOfService)
	assert.Equal(t, userTermsOfService.UserId, savedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, savedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, savedUserTermsOfService.CreateAt)
}

func testGetByUserTermsOfService(t *testing.T, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	r1 := <-ss.UserTermsOfService().Save(userTermsOfService)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	r1 = <-ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	fetchedUserTermsOfService := r1.Data.(*model.UserTermsOfService)
	assert.Equal(t, userTermsOfService.UserId, fetchedUserTermsOfService.UserId)
	assert.Equal(t, userTermsOfService.TermsOfServiceId, fetchedUserTermsOfService.TermsOfServiceId)
	assert.NotEmpty(t, fetchedUserTermsOfService.CreateAt)
}

func testDeleteUserTermsOfService(t *testing.T, ss store.Store) {
	userTermsOfService := &model.UserTermsOfService{
		UserId:           model.NewId(),
		TermsOfServiceId: model.NewId(),
	}

	r1 := <-ss.UserTermsOfService().Save(userTermsOfService)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	r1 = <-ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	r1 = <-ss.UserTermsOfService().Delete(userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	r1 = <-ss.UserTermsOfService().GetByUser(userTermsOfService.UserId)
	assert.Equal(t, "store.sql_user_terms_of_service.get_by_user.no_rows.app_error", r1.Err.Id)
}
