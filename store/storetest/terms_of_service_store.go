// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
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
	store.Must(ss.User().Save(&u1))

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	r1 := <-ss.TermsOfService().Save(termsOfService)

	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	savedTermsOfService := r1.Data.(*model.TermsOfService)
	if len(savedTermsOfService.Id) != 26 {
		t.Fatal("Id should have been populated")
	}

	if savedTermsOfService.CreateAt == 0 {
		t.Fatal("Create at should have been populated")
	}
}

func testGetLatestTermsOfService(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	store.Must(ss.TermsOfService().Save(termsOfService))

	r1 := <-ss.TermsOfService().GetLatest(true)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	fetchedTermsOfService := r1.Data.(*model.TermsOfService)
	assert.Equal(t, termsOfService.Text, fetchedTermsOfService.Text)
	assert.Equal(t, termsOfService.UserId, fetchedTermsOfService.UserId)
}

func testGetTermsOfService(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	termsOfService := &model.TermsOfService{Text: "terms of service", UserId: u1.Id}
	store.Must(ss.TermsOfService().Save(termsOfService))

	r1 := <-ss.TermsOfService().Get("an_invalid_id", true)
	assert.NotNil(t, r1.Err)
	assert.Nil(t, r1.Data)

	r1 = <-ss.TermsOfService().Get(termsOfService.Id, true)
	assert.Nil(t, r1.Err)

	receivedTermsOfService := r1.Data.(*model.TermsOfService)
	assert.Equal(t, "terms of service", receivedTermsOfService.Text)
}
