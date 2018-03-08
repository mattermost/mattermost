// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestSchemeStore(t *testing.T, ss store.Store) {
	createDefaultRoles(t, ss)

	t.Run("Save", func(t *testing.T) { testSchemeStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testSchemeStoreGet(t, ss) })
}

func createDefaultRoles(t *testing.T, ss store.Store) {
	assert.Nil(t, (<-ss.Role().Save(&model.Role{
		Name:        model.TEAM_ADMIN_ROLE_ID,
		DisplayName: model.TEAM_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_EDIT_OTHERS_POSTS.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		},
	})).Err)

	assert.Nil(t, (<-ss.Role().Save(&model.Role{
		Name:        model.TEAM_USER_ROLE_ID,
		DisplayName: model.TEAM_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		},
	})).Err)

	assert.Nil(t, (<-ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_ADMIN_ROLE_ID,
		DisplayName: model.CHANNEL_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
		},
	})).Err)

	assert.Nil(t, (<-ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_USER_ROLE_ID,
		DisplayName: model.CHANNEL_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_CREATE_POST.Id,
		},
	})).Err)
}

func testSchemeStoreSave(t *testing.T, ss store.Store) {
	// Save a new scheme.
	s1 := &model.Scheme{
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
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
	assert.Len(t, d1.DefaultTeamAdminRole, 26)
	assert.Len(t, d1.DefaultTeamUserRole, 26)
	assert.Len(t, d1.DefaultChannelAdminRole, 26)
	assert.Len(t, d1.DefaultChannelUserRole, 26)

	// Check the default roles were created correctly.
	roleRes1 := <-ss.Role().Get(d1.DefaultTeamAdminRole)
	assert.Nil(t, roleRes1.Err)
	role1 := roleRes1.Data.(*model.Role)
	assert.Equal(t, role1.Permissions, []string{"edit_others_posts", "delete_others_posts"})
	assert.True(t, role1.SchemeManaged)

	roleRes2 := <-ss.Role().Get(d1.DefaultTeamUserRole)
	assert.Nil(t, roleRes2.Err)
	role2 := roleRes2.Data.(*model.Role)
	assert.Equal(t, role2.Permissions, []string{"view_team", "add_user_to_team"})
	assert.True(t, role2.SchemeManaged)

	roleRes3 := <-ss.Role().Get(d1.DefaultChannelAdminRole)
	assert.Nil(t, roleRes3.Err)
	role3 := roleRes3.Data.(*model.Role)
	assert.Equal(t, role3.Permissions, []string{"manage_public_channel_members", "manage_private_channel_members"})
	assert.True(t, role3.SchemeManaged)

	roleRes4 := <-ss.Role().Get(d1.DefaultChannelUserRole)
	assert.Nil(t, roleRes4.Err)
	role4 := roleRes4.Data.(*model.Role)
	assert.Equal(t, role4.Permissions, []string{"read_channel", "create_post"})
	assert.True(t, role4.SchemeManaged)

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
	assert.Equal(t, d1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, d1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, d1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, d1.DefaultChannelUserRole, d2.DefaultChannelUserRole)

	// Try saving one with an invalid ID set.
	s3 := &model.Scheme{
		Id:          model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	res3 := <-ss.Scheme().Save(s3)
	assert.NotNil(t, res3.Err)
}

func testSchemeStoreGet(t *testing.T, ss store.Store) {
	// Save a scheme to test with.
	s1 := &model.Scheme{
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
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
	assert.Equal(t, d1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, d1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, d1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, d1.DefaultChannelUserRole, d2.DefaultChannelUserRole)

	// Get an invalid scheme
	res3 := <-ss.Scheme().Get(model.NewId())
	assert.NotNil(t, res3.Err)
}
