// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroup(context.Background(), g.Id, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroup(context.Background(), g.Id, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	group, _, err := th.SystemAdminClient.GetGroup(context.Background(), g.Id, "")
	require.NoError(t, err)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Description, group.Description)
	assert.Equal(t, g.RemoteId, group.RemoteId)
	assert.Equal(t, g.CreateAt, group.CreateAt)
	assert.Equal(t, g.UpdateAt, group.UpdateAt)
	assert.Equal(t, g.DeleteAt, group.DeleteAt)

	_, response, err = th.SystemAdminClient.GetGroup(context.Background(), model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroup(context.Background(), "12345", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.GetGroup(context.Background(), group.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestCreateGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g := &model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceCustom,
		Description:    "description_" + id,
		AllowReference: true,
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "ldap"))

	_, resp, err := th.SystemAdminClient.CreateGroup(context.Background(), nil)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	group, _, err := th.SystemAdminClient.CreateGroup(context.Background(), g)
	require.NoError(t, err)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Description, group.Description)
	assert.Equal(t, g.RemoteId, group.RemoteId)

	gbroken := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      "rrrr",
		Description: "description_" + id,
	}

	_, response, err := th.SystemAdminClient.CreateGroup(context.Background(), gbroken)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	validGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewPointer("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}

	th.RemovePermissionFromRole(model.PermissionCreateCustomGroup.Id, model.SystemAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionCreateCustomGroup.Id, model.SystemUserRoleId)
	defer th.AddPermissionToRole(model.PermissionCreateCustomGroup.Id, model.SystemUserRoleId)
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), validGroup)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.AddPermissionToRole(model.PermissionCreateCustomGroup.Id, model.SystemAdminRoleId)
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), validGroup)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	usernameGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           &th.BasicUser.Username,
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), usernameGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	unReferenceableCustomGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewPointer("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: false,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), unReferenceableCustomGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)
	unReferenceableCustomGroup.AllowReference = true
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), unReferenceableCustomGroup)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	customGroupWithRemoteID := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewPointer("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
		RemoteId:       model.NewPointer(model.NewId()),
	}
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), customGroupWithRemoteID)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	reservedNameGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewPointer("here"),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), reservedNameGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.CreateGroup(context.Background(), g)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestDeleteGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	_, response, err := th.Client.DeleteGroup(context.Background(), g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.AddPermissionToRole(model.PermissionDeleteCustomGroup.Id, model.SystemUserRoleId)
	_, response, err = th.Client.DeleteGroup(context.Background(), g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.Client.DeleteGroup(context.Background(), g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.Client.DeleteGroup(context.Background(), "wertyuijhbgvfcde")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	validGroup, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + model.NewId(),
		Name:        model.NewPointer("name" + model.NewId()),
		Source:      model.GroupSourceCustom,
	})
	assert.Nil(t, appErr)

	_, response, err = th.Client.DeleteGroup(context.Background(), validGroup.Id)
	require.NoError(t, err)
	CheckOKStatus(t, response)
}

func TestUndeleteGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	validGroup, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + model.NewId(),
		Name:        model.NewPointer("name" + model.NewId()),
		Source:      model.GroupSourceCustom,
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.DeleteGroup(context.Background(), validGroup.Id)
	require.NoError(t, err)
	CheckOKStatus(t, response)
	th.RemovePermissionFromRole(model.PermissionRestoreCustomGroup.Id, model.SystemUserRoleId)
	// shouldn't allow restoring unless user has required permission
	_, response, err = th.Client.RestoreGroup(context.Background(), validGroup.Id, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.AddPermissionToRole(model.PermissionRestoreCustomGroup.Id, model.SystemUserRoleId)
	_, response, err = th.Client.RestoreGroup(context.Background(), validGroup.Id, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)

	_, response, err = th.Client.RestoreGroup(context.Background(), validGroup.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)
}

func TestPatchGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	g2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewPointer("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	updateFmt := "%s_updated"

	newName := fmt.Sprintf(updateFmt, *g.Name)
	newDisplayName := fmt.Sprintf(updateFmt, g.DisplayName)
	newDescription := fmt.Sprintf(updateFmt, g.Description)

	gp := &model.GroupPatch{
		Name:        &newName,
		DisplayName: &newDisplayName,
		Description: &newDescription,
	}

	_, response, err := th.Client.PatchGroup(context.Background(), g.Id, gp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroup(context.Background(), g.Id, gp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "ldap"))

	group2, response, err := th.SystemAdminClient.PatchGroup(context.Background(), g.Id, gp)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	group, _, err := th.SystemAdminClient.GetGroup(context.Background(), g.Id, "")
	require.NoError(t, err)

	assert.Equal(t, *gp.DisplayName, group.DisplayName)
	assert.Equal(t, *gp.DisplayName, group2.DisplayName)
	assert.Equal(t, *gp.Name, *group.Name)
	assert.Equal(t, *gp.Name, *group2.Name)
	assert.Equal(t, *gp.Description, group.Description)
	assert.Equal(t, *gp.Description, group2.Description)

	assert.Equal(t, group2.UpdateAt, group.UpdateAt)

	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Source, group2.Source)
	assert.Equal(t, g.RemoteId, group.RemoteId)
	assert.Equal(t, g.RemoteId, group2.RemoteId)
	assert.Equal(t, g.CreateAt, group.CreateAt)
	assert.Equal(t, g.CreateAt, group2.CreateAt)
	assert.Equal(t, g.DeleteAt, group.DeleteAt)
	assert.Equal(t, g.DeleteAt, group2.DeleteAt)

	_, response, err = th.SystemAdminClient.PatchGroup(context.Background(), model.NewId(), gp)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroup(context.Background(), g2.Id, &model.GroupPatch{
		Name:           model.NewPointer(model.NewId()),
		DisplayName:    model.NewPointer("foo"),
		AllowReference: model.NewPointer(false),
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	// ensure that omitting the AllowReference field from the patch doesn't patch it to false
	patchedG2, response, err := th.SystemAdminClient.PatchGroup(context.Background(), g2.Id, &model.GroupPatch{
		Name:        model.NewPointer(model.NewId()),
		DisplayName: model.NewPointer("foo"),
	})
	require.NoError(t, err)
	CheckOKStatus(t, response)
	require.Equal(t, true, patchedG2.AllowReference)

	_, response, err = th.SystemAdminClient.PatchGroup(context.Background(), g2.Id, &model.GroupPatch{
		Name: model.NewPointer("here"),
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.PatchGroup(context.Background(), group.Id, gp)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestLinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	id = model.NewId()
	gRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	t.Run("Error if no license is installed", func(t *testing.T) {
		groupSyncable, response, err := th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, groupSyncable)

		groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Normal users are not allowed to link", func(t *testing.T) {
		groupSyncable, response, err := th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	response, err := th.Client.Logout(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, response)
	_, response, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	var groupSyncable *model.GroupSyncable
	t.Run("Team admins are not allowed to link", func(t *testing.T) {
		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	t.Run("Team admins are allowed to link if AllowReference is enabled", func(t *testing.T) {
		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)

		t.Cleanup(func() {
			response, err = th.Client.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
			require.NoError(t, err)
			CheckOKStatus(t, response)
		})
	})

	t.Run("System admins are allowed to link", func(t *testing.T) {
		groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)
	})

	t.Run("System manager without invite_user are allowed to link", func(t *testing.T) {
		_, _, err = th.SystemManagerClient.Login(context.Background(), th.SystemManagerUser.Email, th.SystemManagerUser.Password)
		require.NoError(t, err)
		groupSyncable, response, err = th.SystemManagerClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)
	})

	t.Run("Custom groups can't be linked", func(t *testing.T) {
		gid := model.NewId()
		gCustom, appErr := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + gid,
			Name:        model.NewPointer("name" + gid),
			Source:      model.GroupSourceCustom,
			Description: "description_" + gid,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		assert.Nil(t, appErr)

		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gCustom.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
		assert.Nil(t, groupSyncable)
	})
}

func TestLinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	id = model.NewId()
	gRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	t.Run("Error if no license is installed", func(t *testing.T) {
		groupSyncable, response, err := th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, groupSyncable)

		groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Normal users are not allowed to link", func(t *testing.T) {
		groupSyncable, response, err := th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	th.MakeUserChannelAdmin(th.BasicUser, th.BasicChannel)
	response, err := th.Client.Logout(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, response)
	_, response, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	var groupSyncable *model.GroupSyncable
	t.Run("Channel admins are not allowed to link", func(t *testing.T) {
		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	t.Run("Channel admins are not allowed to link if AllowReference is enabled, but not team syncable exists", func(t *testing.T) {
		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, groupSyncable)
	})

	groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)
	assert.NotNil(t, groupSyncable)

	t.Run("Channel admins are allowed to link if AllowReference is enabled and a team syncable exists", func(t *testing.T) {
		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)

		t.Cleanup(func() {
			response, err = th.Client.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
			require.NoError(t, err)
			CheckOKStatus(t, response)
		})
	})

	t.Run("System admins are allowed to link", func(t *testing.T) {
		groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)
	})

	t.Run("System manager without invite_user are allowed to link", func(t *testing.T) {
		_, _, err = th.SystemManagerClient.Login(context.Background(), th.SystemManagerUser.Email, th.SystemManagerUser.Password)
		require.NoError(t, err)
		groupSyncable, response, err = th.SystemManagerClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.NoError(t, err)
		CheckCreatedStatus(t, response)
		assert.NotNil(t, groupSyncable)
	})

	t.Run("Custom groups can't be linked", func(t *testing.T) {
		gid := model.NewId()
		g2, appErr := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + gid,
			Name:        model.NewPointer("name" + gid),
			Source:      model.GroupSourceCustom,
			Description: "description_" + gid,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		assert.Nil(t, appErr)

		groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), g2.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
		assert.Nil(t, groupSyncable)
	})
}

func TestUnlinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	id = model.NewId()
	gRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)
	assert.NotNil(t, groupSyncable)

	groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)
	assert.NotNil(t, groupSyncable)

	t.Run("Error if no license is installed", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		t.Cleanup(func() { th.App.Srv().SetLicense(model.NewTestLicense("ldap")) })

		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)

		response, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
	})

	t.Run("Normal users are not allowed to unlink", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		assert.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	time.Sleep(4 * time.Second) // A hack to let "go c.App.SyncRolesAndMembership" finish before moving on.
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	response, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, response)
	_, response, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	t.Run("Team admins are not allowed to link", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Team admins are allowed to unlink if AllowReference is enabled", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		t.Cleanup(func() {
			groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
			require.NoError(t, err)
			CheckCreatedStatus(t, response)
			assert.NotNil(t, groupSyncable)
		})
	})

	t.Run("System admins are allowed to unlink", func(t *testing.T) {
		response, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.NoError(t, err)
		CheckOKStatus(t, response)
	})

	t.Run("System manager without invite_user are allowed to link", func(t *testing.T) {
		_, _, err = th.SystemManagerClient.Login(context.Background(), th.SystemManagerUser.Email, th.SystemManagerUser.Password)
		require.NoError(t, err)
		response, err = th.SystemManagerClient.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.NoError(t, err)
		CheckOKStatus(t, response)
	})

	t.Run("Custom groups can't get unlinked", func(t *testing.T) {
		gid := model.NewId()
		g2, appErr := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + gid,
			Name:        model.NewPointer("name" + gid),
			Source:      model.GroupSourceCustom,
			Description: "description_" + gid,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		assert.Nil(t, appErr)

		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g2.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})
}

func TestUnlinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	id = model.NewId()
	gRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)
	assert.NotNil(t, groupSyncable)

	groupSyncable, response, err = th.SystemAdminClient.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)
	assert.NotNil(t, groupSyncable)

	t.Run("Error if no license is installed", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		t.Cleanup(func() { th.App.Srv().SetLicense(model.NewTestLicense("ldap")) })

		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)

		response, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
	})

	t.Run("Normal users are not allowed to unlink", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		assert.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	th.MakeUserChannelAdmin(th.BasicUser, th.BasicChannel)

	response, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, response)
	_, response, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	t.Run("Team admins are not allowed to link", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Team admins are allowed to unlink if AllowReference is enabled", func(t *testing.T) {
		response, err = th.Client.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		t.Cleanup(func() {
			groupSyncable, response, err = th.Client.LinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
			require.NoError(t, err)
			CheckCreatedStatus(t, response)
			assert.NotNil(t, groupSyncable)
		})
	})

	t.Run("System admins are allowed to unlink", func(t *testing.T) {
		response, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), gRef.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, response)
	})

	t.Run("System manager without invite_user are allowed to link", func(t *testing.T) {
		_, _, err = th.SystemManagerClient.Login(context.Background(), th.SystemManagerUser.Email, th.SystemManagerUser.Password)
		require.NoError(t, err)
		response, err = th.SystemManagerClient.UnlinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, response)
	})

	t.Run("Custom groups can't get unlinked", func(t *testing.T) {
		gid := model.NewId()
		g2, appErr := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + gid,
			Name:        model.NewPointer("name" + gid),
			Source:      model.GroupSourceCustom,
			Description: "description_" + gid,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		assert.Nil(t, appErr)

		response, err = th.Client.UnlinkGroupSyncable(context.Background(), g2.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("Unlinking a group in a group constrained channel causes group members to be removed", func(t *testing.T) {
		// Create a test group
		group := th.CreateGroup()

		// Create a channel and set it as group-constrained
		channel := th.CreatePrivateChannel()

		// Create a group user
		groupUser := th.CreateUser()
		th.LinkUserToTeam(groupUser, th.BasicTeam)

		// Create a group member
		_, appErr := th.App.UpsertGroupMember(group.Id, groupUser.Id)
		require.Nil(t, appErr)

		// Associate the group with the channel
		autoAdd := true
		schemeAdmin := true
		_, r, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel, &model.GroupSyncablePatch{AutoAdd: &autoAdd, SchemeAdmin: &schemeAdmin})
		require.NoError(t, err)
		CheckCreatedStatus(t, r)

		// Wait for the user to be added to the channel by polling until you see them
		// or until we hit the timeout
		timeout := time.After(5 * time.Second)
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		var cm *model.ChannelMember
		userFound := false
		for !userFound {
			select {
			case <-timeout:
				require.Fail(t, "Timed out waiting for user to be added to the channel")
				return
			case <-ticker.C:
				// Check if the user is now a member
				cm, _, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err == nil && cm.UserId == groupUser.Id {
					// User has been added, we can continue the test
					userFound = true
				}
			}
		}

		patch := &model.ChannelPatch{}
		patch.GroupConstrained = model.NewPointer(true)
		_, r, err = th.SystemAdminClient.PatchChannel(context.Background(), channel.Id, patch)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Unlink the group
		r, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Wait for the user to be removed from the channel by polling until they're gone
		// or until we hit the timeout
		timeout = time.After(3 * time.Second)
		ticker = time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		userRemoved := false
		for !userRemoved {
			select {
			case <-timeout:
				require.Fail(t, "Timed out waiting for user to be removed from channel")
				return
			case <-ticker.C:
				// Check if the user is still a member
				_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err != nil && r.StatusCode == http.StatusNotFound {
					// User has been removed, we can continue the test
					userRemoved = true
				}
			}
		}

		// Verify the user is no longer a member of the channel
		_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, r)
	})

	t.Run("Unlinking a group in a non group constrained channel does not remove group members from the channel", func(t *testing.T) {
		// Create a test group
		group := th.CreateGroup()

		// Create a channel and set it as group-constrained
		channel := th.CreatePrivateChannel()

		// Create a group user
		groupUser := th.CreateUser()
		th.LinkUserToTeam(groupUser, th.BasicTeam)

		// Create a group member
		_, appErr := th.App.UpsertGroupMember(group.Id, groupUser.Id)
		require.Nil(t, appErr)

		// Associate the group with the channel
		autoAdd := true
		schemeAdmin := true
		_, r, err := th.SystemAdminClient.LinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel, &model.GroupSyncablePatch{AutoAdd: &autoAdd, SchemeAdmin: &schemeAdmin})
		require.NoError(t, err)
		CheckCreatedStatus(t, r)

		// Wait for the user to be added to the channel by polling until you see them
		// or until we hit the timeout
		timeout := time.After(5 * time.Second)
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		var cm *model.ChannelMember
		userFound := false
		for !userFound {
			select {
			case <-timeout:
				require.Fail(t, "Timed out waiting for user to be added to the channel")
				return
			case <-ticker.C:
				// Check if the user is now a member
				cm, _, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err == nil && cm.UserId == groupUser.Id {
					// User has been added, we can continue the test
					userFound = true
				}
			}
		}

		// Unlink the group
		r, err = th.SystemAdminClient.UnlinkGroupSyncable(context.Background(), group.Id, channel.Id, model.GroupSyncableTypeChannel)
		require.NoError(t, err)
		CheckOKStatus(t, r)

		// Wait for a reasonable amount of time to ensure the user is not removed because the channel is not group constrained
		timeout = time.After(2 * time.Second)
		ticker = time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		userStillPresent := true
		for userStillPresent {
			select {
			case <-timeout:
				// If we reach the timeout, the user is still present, which is what we want
				// Verify the user is still a member of the channel
				cm, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				require.NoError(t, err)
				CheckOKStatus(t, r)
				require.Equal(t, groupUser.Id, cm.UserId)
				return
			case <-ticker.C:
				// Check if the user is still a member
				_, r, err = th.SystemAdminClient.GetChannelMember(context.Background(), channel.Id, groupUser.Id, "")
				if err != nil && r.StatusCode == http.StatusNotFound {
					// User has been removed, which is not what we want
					require.Fail(t, "User was incorrectly removed from the channel")
					userStillPresent = false
				}
			}
		}
	})
}

func TestGetGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	_, response, _ = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response, err := th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, model.NewId(), model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), "asdfasdfe3", th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, "asdfasdfe3", model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	_, response, _ = th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response, err := th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, model.NewId(), model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), "asdfasdfe3", th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, "asdfasdfe3", model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.GetGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupTeams(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	for i := 0; i < 10; i++ {
		team := th.CreateTeam()
		_, response, _ := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, team.Id, model.GroupSyncableTypeTeam, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response, err := th.Client.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ = th.Client.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeTeam, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response, err := th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeTeam, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	for i := 0; i < 10; i++ {
		channel := th.CreatePublicChannel()
		_, response, _ := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, channel.Id, model.GroupSyncableTypeChannel, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response, err := th.Client.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ = th.Client.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeChannel, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response, _ := th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeChannel, "")
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.GetGroupSyncables(context.Background(), g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, _ := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	_, response, _ = th.Client.PatchGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	_, response, err := th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewPointer(false)
	groupSyncable, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, model.GroupSyncableTypeTeam, groupSyncable.Type)

	patch.AutoAdd = model.NewPointer(true)
	_, response, _ = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckOKStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, model.NewId(), model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), "abc", th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, "abc", model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewPointer(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, _ := th.SystemAdminClient.LinkGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	role, appErr := th.App.GetRoleByName(context.Background(), "channel_user")
	require.Nil(t, appErr)
	originalPermissions := role.Permissions
	_, appErr = th.App.PatchRole(role, &model.RolePatch{Permissions: &[]string{}})
	require.Nil(t, appErr)

	_, response, _ = th.Client.PatchGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	_, appErr = th.App.PatchRole(role, &model.RolePatch{Permissions: &originalPermissions})
	require.Nil(t, appErr)

	th.App.Srv().SetLicense(nil)

	_, response, err := th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewPointer(false)
	groupSyncable, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, th.BasicChannel.TeamId, groupSyncable.TeamID)
	assert.Equal(t, model.GroupSyncableTypeChannel, groupSyncable.Type)

	patch.AutoAdd = model.NewPointer(true)
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, model.NewId(), model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), "abc", th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, "abc", model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, err = th.SystemAdminClient.Logout(context.Background())
	require.NoError(t, err)
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(context.Background(), g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupsByChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=false
	id2 := model.NewId()
	groupNoRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id2,
		Name:           model.NewPointer("name" + id2),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id2,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: false,
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=true
	id3 := model.NewId()
	groupWithRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id3,
		Name:           model.NewPointer("name" + id3),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id3,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	groupSyncable, appErr := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    groupNoRef.Id,
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    groupWithRef.Id,
	})
	assert.Nil(t, appErr)

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByChannel(context.Background(), "asdfasdf", opts)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	th.App.Srv().SetLicense(nil)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByChannel(context.Background(), th.BasicChannel.Id, opts)
		require.Error(t, err)
		if client == th.SystemAdminClient {
			CheckNotImplementedStatus(t, response)
		} else {
			CheckForbiddenStatus(t, response)
		}
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	privateChannel := th.CreateChannelWithClient(th.SystemAdminClient, model.ChannelTypePrivate)

	_, _, response, err := th.Client.GetGroupsByChannel(context.Background(), privateChannel.Id, opts)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		var groups []*model.GroupWithSchemeAdmin
		groups, _, _, err = client.GetGroupsByChannel(context.Background(), th.BasicChannel.Id, opts)
		assert.NoError(t, err)
		assert.Len(t, groups, 3)

		// Admin should see all groups
		foundNoRef := false
		foundWithRef := false
		for _, g := range groups {
			if g.Group.Id == groupNoRef.Id {
				foundNoRef = true
			}
			if g.Group.Id == groupWithRef.Id {
				foundWithRef = true
			}
		}
		assert.True(t, foundNoRef, "Admin should see groups with AllowReference=false")
		assert.True(t, foundWithRef, "Admin should see groups with AllowReference=true")
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByChannel(context.Background(), th.BasicChannel.Id, opts)
		assert.NoError(t, err)
		assert.Len(t, groups, 3)

		// Verify SchemeAdmin field is updated for the first group
		for _, g := range groups {
			if g.Group.Id == group.Id {
				require.NotNil(t, g.SchemeAdmin)
				require.True(t, *g.SchemeAdmin)
			}
		}

		groups, _, _, err = client.GetGroupsByChannel(context.Background(), model.NewId(), opts)
		CheckErrorID(t, err, "app.channel.get.existing.app_error")
		assert.Empty(t, groups)
	})
}

func TestGetGroupsAssociatedToChannelsByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=false
	id2 := model.NewId()
	groupNoRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id2,
		Name:           model.NewPointer("name" + id2),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id2,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: false,
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=true
	id3 := model.NewId()
	groupWithRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + id3,
		Name:           model.NewPointer("name" + id3),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id3,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	groupSyncable, appErr := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    groupNoRef.Id,
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    groupWithRef.Id,
	})
	assert.Nil(t, appErr)

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, err := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), "asdfasdf", opts)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.App.Srv().SetLicense(nil)

	_, response, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groups, _, err := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
	assert.NoError(t, err)

	// Admin should see all groups
	assert.Len(t, groups[th.BasicChannel.Id], 3)

	foundNoRef := false
	foundWithRef := false
	for _, g := range groups[th.BasicChannel.Id] {
		if g.Group.Id == groupNoRef.Id {
			foundNoRef = true
		}
		if g.Group.Id == groupWithRef.Id {
			foundWithRef = true
		}
	}
	assert.True(t, foundNoRef, "Admin should see groups with AllowReference=false")
	assert.True(t, foundWithRef, "Admin should see groups with AllowReference=true")

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	// Test with regular user and FilterAllowReference
	t.Run("regular user with FilterAllowReference", func(t *testing.T) {
		optsWithFilter := opts
		optsWithFilter.FilterAllowReference = true

		groups, _, err = th.Client.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, optsWithFilter)
		assert.NoError(t, err)

		// Regular user should only see groups with AllowReference=true
		for _, groupList := range groups {
			for _, g := range groupList {
				if g.Group.Id == groupWithRef.Id {
					assert.True(t, g.Group.AllowReference)
				}
				assert.NotEqual(t, g.Group.Id, groupNoRef.Id, "Non-admin user should not see groups with AllowReference=false")
			}
		}
	})

	groups, _, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), model.NewId(), opts)
	assert.NoError(t, err)
	assert.Empty(t, groups)

	t.Run("should get the groups ok when belonging to the team", func(t *testing.T) {
		var resp *model.Response
		groups, resp, err = th.Client.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, groups)
	})

	t.Run("should return forbidden when the user doesn't have the right permissions", func(t *testing.T) {
		require.Nil(t, th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.SystemAdminUser.Id))
		defer func() {
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
			require.Nil(t, appErr)
		}()
		var resp *model.Response
		groups, resp, err = th.Client.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Empty(t, groups)
	})
}

func TestGetGroupsByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn1_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, err)

	id2 := model.NewId()
	groupNoRef, err := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn2_" + id2,
		Name:           model.NewPointer("name" + id2),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id2,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: false,
	})
	assert.Nil(t, err)

	id3 := model.NewId()
	groupWithRef, err := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn3_" + id3,
		Name:           model.NewPointer("name" + id3),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id3,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, err)

	groupSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	assert.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    groupNoRef.Id,
	})
	assert.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    groupWithRef.Id,
	})
	assert.Nil(t, err)

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByTeam(context.Background(), "asdfasdf", opts)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	appErr := th.App.Srv().RemoveLicense()
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
		require.Error(t, err)
		if client == th.SystemAdminClient {
			CheckNotImplementedStatus(t, response)
		} else {
			CheckForbiddenStatus(t, response)
		}
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
		assert.NoError(t, err)
		existingGroups := []*model.GroupWithSchemeAdmin{
			{
				Group:       *group,
				SchemeAdmin: model.NewPointer(false),
			},
			{
				Group:       *groupNoRef,
				SchemeAdmin: model.NewPointer(false),
			},
			{
				Group:       *groupWithRef,
				SchemeAdmin: model.NewPointer(false),
			},
		}
		assert.ElementsMatch(t, existingGroups, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
		assert.NoError(t, err)
		existingGroups := []*model.GroupWithSchemeAdmin{
			{
				Group:       *group,
				SchemeAdmin: model.NewPointer(true),
			},
			{
				Group:       *groupNoRef,
				SchemeAdmin: model.NewPointer(false),
			},
			{
				Group:       *groupWithRef,
				SchemeAdmin: model.NewPointer(false),
			},
		}

		assert.ElementsMatch(t, existingGroups, groups)

		groups, _, _, err = client.GetGroupsByTeam(context.Background(), model.NewId(), opts)
		assert.NoError(t, err)
		assert.Empty(t, groups)
	})

	t.Run("groups should be fetched only by users with the right permissions", func(t *testing.T) {
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			groups, _, _, err := client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
			require.NoError(t, err)
			require.Len(t, groups, 3)
			// Admin should see all groups
			foundNoRef := false
			foundWithRef := false
			for _, g := range groups {
				if g.Group.Id == groupNoRef.Id {
					foundNoRef = true
				}
				if g.Group.Id == groupWithRef.Id {
					foundWithRef = true
				}
			}
			assert.True(t, foundNoRef, "Admin should see groups with AllowReference=false")
			assert.True(t, foundWithRef, "Admin should see groups with AllowReference=true")
		}, "groups can be fetched by system admins even if they're not part of a team")

		t.Run("user can fetch groups if it's part of the team", func(t *testing.T) {
			optsWithFilter := opts

			groups, _, _, err := th.Client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, optsWithFilter)
			require.NoError(t, err)

			for _, g := range groups {
				if g.Group.Id == groupWithRef.Id {
					assert.True(t, g.Group.AllowReference)
				}
				assert.NotEqual(t, g.Group.Id, groupNoRef.Id, "Non-admin user should not see groups with AllowReference=false")
			}
		})

		t.Run("user can't fetch groups if it's not part of the team", func(t *testing.T) {
			require.Nil(t, th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.SystemAdminUser.Id))
			defer func() {
				_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
				require.Nil(t, appErr)
			}()

			groups, _, response, err := th.Client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
			require.Error(t, err)
			CheckForbiddenStatus(t, response)
			require.Empty(t, groups)
		})
	})
}

func TestGetGroups(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// make sure "createdDate" for next group is after one created in InitBasic()
	time.Sleep(2 * time.Millisecond)
	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)
	start := group.UpdateAt - 1

	id2 := model.NewId()
	group2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id2,
		Name:           model.NewPointer("name" + id2),
		Source:         model.GroupSourceCustom,
		Description:    "description_" + id2,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=false
	id3 := model.NewId()
	groupNoRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id3,
		Name:           model.NewPointer("name" + id3),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id3,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: false,
	})
	assert.Nil(t, appErr)

	// Create a group with AllowReference=true
	id4 := model.NewId()
	groupWithRef, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id4,
		Name:           model.NewPointer("name" + id4),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id4,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	baseOpts := model.GroupSearchOpts{
		Source: model.GroupSourceLdap,
	}

	t.Run("without license", func(t *testing.T) {
		opts := baseOpts
		th.App.Srv().SetLicense(nil)
		groups, response, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, groups)
	})

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	t.Run("basic search for all groups", func(t *testing.T) {
		opts := baseOpts
		opts.Source = ""
		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.ElementsMatch(t, []*model.Group{group, th.Group, groupNoRef, groupWithRef, group2}, groups)
		assert.Nil(t, groups[0].MemberCount)
	})

	t.Run("test FilterAllowReference for non-admin user", func(t *testing.T) {
		opts := baseOpts
		opts.FilterAllowReference = true

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		groups, _, err := th.Client.GetGroups(context.Background(), opts)
		require.NoError(t, err)

		for _, g := range groups {
			if g.Id == groupWithRef.Id {
				assert.True(t, g.AllowReference)
			}
			assert.NotEqual(t, g.Id, groupNoRef.Id, "Non-admin user should not see groups with AllowReference=false")
		}

		_, _, err = th.SystemAdminClient.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)
	})

	t.Run("test FilterAllowReference for admin user", func(t *testing.T) {
		opts := baseOpts

		groups, _, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)

		foundNoRef := false
		foundWithRef := false
		for _, g := range groups {
			if g.Id == groupNoRef.Id {
				foundNoRef = true
			}
			if g.Id == groupWithRef.Id {
				foundWithRef = true
			}
		}
		assert.True(t, foundNoRef, "Admin should see groups with AllowReference=false")
		assert.True(t, foundWithRef, "Admin should see groups with AllowReference=true")
	})

	t.Run("include member count", func(t *testing.T) {
		opts := baseOpts
		opts.IncludeMemberCount = true
		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.NotNil(t, groups[0].MemberCount)
	})

	t.Run("search with Q parameter", func(t *testing.T) {
		opts := baseOpts
		opts.Q = "-fOo"
		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, groups, 3)
	})

	t.Run("test FilterAllowReference for non-admin user", func(t *testing.T) {
		opts := baseOpts
		opts.FilterAllowReference = true

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		groups, _, err := th.Client.GetGroups(context.Background(), opts)
		require.NoError(t, err)

		for _, g := range groups {
			if g.Id == groupWithRef.Id {
				assert.True(t, g.AllowReference)
			}
			assert.NotEqual(t, g.Id, groupNoRef.Id, "Non-admin user should not see groups with AllowReference=false")
		}

		_, _, err = th.SystemAdminClient.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)
	})

	t.Run("test FilterAllowReference for admin user", func(t *testing.T) {
		opts := baseOpts

		groups, _, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)

		foundNoRef := false
		foundWithRef := false
		for _, g := range groups {
			if g.Id == groupNoRef.Id {
				foundNoRef = true
			}
			if g.Id == groupWithRef.Id {
				foundWithRef = true
			}
		}
		assert.True(t, foundNoRef, "Admin should see groups with AllowReference=false")
		assert.True(t, foundWithRef, "Admin should see groups with AllowReference=true")
	})

	t.Run("not associated to channel", func(t *testing.T) {
		opts := baseOpts
		resp, err := th.SystemAdminClient.UpdateChannelRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		opts.NotAssociatedToChannel = th.BasicChannel.Id

		resp, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "channel_user channel_admin")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.ElementsMatch(t, []*model.Group{group, th.Group, groupNoRef, groupWithRef}, groups)
	})

	t.Run("not associated to team", func(t *testing.T) {
		opts := baseOpts
		resp, err := th.SystemAdminClient.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		opts.NotAssociatedToTeam = th.BasicTeam.Id

		resp, err = th.SystemAdminClient.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "team_user team_admin")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.ElementsMatch(t, []*model.Group{group, th.Group, groupNoRef, groupWithRef}, groups)
	})

	t.Run("since parameter", func(t *testing.T) {
		opts := baseOpts
		opts.Since = start
		groups, resp, err := th.Client.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, groups, 1)
		assert.Equal(t, groups[0].Id, groupWithRef.Id)

		opts.Since = model.GetMillis()
		groups, resp, err = th.Client.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Empty(t, groups)
	})

	t.Run("archived groups", func(t *testing.T) {
		opts := baseOpts
		_, appErr = th.App.DeleteGroup(group.Id)
		require.Nil(t, appErr)

		// Test include_archived parameter
		opts.IncludeArchived = true
		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, groups, 4)

		// Test returning only archived groups
		opts.FilterArchived = true
		groups, _, err = th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, groups, 1)
		assert.Equal(t, groups[0].Id, group.Id)
	})

	t.Run("group source filtering", func(t *testing.T) {
		opts := baseOpts
		opts.Source = model.GroupSourceCustom
		groups, resp, err := th.Client.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, groups, 1)
		assert.Equal(t, groups[0].Id, group2.Id)
	})

	t.Run("channel member counts", func(t *testing.T) {
		opts := baseOpts
		opts.IncludeChannelMemberCount = th.BasicChannel.Id
		opts.IncludeTimezones = true
		opts.Q = "-fOo"
		opts.IncludeMemberCount = true
		opts.Source = model.GroupSourceCustom // Switch to custom source to get group2

		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, groups, 1)
		assert.Equal(t, *groups[0].MemberCount, int(0))
		assert.Equal(t, *groups[0].ChannelMemberCount, int(0))

		_, appErr = th.App.UpsertGroupMember(group2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		groups, resp, err = th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, groups, 1)
		assert.Equal(t, *groups[0].MemberCount, int(1))
		assert.Equal(t, *groups[0].ChannelMemberCount, int(1))
	})

	t.Run("custom groups disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomGroups = false
		})

		t.Run("custom source not allowed", func(t *testing.T) {
			opts := baseOpts
			opts.Source = model.GroupSourceCustom
			groups, response, err := th.Client.GetGroups(context.Background(), opts)
			require.Error(t, err)
			CheckBadRequestStatus(t, response)
			assert.Nil(t, groups)
		})

		t.Run("ldap source allowed", func(t *testing.T) {
			opts := baseOpts
			opts.Source = model.GroupSourceLdap
			groups, resp, err := th.Client.GetGroups(context.Background(), opts)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.Len(t, groups, 1)
			assert.Equal(t, groups[0].Source, model.GroupSourceLdap)
		})

		t.Run("no source specified", func(t *testing.T) {
			opts := baseOpts
			opts.Source = ""
			groups, resp, err := th.Client.GetGroups(context.Background(), opts)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			assert.Len(t, groups, 1)
			assert.Equal(t, groups[0].Source, model.GroupSourceLdap)
		})
	})

	t.Run("only_syncable_sources parameter", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomGroups = true
		})

		// Create a syncable group with the plugin prefix
		id := model.NewId()
		_, appErr := th.App.CreateGroup(&model.Group{
			DisplayName: "dn-foo_" + id,
			Name:        model.NewPointer("name" + id),
			Source:      model.GroupSourcePluginPrefix + "keycloak",
			Description: "description_" + id,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		require.Nil(t, appErr)

		// First test without only_syncable_sources
		opts := model.GroupSearchOpts{
			PageOpts: &model.PageOpts{
				Page:    0,
				PerPage: 60,
			},
		}
		groups, resp, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		// Should return all groups regardless of source when not specified
		assert.Len(t, groups, 5)

		// Test with custom groups disabled and only_syncable_sources=true
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomGroups = false
		})
		groups, resp, err = th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		// Should still only return LDAP groups
		assert.Len(t, groups, 4)
		for _, g := range groups {
			assert.True(t, g.Source == model.GroupSourceLdap || strings.HasPrefix(string(g.Source), string(model.GroupSourcePluginPrefix)))
		}

		// Reset config
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomGroups = true
		})

		// Test with only_syncable_sources=true
		opts.OnlySyncableSources = true
		groups, resp, err = th.SystemAdminClient.GetGroups(context.Background(), opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Should only return groups from syncable sources (LDAP and plugin_ groups)
		assert.Len(t, groups, 4)
		for _, g := range groups {
			assert.True(t, g.Source == model.GroupSourceLdap || strings.HasPrefix(string(g.Source), string(model.GroupSourcePluginPrefix)))
		}
	})
}

func TestGetGroupsByUserId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group1, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)
	user1.Password = "test-password-1"
	_, appErr = th.App.UpsertGroupMember(group1.Id, user1.Id)
	assert.Nil(t, appErr)

	id = model.NewId()
	group2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: true,
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupMember(group2.Id, user1.Id)
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(nil)
	_, response, err := th.SystemAdminClient.GetGroupsByUserId(context.Background(), user1.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))
	_, response, err = th.SystemAdminClient.GetGroupsByUserId(context.Background(), "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupsByUserId(context.Background(), "notvaliduserid")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	groups, _, err := th.SystemAdminClient.GetGroupsByUserId(context.Background(), user1.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)

	// test permissions
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	_, response, err = th.Client.GetGroupsByUserId(context.Background(), user1.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), user1.Email, user1.Password)
	require.NoError(t, err)
	groups, _, err = th.Client.GetGroupsByUserId(context.Background(), user1.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)
}

func TestGetGroupMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn-foo_" + id,
		Name:           model.NewPointer("name" + id),
		Source:         model.GroupSourceLdap,
		Description:    "description_" + id,
		RemoteId:       model.NewPointer(model.NewId()),
		AllowReference: false,
	})
	assert.Nil(t, appErr)

	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

	user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user2", Password: "test-password-2", Username: "test-user-2", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupMembers(group.Id, []string{user1.Id, user2.Id})
	require.Nil(t, appErr)

	t.Run("Requires ldap license", func(t *testing.T) {
		members, response, err := th.SystemAdminClient.GetGroupMembers(context.Background(), group.Id)
		assert.Error(t, err)
		CheckNotImplementedStatus(t, response)
		assert.Nil(t, members)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Non admins are not allowed to get members for LDAP groups when allow reference is false", func(t *testing.T) {
		members, response, err := th.Client.GetGroupMembers(context.Background(), group.Id)
		assert.Error(t, err)
		CheckForbiddenStatus(t, response)
		assert.Nil(t, members)
	})

	t.Run("Admins are allowed to get members for LDAP groups", func(t *testing.T) {
		members, response, err := th.SystemAdminClient.GetGroupMembers(context.Background(), group.Id)
		assert.NoError(t, err)
		CheckOKStatus(t, response)
		require.NotNil(t, members)
		assert.Equal(t, 2, members.Count)
	})

	t.Run("If AllowReference is enabled, non admins are allowed to get members for LDAP groups", func(t *testing.T) {
		group.AllowReference = true
		group, appErr = th.App.UpdateGroup(group)
		assert.Nil(t, appErr)

		t.Cleanup(func() {
			group.AllowReference = false
			group, appErr = th.App.UpdateGroup(group)
			assert.Nil(t, appErr)
		})

		members, response, err := th.Client.GetGroupMembers(context.Background(), group.Id)
		assert.NoError(t, err)
		CheckOKStatus(t, response)
		require.NotNil(t, members)
		assert.Equal(t, 2, members.Count)
	})
}

func TestGetGroupStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	t.Run("Requires ldap license", func(t *testing.T) {
		_, response, err := th.SystemAdminClient.GetGroupStats(context.Background(), group.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Requires manage system permission to access group stats", func(t *testing.T) {
		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)
		_, response, err := th.Client.GetGroupStats(context.Background(), group.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Returns stats for a group with no members", func(t *testing.T) {
		stats, _, err := th.SystemAdminClient.GetGroupStats(context.Background(), group.Id)
		require.NoError(t, err)
		assert.Equal(t, stats.GroupID, group.Id)
		assert.Equal(t, stats.TotalMemberCount, int64(0))
	})

	user1, err := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, err)
	_, appErr = th.App.UpsertGroupMember(group.Id, user1.Id)
	assert.Nil(t, appErr)

	t.Run("Returns stats for a group with members", func(t *testing.T) {
		stats, _, _ := th.SystemAdminClient.GetGroupStats(context.Background(), group.Id)
		assert.Equal(t, stats.GroupID, group.Id)
		assert.Equal(t, stats.TotalMemberCount, int64(1))
	})
}

func TestGetGroupsGroupConstrainedParentTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	var groups []*model.Group
	for i := 0; i < 4; i++ {
		id := model.NewId()
		group, err := th.App.CreateGroup(&model.Group{
			DisplayName: fmt.Sprintf("dn-foo_%d", i),
			Name:        model.NewPointer("name" + id),
			Source:      model.GroupSourceLdap,
			Description: "description_" + id,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		require.Nil(t, err)
		groups = append(groups, group)
	}

	team := th.CreateTeam()

	id := model.NewId()
	channel := &model.Channel{
		DisplayName:      "dn_" + id,
		Name:             "name" + id,
		Type:             model.ChannelTypePrivate,
		TeamId:           team.Id,
		GroupConstrained: model.NewPointer(true),
	}
	channel, appErr := th.App.CreateChannel(th.Context, channel, false)
	require.Nil(t, appErr)

	// normal result of groups are returned if the team is not group-constrained
	apiGroups, _, err := th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
	require.NoError(t, err)
	require.Contains(t, apiGroups, groups[0])
	require.Contains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	team.GroupConstrained = model.NewPointer(true)
	team, appErr = th.App.UpdateTeam(team)
	require.Nil(t, appErr)

	// team is group-constrained but has no associated groups
	apiGroups, _, err = th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.NoError(t, err)
	require.Len(t, apiGroups, 0)

	for _, group := range []*model.Group{groups[0], groups[2], groups[3]} {
		_, appErr = th.App.UpsertGroupSyncable(model.NewGroupTeam(group.Id, team.Id, false))
		require.Nil(t, appErr)
	}

	// set of the teams groups are returned
	apiGroups, _, err = th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.NoError(t, err)
	require.Contains(t, apiGroups, groups[0])
	require.NotContains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	// paged results function as expected
	apiGroups, _, err = th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 0}})
	require.NoError(t, err)
	require.Len(t, apiGroups, 2)
	require.Equal(t, apiGroups[0].Id, groups[0].Id)
	require.Equal(t, apiGroups[1].Id, groups[2].Id)

	apiGroups, _, err = th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 1}})
	require.NoError(t, err)
	require.Len(t, apiGroups, 1)
	require.Equal(t, apiGroups[0].Id, groups[3].Id)

	_, appErr = th.App.UpsertGroupSyncable(model.NewGroupChannel(groups[0].Id, channel.Id, false))
	require.Nil(t, appErr)

	// as usual it doesn't return groups already associated to the channel
	apiGroups, _, err = th.SystemAdminClient.GetGroups(context.Background(), model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
	require.NoError(t, err)
	require.NotContains(t, apiGroups, groups[0])
	require.Contains(t, apiGroups, groups[2])
}

func TestAddMembersToGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Set license for all tests
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	// setup creates a fresh group and users for each test
	setup := func(t *testing.T) (*model.Group, []*model.User) {
		// Create custom group
		id := model.NewId()
		group, err := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + id,
			Name:        model.NewPointer("name" + id),
			Source:      model.GroupSourceCustom,
			Description: "description_" + id,
		})
		require.Nil(t, err)

		// Create test users with random usernames to prevent collisions
		users := make([]*model.User, 3)
		for i := 0; i < 3; i++ {
			randomId := model.NewId()
			user, appErr := th.App.CreateUser(th.Context, &model.User{
				Email:    th.GenerateTestEmail(),
				Nickname: fmt.Sprintf("test user%d-%s", i+1, randomId),
				Password: fmt.Sprintf("test-password-%d", i+1),
				Username: fmt.Sprintf("test-user-%d-%s", i+1, randomId),
				Roles:    model.SystemUserRoleId,
			})
			require.Nil(t, appErr)
			users[i] = user
		}

		return group, users
	}

	t.Run("empty group members returns bad request", func(t *testing.T) {
		group, _ := setup(t)

		_, resp, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("successfully add members to custom group", func(t *testing.T) {
		group, users := setup(t)

		members := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id, users[1].Id},
		}

		groupMembers, response, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, members)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		require.Len(t, groupMembers, 2)

		count, countErr := th.App.GetGroupMemberCount(group.Id, nil)
		require.Nil(t, countErr)
		require.Equal(t, int64(2), count)
	})

	t.Run("adding existing members", func(t *testing.T) {
		group, users := setup(t)

		// First, add two users to the group
		initialMembers := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id, users[1].Id},
		}

		returnedMembers, response, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, initialMembers)
		require.NoError(t, err)
		CheckOKStatus(t, response)
		require.Len(t, returnedMembers, 2)

		// Try to add a user that's already in the group
		existingMembers := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id},
		}

		groupMembers, response, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, existingMembers)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		// Should return empty array since no new members were added
		require.Len(t, groupMembers, 1)

		// Verify the group still has the original member count
		count, countErr := th.App.GetGroupMemberCount(group.Id, nil)
		require.Nil(t, countErr)
		require.Equal(t, int64(2), count)

		// Try with multiple users - one already in group, one not
		mixedMembers := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id, users[2].Id},
		}

		groupMembers, response, err = th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, mixedMembers)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		// Should only return the new member
		require.Len(t, groupMembers, 2)

		// Verify the group now has 3 members
		count, countErr = th.App.GetGroupMemberCount(group.Id, nil)
		require.Nil(t, countErr)
		require.Equal(t, int64(3), count)
	})

	t.Run("invalid group ID", func(t *testing.T) {
		_, users := setup(t)

		members := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id, users[1].Id},
		}

		_, response, err := th.Client.UpsertGroupMembers(context.Background(), "abc123", members)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("invalid user ID format", func(t *testing.T) {
		group, _ := setup(t)

		invalidMembers := &model.GroupModifyMembers{
			UserIds: []string{"abc123"},
		}

		_, response, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, invalidMembers)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("non-existent user ID", func(t *testing.T) {
		group, _ := setup(t)

		nonExistentID := model.NewId()
		nonExistentMembers := &model.GroupModifyMembers{
			UserIds: []string{nonExistentID},
		}

		_, response, err := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, nonExistentMembers)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
		require.Contains(t, err.Error(), fmt.Sprintf(`User with username "%s" could not be found.`, nonExistentID))
	})

	t.Run("ldap group rejects adding members", func(t *testing.T) {
		_, users := setup(t)

		// Create LDAP group
		ldapId := model.NewId()
		ldapGroup, err := th.App.CreateGroup(&model.Group{
			DisplayName: "dn_" + ldapId,
			Name:        model.NewPointer("name" + ldapId),
			Source:      model.GroupSourceLdap,
			Description: "description_" + ldapId,
			RemoteId:    model.NewPointer(model.NewId()),
		})
		require.Nil(t, err)

		members := &model.GroupModifyMembers{
			UserIds: []string{users[0].Id, users[1].Id},
		}

		_, response, upsertErr := th.SystemAdminClient.UpsertGroupMembers(context.Background(), ldapGroup.Id, members)
		require.Error(t, upsertErr)
		CheckBadRequestStatus(t, response)
	})
}

func TestDeleteMembersFromGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create test users
	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)

	user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user2", Password: "test-password-2", Username: "test-user-2", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)

	user3, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user3", Password: "test-password-3", Username: "test-user-3", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)

	// Create custom group with two members
	id := model.NewId()
	g := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceCustom,
		Description: "description_" + id,
	}
	group, err := th.App.CreateGroupWithUserIds(&model.GroupWithUserIds{
		Group:   *g,
		UserIds: []string{user1.Id, user2.Id},
	})
	require.Nil(t, err)

	// Create LDAP group with the same members
	ldapId := model.NewId()
	g1 := &model.Group{
		DisplayName: "dn_" + ldapId,
		Name:        model.NewPointer("name" + ldapId),
		Source:      model.GroupSourceLdap,
		Description: "description_" + ldapId,
		RemoteId:    model.NewPointer(model.NewId()),
	}
	ldapGroup, err := th.App.CreateGroupWithUserIds(&model.GroupWithUserIds{
		Group:   *g1,
		UserIds: []string{user1.Id, user2.Id},
	})
	require.Nil(t, err)

	// Set license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	t.Run("Fail with nil member list", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Success with valid member removal", func(t *testing.T) {
		members := &model.GroupModifyMembers{
			UserIds: []string{user1.Id},
		}

		groupMembers, response, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, members)
		require.NoError(t, err)
		CheckOKStatus(t, response)

		require.Len(t, groupMembers, 1)
		require.Equal(t, groupMembers[0].UserId, user1.Id)

		// Verify only one user remains in the group
		users, usersErr := th.App.GetGroupMemberUsers(group.Id)
		require.Nil(t, usersErr)
		require.Len(t, users, 1)
		require.Equal(t, users[0].Id, user2.Id)
	})

	t.Run("Fail with invalid group ID", func(t *testing.T) {
		members := &model.GroupModifyMembers{
			UserIds: []string{user1.Id},
		}

		_, response, err := th.Client.DeleteGroupMembers(context.Background(), "abc123", members)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("Fail with invalid user ID format", func(t *testing.T) {
		invalidMembers := &model.GroupModifyMembers{
			UserIds: []string{"abc123"},
		}

		_, response, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, invalidMembers)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("Fail with non-existent user ID", func(t *testing.T) {
		nonExistentID := model.NewId()
		nonExistentMembers := &model.GroupModifyMembers{
			UserIds: []string{nonExistentID},
		}

		_, response, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, nonExistentMembers)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
		require.Contains(t, err.Error(), fmt.Sprintf(`User with username "%s" could not be found.`, nonExistentID))
	})

	t.Run("Fail with user not in group", func(t *testing.T) {
		validNonMemberMembers := &model.GroupModifyMembers{
			UserIds: []string{user3.Id},
		}

		_, response, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, validNonMemberMembers)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
		require.Contains(t, err.Error(), fmt.Sprintf(`User with username "%s" could not be found.`, user3.Id))
	})

	t.Run("Fail with LDAP source group", func(t *testing.T) {
		members := &model.GroupModifyMembers{
			UserIds: []string{user1.Id},
		}

		_, response, err := th.SystemAdminClient.DeleteGroupMembers(context.Background(), ldapGroup.Id, members)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})
}
