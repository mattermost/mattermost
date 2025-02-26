// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
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
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	groupSyncable, appErr := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
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
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(false)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByChannel(context.Background(), th.BasicChannel.Id, opts)
		assert.NoError(t, err)
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

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

	groupSyncable, appErr := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
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

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewPointer(false)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.False(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	// ensure that SchemeAdmin field is updated
	groups, _, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
	assert.NoError(t, err)

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewPointer(true)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.True(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	groups, _, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(context.Background(), model.NewId(), opts)
	assert.NoError(t, err)
	assert.Empty(t, groups)

	t.Run("should get the groups ok when belonging to the team", func(t *testing.T) {
		groups, resp, err := th.Client.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
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
		groups, resp, err := th.Client.GetGroupsAssociatedToChannelsByTeam(context.Background(), th.BasicTeam.Id, opts)
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
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, err)

	groupSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
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
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(false)}}, groups)
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
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

		groups, _, _, err = client.GetGroupsByTeam(context.Background(), model.NewId(), opts)
		assert.NoError(t, err)
		assert.Empty(t, groups)
	})

	t.Run("groups should be fetched only by users with the right permissions", func(t *testing.T) {
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			groups, _, _, err := client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
			require.NoError(t, err)
			require.Len(t, groups, 1)
			require.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(true)}}, groups)
			require.NotNil(t, groups[0].SchemeAdmin)
			require.True(t, *groups[0].SchemeAdmin)
		}, "groups can be fetched by system admins even if they're not part of a team")

		t.Run("user can fetch groups if it's part of the team", func(t *testing.T) {
			groups, _, _, err := th.Client.GetGroupsByTeam(context.Background(), th.BasicTeam.Id, opts)
			require.NoError(t, err)
			require.Len(t, groups, 1)
			require.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewPointer(true)}}, groups)
			require.NotNil(t, groups[0].SchemeAdmin)
			require.True(t, *groups[0].SchemeAdmin)
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
		DisplayName: "dn-foo_" + id2,
		Name:        model.NewPointer("name" + id2),
		Source:      model.GroupSourceCustom,
		Description: "description_" + id2,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	opts := model.GroupSearchOpts{
		Source: model.GroupSourceLdap,
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	_, _, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
	require.NoError(t, err)

	_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)

	opts.NotAssociatedToChannel = th.BasicChannel.Id

	_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), th.BasicChannel.Id, th.BasicUser.Id, "channel_user channel_admin")
	require.NoError(t, err)

	groups, _, err := th.SystemAdminClient.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group, th.Group}, groups)
	assert.Nil(t, groups[0].MemberCount)

	opts.IncludeMemberCount = true
	groups, _, _ = th.SystemAdminClient.GetGroups(context.Background(), opts)
	assert.NotNil(t, groups[0].MemberCount)
	opts.IncludeMemberCount = false

	opts.Q = "-fOo"
	groups, _, _ = th.SystemAdminClient.GetGroups(context.Background(), opts)
	assert.Len(t, groups, 1)
	opts.Q = ""

	_, err = th.SystemAdminClient.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)

	opts.NotAssociatedToTeam = th.BasicTeam.Id

	_, err = th.SystemAdminClient.UpdateTeamMemberRoles(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, "team_user team_admin")
	require.NoError(t, err)

	_, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)

	// test "since", should only return group created in this test, not th.Group
	opts.Since = start
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	// test correct group returned
	assert.Equal(t, groups[0].Id, group.Id)

	// delete group, should still return
	_, appErr = th.App.DeleteGroup(group.Id)
	require.Nil(t, appErr)
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group.Id)

	// test with current since value, return none
	opts.Since = model.GetMillis()
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Empty(t, groups)

	// make sure delete group is not returned without Since
	opts.Since = 0
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	//'Normal getGroups should not return delete groups
	assert.Len(t, groups, 1)
	// make sure it returned th.Group,not group
	assert.Equal(t, groups[0].Id, th.Group.Id)

	// Test include_archived parameter
	opts.IncludeArchived = true
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 2)
	opts.IncludeArchived = false

	// Test returning only archived groups
	opts.FilterArchived = true
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group.Id)
	opts.FilterArchived = false

	opts.Source = model.GroupSourceCustom
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group2.Id)

	// Test IncludeChannelMemberCount url param is working
	opts.IncludeChannelMemberCount = th.BasicChannel.Id
	opts.IncludeTimezones = true
	opts.Q = "-fOo"
	opts.IncludeMemberCount = true

	groups, _, _ = th.SystemAdminClient.GetGroups(context.Background(), opts)
	assert.Equal(t, *groups[0].MemberCount, int(0))
	assert.Equal(t, *groups[0].ChannelMemberCount, int(0))

	_, appErr = th.App.UpsertGroupMember(group2.Id, th.BasicUser.Id)
	assert.Nil(t, appErr)

	groups, _, _ = th.SystemAdminClient.GetGroups(context.Background(), opts)
	assert.NotNil(t, groups[0].MemberCount)
	assert.Equal(t, *groups[0].ChannelMemberCount, int(1))

	opts.IncludeChannelMemberCount = ""
	opts.IncludeTimezones = false
	opts.Q = ""
	opts.IncludeMemberCount = false

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomGroups = false
	})

	// Specify custom groups source when feature is disabled
	opts.Source = model.GroupSourceCustom
	_, response, err := th.Client.GetGroups(context.Background(), opts)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	// Specify ldap groups source when custom groups feature is disabled
	opts.Source = model.GroupSourceLdap
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Source, model.GroupSourceLdap)

	// don't include source and should only get ldap groups in response
	opts.Source = ""
	groups, _, err = th.Client.GetGroups(context.Background(), opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Source, model.GroupSourceLdap)
}

func TestGetGroupsByUserId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group1, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, appErr)

	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)
	user1.Password = "test-password-1"
	_, appErr = th.App.UpsertGroupMember(group1.Id, user1.Id)
	assert.Nil(t, appErr)

	id = model.NewId()
	group2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
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
		DisplayName: "dn-foo_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewPointer(model.NewId()),
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

	t.Run("Non admins are not allowed to get members for LDAP groups", func(t *testing.T) {
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

	// 1. Test with custom source
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewPointer("name" + id),
		Source:      model.GroupSourceCustom,
		Description: "description_" + id,
	})
	assert.Nil(t, err)

	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

	user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user2", Password: "test-password-2", Username: "test-user-2", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

	members := &model.GroupModifyMembers{
		UserIds: []string{user1.Id, user2.Id},
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	//Empty group members returns bad request
	_, resp, nullErr := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, nil)
	require.Error(t, nullErr)
	CheckBadRequestStatus(t, resp)

	groupMembers, response, upsertErr := th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, members)
	require.NoError(t, upsertErr)
	CheckOKStatus(t, response)

	assert.Len(t, groupMembers, 2)

	count, countErr := th.App.GetGroupMemberCount(group.Id, nil)
	assert.Nil(t, countErr)

	assert.Equal(t, count, int64(2))

	// 2. Test invalid group ID
	_, response, upsertErr = th.Client.UpsertGroupMembers(context.Background(), "abc123", members)
	require.Error(t, upsertErr)
	CheckBadRequestStatus(t, response)

	// 3. Test invalid user ID
	invalidMembers := &model.GroupModifyMembers{
		UserIds: []string{"abc123"},
	}

	_, response, upsertErr = th.SystemAdminClient.UpsertGroupMembers(context.Background(), group.Id, invalidMembers)
	require.Error(t, upsertErr)
	CheckInternalErrorStatus(t, response)

	// 4. Test with ldap source
	ldapId := model.NewId()
	ldapGroup, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + ldapId,
		Name:        model.NewPointer("name" + ldapId),
		Source:      model.GroupSourceLdap,
		Description: "description_" + ldapId,
		RemoteId:    model.NewPointer(model.NewId()),
	})
	assert.Nil(t, err)

	_, response, upsertErr = th.SystemAdminClient.UpsertGroupMembers(context.Background(), ldapGroup.Id, members)

	require.Error(t, upsertErr)
	CheckBadRequestStatus(t, response)
}

func TestDeleteMembersFromGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// 1. Test with custom source
	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

	user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user2", Password: "test-password-2", Username: "test-user-2", Roles: model.SystemUserRoleId})
	assert.Nil(t, appErr)

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
	assert.Nil(t, err)

	members := &model.GroupModifyMembers{
		UserIds: []string{user1.Id},
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	_, resp, nullErr := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, nil)
	require.Error(t, nullErr)
	CheckBadRequestStatus(t, resp)

	groupMembers, response, deleteErr := th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, members)
	require.NoError(t, deleteErr)
	CheckOKStatus(t, response)

	assert.Len(t, groupMembers, 1)
	assert.Equal(t, groupMembers[0].UserId, user1.Id)

	users, usersErr := th.App.GetGroupMemberUsers(group.Id)
	assert.Nil(t, usersErr)

	assert.Len(t, users, 1)
	assert.Equal(t, users[0].Id, user2.Id)

	// 2. Test invalid group ID
	_, response, deleteErr = th.Client.DeleteGroupMembers(context.Background(), "abc123", members)
	require.Error(t, deleteErr)
	CheckBadRequestStatus(t, response)

	// 3. Test invalid user ID
	invalidMembers := &model.GroupModifyMembers{
		UserIds: []string{"abc123"},
	}

	_, response, deleteErr = th.SystemAdminClient.DeleteGroupMembers(context.Background(), group.Id, invalidMembers)
	require.Error(t, deleteErr)
	CheckInternalErrorStatus(t, response)

	// 4. Test with ldap source
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
	assert.Nil(t, err)

	_, response, deleteErr = th.SystemAdminClient.DeleteGroupMembers(context.Background(), ldapGroup.Id, members)

	require.Error(t, deleteErr)
	CheckBadRequestStatus(t, response)
}
