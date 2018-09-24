// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestServiceTermsStore(t *testing.T, ss store.Store) {
	t.Run("TestSaveServiceTerms", func(t *testing.T) { testSaveServiceTerms(t, ss) })
}

func testSaveServiceTerms(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	serviceTerms := &model.ServiceTerms{Text: "service terms", UserId: u1.Id}
	r1 := <-ss.ServiceTerms().Save(serviceTerms)

	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	savedServiceTerms := r1.Data.(*model.ServiceTerms)
	if len(savedServiceTerms.Id) != 26 {
		t.Fatal("Id should have been populated")
	}

	if savedServiceTerms.CreateAt == 0 {
		t.Fatal("Create at should have been populated")
	}
}

func testGetServiceTerms(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	serviceTerms := &model.ServiceTerms{Text: "service terms", UserId: u1.Id}
	store.Must(ss.ServiceTerms().Save(serviceTerms))

	r1 := <-ss.ServiceTerms().Get(true)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}

	fetchedServiceTerms := r1.Data.(*model.ServiceTerms)
	assert.Equal(t, serviceTerms.Text, fetchedServiceTerms.Text)
	assert.Equal(t, serviceTerms.UserId, fetchedServiceTerms.UserId)
}
