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

func TestTermsOfServiceStore(t *testing.T, ss store.Store) {
	t.Run("TestSaveTermsOfService", func(t *testing.T) { testSaveTermsOfService(t, ss) })
	t.Run("TestGetLatestTermsOfService", func(t *testing.T) { testGetLatestTermsOfService(t, ss) })
	t.Run("TestGetTermsOfService", func(t *testing.T) { testGetTermsOfService(t, ss) })
}

func testSaveTermsOfService(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(&u1)
	require.Nil(t, err)

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	savedTermsOfService, err := ss.TermsOfService().Save(termsOfService)
	require.Nil(t, err)

	require.Len(t, savedTermsOfService.Id, 26, "Id should have been populated")

	require.NotEqual(t, savedTermsOfService.CreateAt, 0, "Create at should have been populated")
}

func testGetLatestTermsOfService(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(&u1)
	require.Nil(t, err)

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	_, err = ss.TermsOfService().Save(termsOfService)
	require.Nil(t, err)

	fetchedTermsOfService, err := ss.TermsOfService().GetLatest(true)
	require.Nil(t, err)
	assert.Equal(t, termsOfService.Text, fetchedTermsOfService.Text)
	assert.Equal(t, termsOfService.UserId, fetchedTermsOfService.UserId)
}

func testGetTermsOfService(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(&u1)
	require.Nil(t, err)

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	_, err = ss.TermsOfService().Save(termsOfService)
	require.Nil(t, err)

	r1, err := ss.TermsOfService().Get("an_invalid_id", true)
	assert.NotNil(t, err)
	assert.Nil(t, r1)

	receivedTermsOfService, err := ss.TermsOfService().Get(termsOfService.Id, true)
	assert.Nil(t, err)
	assert.Equal(t, "terms of service", receivedTermsOfService.Text)
}
