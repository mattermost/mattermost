// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetAllRoles(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	roles, err := th.App.Srv().Store().Role().GetAll()
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		received, resp, err := client.GetAllRoles(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.EqualValues(t, received, roles)
	})

	t.Run("NormalClient", func(t *testing.T) {
		_, resp, err := th.Client.GetAllRoles(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetRole(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel"},
		SchemeManaged: true,
	}

	role, err := th.App.Srv().Store().Role().Save(role)
	require.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(role.Id)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		received, _, err := client.GetRole(context.Background(), role.Id)
		require.NoError(t, err)

		assert.Equal(t, received.Id, role.Id)
		assert.Equal(t, received.Name, role.Name)
		assert.Equal(t, received.DisplayName, role.DisplayName)
		assert.Equal(t, received.Description, role.Description)
		assert.EqualValues(t, received.Permissions, role.Permissions)
		assert.Equal(t, received.SchemeManaged, role.SchemeManaged)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetRole(context.Background(), "1234")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetRole(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetRoleByName(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel"},
		SchemeManaged: true,
	}

	role, err := th.App.Srv().Store().Role().Save(role)
	assert.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(role.Id)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		received, _, err := client.GetRoleByName(context.Background(), role.Name)
		require.NoError(t, err)

		assert.Equal(t, received.Id, role.Id)
		assert.Equal(t, received.Name, role.Name)
		assert.Equal(t, received.DisplayName, role.DisplayName)
		assert.Equal(t, received.Description, role.Description)
		assert.EqualValues(t, received.Permissions, role.Permissions)
		assert.Equal(t, received.SchemeManaged, role.SchemeManaged)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetRoleByName(context.Background(), strings.Repeat("abcdefghij", 10))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = client.GetRoleByName(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetRolesByNames(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	role1 := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel"},
		SchemeManaged: true,
	}
	role2 := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "delete_private_channel"},
		SchemeManaged: true,
	}
	role3 := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "manage_public_channel_properties"},
		SchemeManaged: true,
	}

	role1, err := th.App.Srv().Store().Role().Save(role1)
	assert.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(role1.Id)

	role2, err = th.App.Srv().Store().Role().Save(role2)
	assert.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(role2.Id)

	role3, err = th.App.Srv().Store().Role().Save(role3)
	assert.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(role3.Id)

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		// Check all three roles can be found.
		received, _, err := client.GetRolesByNames(context.Background(), []string{role1.Name, role2.Name, role3.Name})
		require.NoError(t, err)

		assert.Contains(t, received, role1)
		assert.Contains(t, received, role2)
		assert.Contains(t, received, role3)

		// Check a list of non-existent roles.
		_, _, err = client.GetRolesByNames(context.Background(), []string{model.NewId(), model.NewId()})
		require.NoError(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Empty list should error.
		_, resp, err := client.GetRolesByNames(context.Background(), []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		// Invalid role name should error.
		_, resp, err := client.GetRolesByNames(context.Background(), []string{model.NewId(), model.NewId(), "!!!!!!"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Empty/whitespace rolenames should be ignored.
		_, _, err = client.GetRolesByNames(context.Background(), []string{model.NewId(), model.NewId(), "", "    "})
		require.NoError(t, err)
	})

}

func TestPatchRole(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel", "manage_slash_commands"},
		SchemeManaged: true,
	}

	role, err2 := th.App.Srv().Store().Role().Save(role)
	assert.NoError(t, err2)
	defer th.App.Srv().Store().Job().Delete(role.Id)

	patch := &model.RolePatch{
		Permissions: &[]string{"manage_system", "create_public_channel", "manage_incoming_webhooks", "manage_outgoing_webhooks"},
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {

		// Cannot edit a system admin
		adminRole, err := th.App.Srv().Store().Role().GetByName(context.Background(), "system_admin")
		assert.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(adminRole.Id)

		_, resp, err := client.PatchRole(context.Background(), adminRole.Id, patch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		// Cannot give other roles read / write to system roles or manage roles because only system admin can do these actions
		systemManager, err := th.App.Srv().Store().Role().GetByName(context.Background(), "system_manager")
		assert.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(systemManager.Id)

		patchWriteSystemRoles := &model.RolePatch{
			Permissions: &[]string{model.PermissionSysconsoleWriteUserManagementSystemRoles.Id},
		}

		_, resp, err = client.PatchRole(context.Background(), systemManager.Id, patchWriteSystemRoles)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		patchReadSystemRoles := &model.RolePatch{
			Permissions: &[]string{model.PermissionSysconsoleReadUserManagementSystemRoles.Id},
		}

		_, resp, err = client.PatchRole(context.Background(), systemManager.Id, patchReadSystemRoles)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		patchManageRoles := &model.RolePatch{
			Permissions: &[]string{model.PermissionManageRoles.Id},
		}

		_, resp, err = client.PatchRole(context.Background(), systemManager.Id, patchManageRoles)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		received, _, err := client.PatchRole(context.Background(), role.Id, patch)
		require.NoError(t, err)

		assert.Equal(t, received.Id, role.Id)
		assert.Equal(t, received.Name, role.Name)
		assert.Equal(t, received.DisplayName, role.DisplayName)
		assert.Equal(t, received.Description, role.Description)
		perms := []string{"manage_system", "create_public_channel", "manage_incoming_webhooks", "manage_outgoing_webhooks"}
		sort.Strings(perms)
		assert.EqualValues(t, received.Permissions, perms)
		assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

		// Check a no-op patch succeeds.
		_, _, err = client.PatchRole(context.Background(), role.Id, patch)
		require.NoError(t, err)

		_, resp, err := client.PatchRole(context.Background(), "junk", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	_, resp, err := th.Client.PatchRole(context.Background(), model.NewId(), patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.Client.PatchRole(context.Background(), role.Id, patch)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	patch = &model.RolePatch{
		Permissions: &[]string{"manage_system", "manage_incoming_webhooks", "manage_outgoing_webhooks"},
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		received, _, err := client.PatchRole(context.Background(), role.Id, patch)
		require.NoError(t, err)

		assert.Equal(t, received.Id, role.Id)
		assert.Equal(t, received.Name, role.Name)
		assert.Equal(t, received.DisplayName, role.DisplayName)
		assert.Equal(t, received.Description, role.Description)
		perms := []string{"manage_system", "manage_incoming_webhooks", "manage_outgoing_webhooks"}
		sort.Strings(perms)
		assert.EqualValues(t, received.Permissions, perms)
		assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

		t.Run("Check guest permissions editing without E20 license", func(t *testing.T) {
			license := model.NewTestLicense()
			license.Features.GuestAccountsPermissions = model.NewBool(false)
			th.App.Srv().SetLicense(license)

			guestRole, err := th.App.Srv().Store().Role().GetByName(context.Background(), "system_guest")
			require.NoError(t, err)
			received, resp, err = client.PatchRole(context.Background(), guestRole.Id, patch)
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})

		t.Run("Check guest permissions editing with E20 license", func(t *testing.T) {
			license := model.NewTestLicense()
			license.Features.GuestAccountsPermissions = model.NewBool(true)
			th.App.Srv().SetLicense(license)
			guestRole, err := th.App.Srv().Store().Role().GetByName(context.Background(), "system_guest")
			require.NoError(t, err)
			_, _, err = client.PatchRole(context.Background(), guestRole.Id, patch)
			require.NoError(t, err)
		})
	})
}
