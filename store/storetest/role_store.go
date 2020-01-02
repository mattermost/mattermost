// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestRoleStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testRoleStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testRoleStoreGet(t, ss) })
	t.Run("GetAll", func(t *testing.T) { testRoleStoreGetAll(t, ss) })
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

	d1, err := ss.Role().Save(r1)
	assert.Nil(t, err)
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

	d2, err := ss.Role().Save(d1)
	assert.Nil(t, err)
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

	_, err = ss.Role().Save(r3)
	assert.NotNil(t, err)

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

	_, err = ss.Role().Save(r4)
	assert.NotNil(t, err)
}

func testRoleStoreGetAll(t *testing.T, ss store.Store) {
	prev, err := ss.Role().GetAll()
	require.Nil(t, err)
	prevCount := len(prev)

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

	_, err = ss.Role().Save(r1)
	require.Nil(t, err)

	r2 := &model.Role{
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
	_, err = ss.Role().Save(r2)
	require.Nil(t, err)

	data, err := ss.Role().GetAll()
	require.Nil(t, err)
	assert.Len(t, data, prevCount+2)
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

	d1, err := ss.Role().Save(r1)
	assert.Nil(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	d2, err := ss.Role().Get(d1.Id)
	assert.Nil(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	_, err = ss.Role().Get(model.NewId())
	assert.NotNil(t, err)
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

	d1, err := ss.Role().Save(r1)
	assert.Nil(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	d2, err := ss.Role().GetByName(d1.Name)
	assert.Nil(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	_, err = ss.Role().GetByName(model.NewId())
	assert.NotNil(t, err)
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

	d1, err := ss.Role().Save(r1)
	assert.Nil(t, err)
	assert.Len(t, d1.Id, 26)

	d2, err := ss.Role().Save(r2)
	assert.Nil(t, err)
	assert.Len(t, d2.Id, 26)

	d3, err := ss.Role().Save(r3)
	assert.Nil(t, err)
	assert.Len(t, d3.Id, 26)

	// Get two valid roles.
	n4 := []string{r1.Name, r2.Name}
	roles4, err := ss.Role().GetByNames(n4)
	assert.Nil(t, err)
	assert.Len(t, roles4, 2)
	assert.Contains(t, roles4, d1)
	assert.Contains(t, roles4, d2)
	assert.NotContains(t, roles4, d3)

	// Get two invalid roles.
	n5 := []string{model.NewId(), model.NewId()}
	roles5, err := ss.Role().GetByNames(n5)
	assert.Nil(t, err)
	assert.Empty(t, roles5)

	// Get one valid one and one invalid one.
	n6 := []string{r1.Name, model.NewId()}
	roles6, err := ss.Role().GetByNames(n6)
	assert.Nil(t, err)
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

	d1, err := ss.Role().Save(r1)
	assert.Nil(t, err)
	assert.Len(t, d1.Id, 26)

	// Check the role is there.
	_, err = ss.Role().Get(d1.Id)
	assert.Nil(t, err)

	// Delete the role.
	_, err = ss.Role().Delete(d1.Id)
	assert.Nil(t, err)

	// Check the role is deleted there.
	d2, err := ss.Role().Get(d1.Id)
	assert.Nil(t, err)
	assert.NotZero(t, d2.DeleteAt)

	d3, err := ss.Role().GetByName(d1.Name)
	assert.Nil(t, err)
	assert.NotZero(t, d3.DeleteAt)

	// Try and delete a role that does not exist.
	_, err = ss.Role().Delete(model.NewId())
	assert.NotNil(t, err)
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

	_, err := ss.Role().Save(r1)
	require.Nil(t, err)
	_, err = ss.Role().Save(r2)
	require.Nil(t, err)

	roles, err := ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.Nil(t, err)
	assert.Len(t, roles, 2)

	err = ss.Role().PermanentDeleteAll()
	assert.Nil(t, err)

	roles, err = ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.Nil(t, err)
	assert.Empty(t, roles)
}
