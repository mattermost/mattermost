// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestRoleStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testRoleStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testRoleStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testRoleStoreGetByName(t, ss) })
	t.Run("GetNames", func(t *testing.T) { testRoleStoreGetByNames(t, ss) })
	t.Run("Delete", func(t *testing.T) { testRoleStoreDelete(t, ss) })
	t.Run("PermanentDeleteAll", func(t *testing.T) { testRoleStorePermanentDeleteAll(t, ss) })
}

func testRoleStoreSave(t *testing.T, ss store.Store) {
	// Save a new role.
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res1 := <-ss.Role().Save(r1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Role)
	assert.Len(t, d1.Id, 26)
	assert.Equal(t, r1.Name, d1.Name)
	assert.Equal(t, r1.DisplayName, d1.DisplayName)
	assert.Equal(t, r1.Description, d1.Description)
	assert.Equal(t, r1.Permissions, d1.Permissions)
	assert.Equal(t, r1.SchemeManaged, d1.SchemeManaged)

	// Change the role permissions and update.
	d1.Permissions = []string{
		"invite_user",
		"add_user_to_team",
		"delete_public_channel",
	}

	res2 := <-ss.Role().Save(d1)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Role)
	assert.Len(t, d2.Id, 26)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, d1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Try saving one with an invalid ID set.
	r3 := &model.Role{
		Id:          model.NewId(),
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res3 := <-ss.Role().Save(r3)
	assert.NotNil(t, res3.Err)

	// Try saving one with a duplicate "name" field.
	r4 := &model.Role{
		Name:        r1.Name,
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res4 := <-ss.Role().Save(r4)
	assert.NotNil(t, res4.Err)
}

func testRoleStoreGet(t *testing.T, ss store.Store) {
	// Save a role to test with.
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res1 := <-ss.Role().Save(r1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Role)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	res2 := <-ss.Role().Get(d1.Id)
	assert.Nil(t, res2.Err)
	d2 := res1.Data.(*model.Role)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	res3 := <-ss.Role().Get(model.NewId())
	assert.NotNil(t, res3.Err)
}

func testRoleStoreGetByName(t *testing.T, ss store.Store) {
	// Save a role to test with.
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res1 := <-ss.Role().Save(r1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Role)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	res2 := <-ss.Role().GetByName(d1.Name)
	assert.Nil(t, res2.Err)
	d2 := res1.Data.(*model.Role)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	res3 := <-ss.Role().GetByName(model.NewId())
	assert.NotNil(t, res3.Err)
}

func testRoleStoreGetByNames(t *testing.T, ss store.Store) {
	// Save some roles to test with.
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}
	r2 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"read_channel",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}
	r3 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"delete_private_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res1 := <-ss.Role().Save(r1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Role)
	assert.Len(t, d1.Id, 26)

	res2 := <-ss.Role().Save(r2)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Role)
	assert.Len(t, d2.Id, 26)

	res3 := <-ss.Role().Save(r3)
	assert.Nil(t, res3.Err)
	d3 := res3.Data.(*model.Role)
	assert.Len(t, d3.Id, 26)

	// Get two valid roles.
	n4 := []string{r1.Name, r2.Name}
	res4 := <-ss.Role().GetByNames(n4)
	assert.Nil(t, res4.Err)
	roles4 := res4.Data.([]*model.Role)
	assert.Len(t, roles4, 2)
	assert.Contains(t, roles4, d1)
	assert.Contains(t, roles4, d2)
	assert.NotContains(t, roles4, d3)

	// Get two invalid roles.
	n5 := []string{model.NewId(), model.NewId()}
	res5 := <-ss.Role().GetByNames(n5)
	assert.Nil(t, res5.Err)
	roles5 := res5.Data.([]*model.Role)
	assert.Len(t, roles5, 0)

	// Get one valid one and one invalid one.
	n6 := []string{r1.Name, model.NewId()}
	res6 := <-ss.Role().GetByNames(n6)
	assert.Nil(t, res6.Err)
	roles6 := res6.Data.([]*model.Role)
	assert.Len(t, roles6, 1)
	assert.Contains(t, roles6, d1)
	assert.NotContains(t, roles6, d2)
	assert.NotContains(t, roles6, d3)
}

func testRoleStoreDelete(t *testing.T, ss store.Store) {
	// Save a role to test with.
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	res1 := <-ss.Role().Save(r1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Role)
	assert.Len(t, d1.Id, 26)

	// Check the role is there.
	res2 := <-ss.Role().Get(d1.Id)
	assert.Nil(t, res2.Err)

	// Delete the role.
	res3 := <-ss.Role().Delete(d1.Id)
	assert.Nil(t, res3.Err)

	// Check the role is deleted there.
	res4 := <-ss.Role().Get(d1.Id)
	assert.Nil(t, res4.Err)
	d2 := res4.Data.(*model.Role)
	assert.NotZero(t, d2.DeleteAt)

	res5 := <-ss.Role().GetByName(d1.Name)
	assert.Nil(t, res5.Err)
	d3 := res5.Data.(*model.Role)
	assert.NotZero(t, d3.DeleteAt)

	// Try and delete a role that does not exist.
	res6 := <-ss.Role().Delete(model.NewId())
	assert.NotNil(t, res6.Err)
}

func testRoleStorePermanentDeleteAll(t *testing.T, ss store.Store) {
	r1 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"invite_user",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	r2 := &model.Role{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Permissions: []string{
			"read_channel",
			"create_public_channel",
			"add_user_to_team",
		},
		SchemeManaged: false,
	}

	store.Must(ss.Role().Save(r1))
	store.Must(ss.Role().Save(r2))

	res1 := <-ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.Nil(t, res1.Err)
	assert.Len(t, res1.Data.([]*model.Role), 2)

	res2 := <-ss.Role().PermanentDeleteAll()
	assert.Nil(t, res2.Err)

	res3 := <-ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.Nil(t, res3.Err)
	assert.Len(t, res3.Data.([]*model.Role), 0)
}
