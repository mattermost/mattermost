// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestSchemeStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testSchemeStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testSchemeStoreGet(t, ss) })
}

func testSchemeStoreSave(t *testing.T, ss store.Store) {
	// Save a new scheme.
	s1 := &model.Scheme{
		Name:                    model.NewId(),
		Description:             model.NewId(),
		Scope:                   model.SCHEME_SCOPE_TEAM,
		DefaultTeamAdminRole:    model.NewId(),
		DefaultTeamUserRole:     model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelUserRole:  model.NewId(),
	}

	// Check all fields saved correctly.
	res1 := <-ss.Scheme().Save(s1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Scheme)
	assert.Len(t, d1.Id, 26)
	assert.Equal(t, s1.Name, d1.Name)
	assert.Equal(t, s1.Description, d1.Description)
	assert.NotZero(t, d1.CreateAt)
	assert.NotZero(t, d1.UpdateAt)
	assert.Zero(t, d1.DeleteAt)
	assert.Equal(t, s1.Scope, d1.Scope)
	assert.Equal(t, s1.DefaultTeamAdminRole, d1.DefaultTeamAdminRole)
	assert.Equal(t, s1.DefaultTeamUserRole, d1.DefaultTeamUserRole)
	assert.Equal(t, s1.DefaultChannelAdminRole, d1.DefaultChannelAdminRole)
	assert.Equal(t, s1.DefaultChannelUserRole, d1.DefaultChannelUserRole)

	// Change the scheme description and update.
	d1.Description = model.NewId()

	res2 := <-ss.Scheme().Save(d1)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Scheme)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, s1.Name, d2.Name)
	assert.Equal(t, d1.Description, d2.Description)
	assert.NotZero(t, d2.CreateAt)
	assert.NotZero(t, d2.UpdateAt)
	assert.Zero(t, d2.DeleteAt)
	assert.Equal(t, s1.Scope, d2.Scope)
	assert.Equal(t, s1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, s1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, s1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, s1.DefaultChannelUserRole, d2.DefaultChannelUserRole)

	// Try saving one with an invalid ID set.
	s3 := &model.Scheme{
		Id:                      model.NewId(),
		Name:                    model.NewId(),
		Description:             model.NewId(),
		Scope:                   model.SCHEME_SCOPE_TEAM,
		DefaultTeamAdminRole:    model.NewId(),
		DefaultTeamUserRole:     model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelUserRole:  model.NewId(),
	}

	res3 := <-ss.Scheme().Save(s3)
	assert.NotNil(t, res3.Err)
}

func testSchemeStoreGet(t *testing.T, ss store.Store) {
	// Save a scheme to test with.
	s1 := &model.Scheme{
		Name:                    model.NewId(),
		Description:             model.NewId(),
		Scope:                   model.SCHEME_SCOPE_TEAM,
		DefaultTeamAdminRole:    model.NewId(),
		DefaultTeamUserRole:     model.NewId(),
		DefaultChannelAdminRole: model.NewId(),
		DefaultChannelUserRole:  model.NewId(),
	}

	res1 := <-ss.Scheme().Save(s1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Scheme)
	assert.Len(t, d1.Id, 26)

	// Get a valid scheme
	res2 := <-ss.Scheme().Get(d1.Id)
	assert.Nil(t, res2.Err)
	d2 := res1.Data.(*model.Scheme)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, s1.Name, d2.Name)
	assert.Equal(t, d1.Description, d2.Description)
	assert.NotZero(t, d2.CreateAt)
	assert.NotZero(t, d2.UpdateAt)
	assert.Zero(t, d2.DeleteAt)
	assert.Equal(t, s1.Scope, d2.Scope)
	assert.Equal(t, s1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, s1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, s1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, s1.DefaultChannelUserRole, d2.DefaultChannelUserRole)

	// Get an invalid scheme
	res3 := <-ss.Scheme().Get(model.NewId())
	assert.NotNil(t, res3.Err)
}
