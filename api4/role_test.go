// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetRole(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel"},
		SchemeManaged: true,
	}

	role, err := th.App.Srv.Store.Role().Save(role)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role.Id)

	received, resp := th.Client.GetRole(role.Id)
	CheckNoError(t, resp)

	assert.Equal(t, received.Id, role.Id)
	assert.Equal(t, received.Name, role.Name)
	assert.Equal(t, received.DisplayName, role.DisplayName)
	assert.Equal(t, received.Description, role.Description)
	assert.EqualValues(t, received.Permissions, role.Permissions)
	assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

	_, resp = th.SystemAdminClient.GetRole("1234")
	CheckBadRequestStatus(t, resp)

	_, resp = th.SystemAdminClient.GetRole(model.NewId())
	CheckNotFoundStatus(t, resp)
}

func TestGetRoleByName(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel"},
		SchemeManaged: true,
	}

	role, err := th.App.Srv.Store.Role().Save(role)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role.Id)

	received, resp := th.Client.GetRoleByName(role.Name)
	CheckNoError(t, resp)

	assert.Equal(t, received.Id, role.Id)
	assert.Equal(t, received.Name, role.Name)
	assert.Equal(t, received.DisplayName, role.DisplayName)
	assert.Equal(t, received.Description, role.Description)
	assert.EqualValues(t, received.Permissions, role.Permissions)
	assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

	_, resp = th.SystemAdminClient.GetRoleByName(strings.Repeat("abcdefghij", 10))
	CheckBadRequestStatus(t, resp)

	_, resp = th.SystemAdminClient.GetRoleByName(model.NewId())
	CheckNotFoundStatus(t, resp)
}

func TestGetRolesByNames(t *testing.T) {
	th := Setup(t).InitBasic()
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

	role1, err := th.App.Srv.Store.Role().Save(role1)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role1.Id)

	role2, err = th.App.Srv.Store.Role().Save(role2)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role2.Id)

	role3, err = th.App.Srv.Store.Role().Save(role3)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role3.Id)

	// Check all three roles can be found.
	received, resp := th.Client.GetRolesByNames([]string{role1.Name, role2.Name, role3.Name})
	CheckNoError(t, resp)

	assert.Contains(t, received, role1)
	assert.Contains(t, received, role2)
	assert.Contains(t, received, role3)

	// Check a list of non-existent roles.
	_, resp = th.Client.GetRolesByNames([]string{model.NewId(), model.NewId()})
	CheckNoError(t, resp)

	// Empty list should error.
	_, resp = th.SystemAdminClient.GetRolesByNames([]string{})
	CheckBadRequestStatus(t, resp)

	// Invalid role name should error.
	_, resp = th.Client.GetRolesByNames([]string{model.NewId(), model.NewId(), "!!!!!!"})
	CheckBadRequestStatus(t, resp)

	// Empty/whitespace rolenames should be ignored.
	_, resp = th.Client.GetRolesByNames([]string{model.NewId(), model.NewId(), "", "    "})
	CheckNoError(t, resp)
}

func TestPatchRole(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system", "create_public_channel", "manage_slash_commands"},
		SchemeManaged: true,
	}

	role, err := th.App.Srv.Store.Role().Save(role)
	assert.Nil(t, err)
	defer th.App.Srv.Store.Job().Delete(role.Id)

	patch := &model.RolePatch{
		Permissions: &[]string{"manage_system", "create_public_channel", "manage_incoming_webhooks", "manage_outgoing_webhooks"},
	}

	received, resp := th.SystemAdminClient.PatchRole(role.Id, patch)
	CheckNoError(t, resp)

	assert.Equal(t, received.Id, role.Id)
	assert.Equal(t, received.Name, role.Name)
	assert.Equal(t, received.DisplayName, role.DisplayName)
	assert.Equal(t, received.Description, role.Description)
	assert.EqualValues(t, received.Permissions, []string{"manage_system", "create_public_channel", "manage_incoming_webhooks", "manage_outgoing_webhooks"})
	assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

	// Check a no-op patch succeeds.
	_, resp = th.SystemAdminClient.PatchRole(role.Id, patch)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.PatchRole("junk", patch)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.PatchRole(model.NewId(), patch)
	CheckNotFoundStatus(t, resp)

	_, resp = th.Client.PatchRole(role.Id, patch)
	CheckForbiddenStatus(t, resp)

	// Check a change that the license would not allow.
	patch = &model.RolePatch{
		Permissions: &[]string{"manage_system", "manage_incoming_webhooks", "manage_outgoing_webhooks"},
	}

	_, resp = th.SystemAdminClient.PatchRole(role.Id, patch)
	CheckNotImplementedStatus(t, resp)

	// Add a license.
	license := model.NewTestLicense()
	license.Features.GuestAccountsPermissions = model.NewBool(false)
	th.App.SetLicense(license)

	// Try again, should succeed
	received, resp = th.SystemAdminClient.PatchRole(role.Id, patch)
	CheckNoError(t, resp)

	assert.Equal(t, received.Id, role.Id)
	assert.Equal(t, received.Name, role.Name)
	assert.Equal(t, received.DisplayName, role.DisplayName)
	assert.Equal(t, received.Description, role.Description)
	assert.EqualValues(t, received.Permissions, []string{"manage_system", "manage_incoming_webhooks", "manage_outgoing_webhooks"})
	assert.Equal(t, received.SchemeManaged, role.SchemeManaged)

	t.Run("Check guest permissions editing without E20 license", func(t *testing.T) {
		license := model.NewTestLicense()
		license.Features.GuestAccountsPermissions = model.NewBool(false)
		th.App.SetLicense(license)

		guestRole, err := th.App.Srv.Store.Role().GetByName("system_guest")
		require.Nil(t, err)
		received, resp = th.SystemAdminClient.PatchRole(guestRole.Id, patch)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("Check guest permissions editing with E20 license", func(t *testing.T) {
		license := model.NewTestLicense()
		license.Features.GuestAccountsPermissions = model.NewBool(true)
		th.App.SetLicense(license)
		guestRole, err := th.App.Srv.Store.Role().GetByName("system_guest")
		require.Nil(t, err)
		_, resp = th.SystemAdminClient.PatchRole(guestRole.Id, patch)
		CheckNoError(t, resp)
	})
}
