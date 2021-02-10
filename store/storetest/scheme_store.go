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

func TestSchemeStore(t *testing.T, ss store.Store) {
	createDefaultRoles(ss)

	t.Run("Save", func(t *testing.T) { testSchemeStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testSchemeStoreGet(t, ss) })
	t.Run("GetAllPage", func(t *testing.T) { testSchemeStoreGetAllPage(t, ss) })
	t.Run("Delete", func(t *testing.T) { testSchemeStoreDelete(t, ss) })
	t.Run("PermanentDeleteAll", func(t *testing.T) { testSchemeStorePermanentDeleteAll(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testSchemeStoreGetByName(t, ss) })
	t.Run("CountByScope", func(t *testing.T) { testSchemeStoreCountByScope(t, ss) })
	t.Run("CountWithoutPermission", func(t *testing.T) { testCountWithoutPermission(t, ss) })
}

func createDefaultRoles(ss store.Store) {
	ss.Role().Save(&model.Role{
		Name:        model.TEAM_ADMIN_ROLE_ID,
		DisplayName: model.TEAM_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TEAM_USER_ROLE_ID,
		DisplayName: model.TEAM_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TEAM_GUEST_ROLE_ID,
		DisplayName: model.TEAM_GUEST_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_VIEW_TEAM.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_ADMIN_ROLE_ID,
		DisplayName: model.CHANNEL_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_USER_ROLE_ID,
		DisplayName: model.CHANNEL_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_CREATE_POST.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_GUEST_ROLE_ID,
		DisplayName: model.CHANNEL_GUEST_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_CREATE_POST.Id,
		},
	})
}

func testSchemeStoreSave(t *testing.T, ss store.Store) {
	// Save a new scheme.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	// Check all fields saved correctly.
	d1, err := ss.Scheme().Save(s1)
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)
	assert.Equal(t, s1.DisplayName, d1.DisplayName)
	assert.Equal(t, s1.Name, d1.Name)
	assert.Equal(t, s1.Description, d1.Description)
	assert.NotZero(t, d1.CreateAt)
	assert.NotZero(t, d1.UpdateAt)
	assert.Zero(t, d1.DeleteAt)
	assert.Equal(t, s1.Scope, d1.Scope)
	assert.Len(t, d1.DefaultTeamAdminRole, 26)
	assert.Len(t, d1.DefaultTeamUserRole, 26)
	assert.Len(t, d1.DefaultTeamGuestRole, 26)
	assert.Len(t, d1.DefaultChannelAdminRole, 26)
	assert.Len(t, d1.DefaultChannelUserRole, 26)
	assert.Len(t, d1.DefaultChannelGuestRole, 26)

	// Check the default roles were created correctly.
	role1, err := ss.Role().GetByName(d1.DefaultTeamAdminRole)
	assert.NoError(t, err)
	assert.Equal(t, role1.Permissions, []string{"delete_others_posts"})
	assert.True(t, role1.SchemeManaged)

	role2, err := ss.Role().GetByName(d1.DefaultTeamUserRole)
	assert.NoError(t, err)
	assert.Equal(t, role2.Permissions, []string{"view_team", "add_user_to_team"})
	assert.True(t, role2.SchemeManaged)

	role3, err := ss.Role().GetByName(d1.DefaultChannelAdminRole)
	assert.NoError(t, err)
	assert.Equal(t, role3.Permissions, []string{"manage_public_channel_members", "manage_private_channel_members"})
	assert.True(t, role3.SchemeManaged)

	role4, err := ss.Role().GetByName(d1.DefaultChannelUserRole)
	assert.NoError(t, err)
	assert.Equal(t, role4.Permissions, []string{"read_channel", "create_post"})
	assert.True(t, role4.SchemeManaged)

	role5, err := ss.Role().GetByName(d1.DefaultTeamGuestRole)
	assert.NoError(t, err)
	assert.Equal(t, role5.Permissions, []string{"view_team"})
	assert.True(t, role5.SchemeManaged)

	role6, err := ss.Role().GetByName(d1.DefaultChannelGuestRole)
	assert.NoError(t, err)
	assert.Equal(t, role6.Permissions, []string{"read_channel", "create_post"})
	assert.True(t, role6.SchemeManaged)

	// Change the scheme description and update.
	d1.Description = model.NewId()

	d2, err := ss.Scheme().Save(d1)
	assert.NoError(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, s1.DisplayName, d2.DisplayName)
	assert.Equal(t, s1.Name, d2.Name)
	assert.Equal(t, d1.Description, d2.Description)
	assert.NotZero(t, d2.CreateAt)
	assert.NotZero(t, d2.UpdateAt)
	assert.Zero(t, d2.DeleteAt)
	assert.Equal(t, s1.Scope, d2.Scope)
	assert.Equal(t, d1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, d1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, d1.DefaultTeamGuestRole, d2.DefaultTeamGuestRole)
	assert.Equal(t, d1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, d1.DefaultChannelUserRole, d2.DefaultChannelUserRole)
	assert.Equal(t, d1.DefaultChannelGuestRole, d2.DefaultChannelGuestRole)

	// Try saving one with an invalid ID set.
	s3 := &model.Scheme{
		Id:          model.NewId(),
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	_, err = ss.Scheme().Save(s3)
	assert.Error(t, err)
}

func testSchemeStoreGet(t *testing.T, ss store.Store) {
	// Save a scheme to test with.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	d1, err := ss.Scheme().Save(s1)
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid scheme
	d2, err := ss.Scheme().Get(d1.Id)
	assert.NoError(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, s1.DisplayName, d2.DisplayName)
	assert.Equal(t, s1.Name, d2.Name)
	assert.Equal(t, d1.Description, d2.Description)
	assert.NotZero(t, d2.CreateAt)
	assert.NotZero(t, d2.UpdateAt)
	assert.Zero(t, d2.DeleteAt)
	assert.Equal(t, s1.Scope, d2.Scope)
	assert.Equal(t, d1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, d1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, d1.DefaultTeamGuestRole, d2.DefaultTeamGuestRole)
	assert.Equal(t, d1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, d1.DefaultChannelUserRole, d2.DefaultChannelUserRole)
	assert.Equal(t, d1.DefaultChannelGuestRole, d2.DefaultChannelGuestRole)

	// Get an invalid scheme
	_, err = ss.Scheme().Get(model.NewId())
	assert.Error(t, err)
}

func testSchemeStoreGetByName(t *testing.T, ss store.Store) {
	// Save a scheme to test with.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	d1, err := ss.Scheme().Save(s1)
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid scheme
	d2, err := ss.Scheme().GetByName(d1.Name)
	assert.NoError(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, s1.DisplayName, d2.DisplayName)
	assert.Equal(t, s1.Name, d2.Name)
	assert.Equal(t, d1.Description, d2.Description)
	assert.NotZero(t, d2.CreateAt)
	assert.NotZero(t, d2.UpdateAt)
	assert.Zero(t, d2.DeleteAt)
	assert.Equal(t, s1.Scope, d2.Scope)
	assert.Equal(t, d1.DefaultTeamAdminRole, d2.DefaultTeamAdminRole)
	assert.Equal(t, d1.DefaultTeamUserRole, d2.DefaultTeamUserRole)
	assert.Equal(t, d1.DefaultTeamGuestRole, d2.DefaultTeamGuestRole)
	assert.Equal(t, d1.DefaultChannelAdminRole, d2.DefaultChannelAdminRole)
	assert.Equal(t, d1.DefaultChannelUserRole, d2.DefaultChannelUserRole)
	assert.Equal(t, d1.DefaultChannelGuestRole, d2.DefaultChannelGuestRole)

	// Get an invalid scheme
	_, err = ss.Scheme().GetByName(model.NewId())
	assert.Error(t, err)
}

func testSchemeStoreGetAllPage(t *testing.T, ss store.Store) {
	// Save a scheme to test with.
	schemes := []*model.Scheme{
		{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		},
		{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_CHANNEL,
		},
		{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		},
		{
			DisplayName: model.NewId(),
			Name:        model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_CHANNEL,
		},
	}

	for _, scheme := range schemes {
		_, err := ss.Scheme().Save(scheme)
		require.NoError(t, err)
	}

	s1, err := ss.Scheme().GetAllPage("", 0, 2)
	assert.NoError(t, err)
	assert.Len(t, s1, 2)

	s2, err := ss.Scheme().GetAllPage("", 2, 2)
	assert.NoError(t, err)
	assert.Len(t, s2, 2)
	assert.NotEqual(t, s1[0].DisplayName, s2[0].DisplayName)
	assert.NotEqual(t, s1[0].DisplayName, s2[1].DisplayName)
	assert.NotEqual(t, s1[1].DisplayName, s2[0].DisplayName)
	assert.NotEqual(t, s1[1].DisplayName, s2[1].DisplayName)
	assert.NotEqual(t, s1[0].Name, s2[0].Name)
	assert.NotEqual(t, s1[0].Name, s2[1].Name)
	assert.NotEqual(t, s1[1].Name, s2[0].Name)
	assert.NotEqual(t, s1[1].Name, s2[1].Name)

	s3, err := ss.Scheme().GetAllPage("team", 0, 1000)
	assert.NoError(t, err)
	assert.NotZero(t, len(s3))
	for _, s := range s3 {
		assert.Equal(t, "team", s.Scope)
	}

	s4, err := ss.Scheme().GetAllPage("channel", 0, 1000)
	assert.NoError(t, err)
	assert.NotZero(t, len(s4))
	for _, s := range s4 {
		assert.Equal(t, "channel", s.Scope)
	}
}

func testSchemeStoreDelete(t *testing.T, ss store.Store) {
	// Save a new scheme.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	// Check all fields saved correctly.
	d1, err := ss.Scheme().Save(s1)
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)
	assert.Equal(t, s1.DisplayName, d1.DisplayName)
	assert.Equal(t, s1.Name, d1.Name)
	assert.Equal(t, s1.Description, d1.Description)
	assert.NotZero(t, d1.CreateAt)
	assert.NotZero(t, d1.UpdateAt)
	assert.Zero(t, d1.DeleteAt)
	assert.Equal(t, s1.Scope, d1.Scope)
	assert.Len(t, d1.DefaultTeamAdminRole, 26)
	assert.Len(t, d1.DefaultTeamUserRole, 26)
	assert.Len(t, d1.DefaultTeamGuestRole, 26)
	assert.Len(t, d1.DefaultChannelAdminRole, 26)
	assert.Len(t, d1.DefaultChannelUserRole, 26)
	assert.Len(t, d1.DefaultChannelGuestRole, 26)

	// Check the default roles were created correctly.
	role1, err := ss.Role().GetByName(d1.DefaultTeamAdminRole)
	assert.NoError(t, err)
	assert.Equal(t, role1.Permissions, []string{"delete_others_posts"})
	assert.True(t, role1.SchemeManaged)

	role2, err := ss.Role().GetByName(d1.DefaultTeamUserRole)
	assert.NoError(t, err)
	assert.Equal(t, role2.Permissions, []string{"view_team", "add_user_to_team"})
	assert.True(t, role2.SchemeManaged)

	role3, err := ss.Role().GetByName(d1.DefaultChannelAdminRole)
	assert.NoError(t, err)
	assert.Equal(t, role3.Permissions, []string{"manage_public_channel_members", "manage_private_channel_members"})
	assert.True(t, role3.SchemeManaged)

	role4, err := ss.Role().GetByName(d1.DefaultChannelUserRole)
	assert.NoError(t, err)
	assert.Equal(t, role4.Permissions, []string{"read_channel", "create_post"})
	assert.True(t, role4.SchemeManaged)

	role5, err := ss.Role().GetByName(d1.DefaultTeamGuestRole)
	assert.NoError(t, err)
	assert.Equal(t, role5.Permissions, []string{"view_team"})
	assert.True(t, role5.SchemeManaged)

	role6, err := ss.Role().GetByName(d1.DefaultChannelGuestRole)
	assert.NoError(t, err)
	assert.Equal(t, role6.Permissions, []string{"read_channel", "create_post"})
	assert.True(t, role6.SchemeManaged)

	// Delete the scheme.
	d2, err := ss.Scheme().Delete(d1.Id)
	require.NoError(t, err)
	assert.NotZero(t, d2.DeleteAt)

	// Check that the roles are deleted too.
	role7, err := ss.Role().GetByName(d1.DefaultTeamAdminRole)
	assert.NoError(t, err)
	assert.NotZero(t, role7.DeleteAt)

	role8, err := ss.Role().GetByName(d1.DefaultTeamUserRole)
	assert.NoError(t, err)
	assert.NotZero(t, role8.DeleteAt)

	role9, err := ss.Role().GetByName(d1.DefaultChannelAdminRole)
	assert.NoError(t, err)
	assert.NotZero(t, role9.DeleteAt)

	role10, err := ss.Role().GetByName(d1.DefaultChannelUserRole)
	assert.NoError(t, err)
	assert.NotZero(t, role10.DeleteAt)

	role11, err := ss.Role().GetByName(d1.DefaultTeamGuestRole)
	assert.NoError(t, err)
	assert.NotZero(t, role11.DeleteAt)

	role12, err := ss.Role().GetByName(d1.DefaultChannelGuestRole)
	assert.NoError(t, err)
	assert.NotZero(t, role12.DeleteAt)

	// Try deleting a scheme that does not exist.
	_, err = ss.Scheme().Delete(model.NewId())
	assert.Error(t, err)

	// Try deleting a team scheme that's in use.
	s4 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	d4, err := ss.Scheme().Save(s4)
	assert.NoError(t, err)

	t4 := &model.Team{
		Name:        "xx" + model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &d4.Id,
	}
	t4, err = ss.Team().Save(t4)
	require.NoError(t, err)

	_, err = ss.Scheme().Delete(d4.Id)
	assert.NoError(t, err)

	t5, err := ss.Team().Get(t4.Id)
	require.NoError(t, err)
	assert.Equal(t, "", *t5.SchemeId)

	// Try deleting a channel scheme that's in use.
	s5 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}
	d5, err := ss.Scheme().Save(s5)
	assert.NoError(t, err)

	c5 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &d5.Id,
	}
	c5, nErr := ss.Channel().Save(c5, -1)
	assert.NoError(t, nErr)

	_, err = ss.Scheme().Delete(d5.Id)
	assert.NoError(t, err)

	c6, nErr := ss.Channel().Get(c5.Id, true)
	assert.NoError(t, nErr)
	assert.Equal(t, "", *c6.SchemeId)
}

func testSchemeStorePermanentDeleteAll(t *testing.T, ss store.Store) {
	s1 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	s2 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}

	s1, err := ss.Scheme().Save(s1)
	require.NoError(t, err)
	s2, err = ss.Scheme().Save(s2)
	require.NoError(t, err)

	err = ss.Scheme().PermanentDeleteAll()
	assert.NoError(t, err)

	_, err = ss.Scheme().Get(s1.Id)
	assert.Error(t, err)

	_, err = ss.Scheme().Get(s2.Id)
	assert.Error(t, err)

	schemes, err := ss.Scheme().GetAllPage("", 0, 100000)
	assert.NoError(t, err)
	assert.Empty(t, schemes)
}

func testSchemeStoreCountByScope(t *testing.T, ss store.Store) {
	testCounts := func(expectedTeamCount, expectedChannelCount int) {
		actualCount, err := ss.Scheme().CountByScope(model.SCHEME_SCOPE_TEAM)
		require.NoError(t, err)
		require.Equal(t, int64(expectedTeamCount), actualCount)

		actualCount, err = ss.Scheme().CountByScope(model.SCHEME_SCOPE_CHANNEL)
		require.NoError(t, err)
		require.Equal(t, int64(expectedChannelCount), actualCount)
	}

	createScheme := func(scope string) {
		_, err := ss.Scheme().Save(&model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       scope,
		})
		require.NoError(t, err)
	}

	err := ss.Scheme().PermanentDeleteAll()
	require.NoError(t, err)

	createScheme(model.SCHEME_SCOPE_CHANNEL)
	createScheme(model.SCHEME_SCOPE_TEAM)
	testCounts(1, 1)
	createScheme(model.SCHEME_SCOPE_TEAM)
	testCounts(2, 1)
	createScheme(model.SCHEME_SCOPE_CHANNEL)
	testCounts(2, 2)
}

func testCountWithoutPermission(t *testing.T, ss store.Store) {
	perm := model.PERMISSION_CREATE_POST.Id

	createScheme := func(scope string) *model.Scheme {
		scheme, err := ss.Scheme().Save(&model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       scope,
		})
		require.NoError(t, err)
		return scheme
	}

	getRoles := func(scheme *model.Scheme) (channelUser, channelGuest *model.Role) {
		var err error
		channelUser, err = ss.Role().GetByName(scheme.DefaultChannelUserRole)
		require.NoError(t, err)
		require.NotNil(t, channelUser)
		channelGuest, err = ss.Role().GetByName(scheme.DefaultChannelGuestRole)
		require.NoError(t, err)
		require.NotNil(t, channelGuest)
		return
	}

	teamScheme1 := createScheme(model.SCHEME_SCOPE_TEAM)
	defer ss.Scheme().Delete(teamScheme1.Id)
	teamScheme2 := createScheme(model.SCHEME_SCOPE_TEAM)
	defer ss.Scheme().Delete(teamScheme2.Id)
	channelScheme1 := createScheme(model.SCHEME_SCOPE_CHANNEL)
	defer ss.Scheme().Delete(channelScheme1.Id)
	channelScheme2 := createScheme(model.SCHEME_SCOPE_CHANNEL)
	defer ss.Scheme().Delete(channelScheme2.Id)

	ts1User, ts1Guest := getRoles(teamScheme1)
	ts2User, ts2Guest := getRoles(teamScheme2)
	cs1User, cs1Guest := getRoles(channelScheme1)
	cs2User, cs2Guest := getRoles(channelScheme2)

	allRoles := []*model.Role{
		ts1User,
		ts1Guest,
		ts2User,
		ts2Guest,
		cs1User,
		cs1Guest,
		cs2User,
		cs2Guest,
	}

	teamUserCount, err := ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_TEAM, perm, model.RoleScopeChannel, model.RoleTypeUser)
	require.NoError(t, err)
	require.Equal(t, int64(0), teamUserCount)

	teamGuestCount, err := ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_TEAM, perm, model.RoleScopeChannel, model.RoleTypeGuest)
	require.NoError(t, err)
	require.Equal(t, int64(0), teamGuestCount)

	var tests = []struct {
		removePermissionFromRole             *model.Role
		expectTeamSchemeChannelUserCount     int
		expectTeamSchemeChannelGuestCount    int
		expectChannelSchemeChannelUserCount  int
		expectChannelSchemeChannelGuestCount int
	}{
		{ts1User, 1, 0, 0, 0},
		{ts1Guest, 1, 1, 0, 0},
		{ts2User, 2, 1, 0, 0},
		{ts2Guest, 2, 2, 0, 0},
		{cs1User, 2, 2, 1, 0},
		{cs1Guest, 2, 2, 1, 1},
		{cs2User, 2, 2, 2, 1},
		{cs2Guest, 2, 2, 2, 2},
	}

	removePermission := func(targetRole *model.Role) {
		roleMatched := false
		for _, role := range allRoles {
			if targetRole == role {
				roleMatched = true
				role.Permissions = []string{}
				_, err = ss.Role().Save(role)
				require.NoError(t, err)
			}
		}
		require.True(t, roleMatched)
	}

	for _, test := range tests {
		removePermission(test.removePermissionFromRole)

		count, err := ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_TEAM, perm, model.RoleScopeChannel, model.RoleTypeUser)
		require.NoError(t, err)
		require.Equal(t, int64(test.expectTeamSchemeChannelUserCount), count)

		count, err = ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_TEAM, perm, model.RoleScopeChannel, model.RoleTypeGuest)
		require.NoError(t, err)
		require.Equal(t, int64(test.expectTeamSchemeChannelGuestCount), count)

		count, err = ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_CHANNEL, perm, model.RoleScopeChannel, model.RoleTypeUser)
		require.NoError(t, err)
		require.Equal(t, int64(test.expectChannelSchemeChannelUserCount), count)

		count, err = ss.Scheme().CountWithoutPermission(model.SCHEME_SCOPE_CHANNEL, perm, model.RoleScopeChannel, model.RoleTypeGuest)
		require.NoError(t, err)
		require.Equal(t, int64(test.expectChannelSchemeChannelGuestCount), count)
	}
}
