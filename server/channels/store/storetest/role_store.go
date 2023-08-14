// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestRoleStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testRoleStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testRoleStoreGet(t, ss) })
	t.Run("GetAll", func(t *testing.T) { testRoleStoreGetAll(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testRoleStoreGetByName(t, ss) })
	t.Run("GetNames", func(t *testing.T) { testRoleStoreGetByNames(t, ss) })
	t.Run("Delete", func(t *testing.T) { testRoleStoreDelete(t, ss) })
	t.Run("PermanentDeleteAll", func(t *testing.T) { testRoleStorePermanentDeleteAll(t, ss) })
	t.Run("LowerScopedChannelSchemeRoles_AllChannelSchemeRoles", func(t *testing.T) { testRoleStoreLowerScopedChannelSchemeRoles(t, ss) })
	t.Run("ChannelHigherScopedPermissionsBlankTeamSchemeChannelGuest", func(t *testing.T) { testRoleStoreChannelHigherScopedPermissionsBlankTeamSchemeChannelGuest(t, ss, s) })
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
	assert.NoError(t, err)
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
	assert.NoError(t, err)
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
	assert.Error(t, err)

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
	assert.Error(t, err)
}

func testRoleStoreGetAll(t *testing.T, ss store.Store) {
	prev, err := ss.Role().GetAll()
	require.NoError(t, err)
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
	require.NoError(t, err)

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
	require.NoError(t, err)

	data, err := ss.Role().GetAll()
	require.NoError(t, err)
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
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	d2, err := ss.Role().Get(d1.Id)
	assert.NoError(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	_, err = ss.Role().Get(model.NewId())
	assert.Error(t, err)
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
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	// Get a valid role
	d2, err := ss.Role().GetByName(context.Background(), d1.Name)
	assert.NoError(t, err)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, r1.Name, d2.Name)
	assert.Equal(t, r1.DisplayName, d2.DisplayName)
	assert.Equal(t, r1.Description, d2.Description)
	assert.Equal(t, r1.Permissions, d2.Permissions)
	assert.Equal(t, r1.SchemeManaged, d2.SchemeManaged)

	// Get an invalid role
	_, err = ss.Role().GetByName(context.Background(), model.NewId())
	assert.Error(t, err)
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
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	d2, err := ss.Role().Save(r2)
	assert.NoError(t, err)
	assert.Len(t, d2.Id, 26)

	d3, err := ss.Role().Save(r3)
	assert.NoError(t, err)
	assert.Len(t, d3.Id, 26)

	// Get two valid roles.
	n4 := []string{r1.Name, r2.Name}
	roles4, err := ss.Role().GetByNames(n4)
	assert.NoError(t, err)
	assert.Len(t, roles4, 2)
	assert.Contains(t, roles4, d1)
	assert.Contains(t, roles4, d2)
	assert.NotContains(t, roles4, d3)

	// Get two invalid roles.
	n5 := []string{model.NewId(), model.NewId()}
	roles5, err := ss.Role().GetByNames(n5)
	assert.NoError(t, err)
	assert.Empty(t, roles5)

	// Get one valid one and one invalid one.
	n6 := []string{r1.Name, model.NewId()}
	roles6, err := ss.Role().GetByNames(n6)
	assert.NoError(t, err)
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
	assert.NoError(t, err)
	assert.Len(t, d1.Id, 26)

	// Check the role is there.
	_, err = ss.Role().Get(d1.Id)
	assert.NoError(t, err)

	// Delete the role.
	_, err = ss.Role().Delete(d1.Id)
	assert.NoError(t, err)

	// Check the role is deleted there.
	d2, err := ss.Role().Get(d1.Id)
	assert.NoError(t, err)
	assert.NotZero(t, d2.DeleteAt)

	d3, err := ss.Role().GetByName(context.Background(), d1.Name)
	assert.NoError(t, err)
	assert.NotZero(t, d3.DeleteAt)

	// Try and delete a role that does not exist.
	_, err = ss.Role().Delete(model.NewId())
	assert.Error(t, err)
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
	require.NoError(t, err)
	_, err = ss.Role().Save(r2)
	require.NoError(t, err)

	roles, err := ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.NoError(t, err)
	assert.Len(t, roles, 2)

	err = ss.Role().PermanentDeleteAll()
	assert.NoError(t, err)

	roles, err = ss.Role().GetByNames([]string{r1.Name, r2.Name})
	assert.NoError(t, err)
	assert.Empty(t, roles)
}

func testRoleStoreLowerScopedChannelSchemeRoles(t *testing.T, ss store.Store) {
	ctx := context.TODO()
	createDefaultRoles(ss)

	teamScheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	teamScheme1, err := ss.Scheme().Save(teamScheme1)
	require.NoError(t, err)
	defer ss.Scheme().Delete(teamScheme1.Id)

	teamScheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	teamScheme2, err = ss.Scheme().Save(teamScheme2)
	require.NoError(t, err)
	defer ss.Scheme().Delete(teamScheme2.Id)

	channelScheme1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}
	channelScheme1, err = ss.Scheme().Save(channelScheme1)
	require.NoError(t, err)
	defer ss.Scheme().Delete(channelScheme1.Id)

	channelScheme2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}
	channelScheme2, err = ss.Scheme().Save(channelScheme2)
	require.NoError(t, err)
	defer ss.Scheme().Delete(channelScheme1.Id)

	team1 := &model.Team{
		DisplayName: "Name",
		Name:        "zz" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
		SchemeId:    &teamScheme1.Id,
	}
	team1, err = ss.Team().Save(ctx, team1)
	require.NoError(t, err)
	defer ss.Team().PermanentDelete(team1.Id)

	team2 := &model.Team{
		DisplayName: "Name",
		Name:        "zz" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
		SchemeId:    &teamScheme2.Id,
	}
	team2, err = ss.Team().Save(ctx, team2)
	require.NoError(t, err)
	defer ss.Team().PermanentDelete(team2.Id)

	channel1 := &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.ChannelTypeOpen,
		SchemeId:    &channelScheme1.Id,
	}
	channel1, nErr := ss.Channel().Save(channel1, -1)
	require.NoError(t, nErr)
	defer ss.Channel().Delete(channel1.Id, 0)

	channel2 := &model.Channel{
		TeamId:      team2.Id,
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.ChannelTypeOpen,
		SchemeId:    &channelScheme2.Id,
	}
	channel2, nErr = ss.Channel().Save(channel2, -1)
	require.NoError(t, nErr)
	defer ss.Channel().Delete(channel2.Id, 0)

	t.Run("ChannelRolesUnderTeamRole", func(t *testing.T) {
		t.Run("guest role for the right team's channels are returned", func(t *testing.T) {
			actualRoles, err := ss.Role().ChannelRolesUnderTeamRole(teamScheme1.DefaultChannelGuestRole)
			require.NoError(t, err)

			var actualRoleNames []string
			for _, role := range actualRoles {
				actualRoleNames = append(actualRoleNames, role.Name)
			}

			require.Contains(t, actualRoleNames, channelScheme1.DefaultChannelGuestRole)
			require.NotContains(t, actualRoleNames, channelScheme2.DefaultChannelGuestRole)
		})

		t.Run("user role for the right team's channels are returned", func(t *testing.T) {
			actualRoles, err := ss.Role().ChannelRolesUnderTeamRole(teamScheme1.DefaultChannelUserRole)
			require.NoError(t, err)

			var actualRoleNames []string
			for _, role := range actualRoles {
				actualRoleNames = append(actualRoleNames, role.Name)
			}

			require.Contains(t, actualRoleNames, channelScheme1.DefaultChannelUserRole)
			require.NotContains(t, actualRoleNames, channelScheme2.DefaultChannelUserRole)
		})

		t.Run("admin role for the right team's channels are returned", func(t *testing.T) {
			actualRoles, err := ss.Role().ChannelRolesUnderTeamRole(teamScheme1.DefaultChannelAdminRole)
			require.NoError(t, err)

			var actualRoleNames []string
			for _, role := range actualRoles {
				actualRoleNames = append(actualRoleNames, role.Name)
			}

			require.Contains(t, actualRoleNames, channelScheme1.DefaultChannelAdminRole)
			require.NotContains(t, actualRoleNames, channelScheme2.DefaultChannelAdminRole)
		})
	})

	t.Run("AllChannelSchemeRoles", func(t *testing.T) {
		t.Run("guest role for the right team's channels are returned", func(t *testing.T) {
			actualRoles, err := ss.Role().AllChannelSchemeRoles()
			require.NoError(t, err)

			var actualRoleNames []string
			for _, role := range actualRoles {
				actualRoleNames = append(actualRoleNames, role.Name)
			}

			allRoleNames := []string{
				channelScheme1.DefaultChannelGuestRole,
				channelScheme2.DefaultChannelGuestRole,

				channelScheme1.DefaultChannelUserRole,
				channelScheme2.DefaultChannelUserRole,

				channelScheme1.DefaultChannelAdminRole,
				channelScheme2.DefaultChannelAdminRole,
			}

			for _, roleName := range allRoleNames {
				require.Contains(t, actualRoleNames, roleName)
			}
		})
	})
}

func testRoleStoreChannelHigherScopedPermissionsBlankTeamSchemeChannelGuest(t *testing.T, ss store.Store, s SqlStore) {
	ctx := context.TODO()
	teamScheme := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeTeam,
	}
	teamScheme, err := ss.Scheme().Save(teamScheme)
	require.NoError(t, err)
	defer ss.Scheme().Delete(teamScheme.Id)

	channelScheme := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	}
	channelScheme, err = ss.Scheme().Save(channelScheme)
	require.NoError(t, err)
	defer ss.Scheme().Delete(channelScheme.Id)

	team := &model.Team{
		DisplayName: "Name",
		Name:        "zz" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
		SchemeId:    &teamScheme.Id,
	}
	team, err = ss.Team().Save(ctx, team)
	require.NoError(t, err)
	defer ss.Team().PermanentDelete(team.Id)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Display " + model.NewId(),
		Name:        "zz" + model.NewId() + "b",
		Type:        model.ChannelTypeOpen,
		SchemeId:    &channelScheme.Id,
	}
	channel, nErr := ss.Channel().Save(channel, -1)
	require.NoError(t, nErr)
	defer ss.Channel().Delete(channel.Id, 0)

	channelSchemeUserRole, err := ss.Role().GetByName(context.Background(), channelScheme.DefaultChannelUserRole)
	require.NoError(t, err)
	channelSchemeUserRole.Permissions = []string{}
	_, err = ss.Role().Save(channelSchemeUserRole)
	require.NoError(t, err)

	teamSchemeUserRole, err := ss.Role().GetByName(context.Background(), teamScheme.DefaultChannelUserRole)
	require.NoError(t, err)
	teamSchemeUserRole.Permissions = []string{model.PermissionUploadFile.Id}
	_, err = ss.Role().Save(teamSchemeUserRole)
	require.NoError(t, err)

	// get the channel scheme user role again and ensure that it has the permission inherited from the team
	// scheme user role
	roleMapBefore, err := ss.Role().ChannelHigherScopedPermissions([]string{channelSchemeUserRole.Name})
	require.NoError(t, err)

	// blank-out the guest role to simulate an old team scheme, ensure it's blank
	result, sqlErr := s.GetMasterX().Exec(fmt.Sprintf("UPDATE Schemes SET DefaultChannelGuestRole = '' WHERE Id = '%s'", teamScheme.Id))
	require.NoError(t, sqlErr)
	rows, serr := result.RowsAffected()
	require.NoError(t, serr)
	require.Equal(t, int64(1), rows)
	teamScheme, err = ss.Scheme().Get(teamScheme.Id)
	require.NoError(t, err)
	require.Equal(t, "", teamScheme.DefaultChannelGuestRole)

	// trigger a cache clear
	_, err = ss.Role().Save(channelSchemeUserRole)
	require.NoError(t, err)

	roleMapAfter, err := ss.Role().ChannelHigherScopedPermissions([]string{channelSchemeUserRole.Name})
	require.NoError(t, err)

	require.Equal(t, len(roleMapBefore), len(roleMapAfter))
}
