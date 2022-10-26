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

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGetGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroup(g.Id, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroup(g.Id, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	group, _, err := th.SystemAdminClient.GetGroup(g.Id, "")
	require.NoError(t, err)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Description, group.Description)
	assert.Equal(t, g.RemoteId, group.RemoteId)
	assert.Equal(t, g.CreateAt, group.CreateAt)
	assert.Equal(t, g.UpdateAt, group.UpdateAt)
	assert.Equal(t, g.DeleteAt, group.DeleteAt)

	_, response, err = th.SystemAdminClient.GetGroup(model.NewId(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroup("12345", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.GetGroup(group.Id, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}
func TestCreateGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g := &model.Group{
		DisplayName:    "dn_" + id,
		Name:           model.NewString("name" + id),
		Source:         model.GroupSourceCustom,
		Description:    "description_" + id,
		AllowReference: true,
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "ldap"))

	group, _, err := th.SystemAdminClient.CreateGroup(g)
	require.NoError(t, err)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Description, group.Description)
	assert.Equal(t, g.RemoteId, group.RemoteId)

	gbroken := &model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      "rrrr",
		Description: "description_" + id,
	}

	_, response, err := th.SystemAdminClient.CreateGroup(gbroken)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	validGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewString("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}

	th.RemovePermissionFromRole(model.PermissionCreateCustomGroup.Id, model.SystemAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionCreateCustomGroup.Id, model.SystemUserRoleId)
	defer th.AddPermissionToRole(model.PermissionCreateCustomGroup.Id, model.SystemUserRoleId)
	_, response, err = th.SystemAdminClient.CreateGroup(validGroup)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.AddPermissionToRole(model.PermissionCreateCustomGroup.Id, model.SystemAdminRoleId)
	_, response, err = th.SystemAdminClient.CreateGroup(validGroup)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	usernameGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           &th.BasicUser.Username,
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(usernameGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	unReferenceableCustomGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewString("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: false,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(unReferenceableCustomGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)
	unReferenceableCustomGroup.AllowReference = true
	_, response, err = th.SystemAdminClient.CreateGroup(unReferenceableCustomGroup)
	require.NoError(t, err)
	CheckCreatedStatus(t, response)

	customGroupWithRemoteID := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewString("name" + model.NewId()),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
		RemoteId:       model.NewString(model.NewId()),
	}
	_, response, err = th.SystemAdminClient.CreateGroup(customGroupWithRemoteID)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	reservedNameGroup := &model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewString("here"),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	}
	_, response, err = th.SystemAdminClient.CreateGroup(reservedNameGroup)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.CreateGroup(g)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestDeleteGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	_, response, err := th.Client.DeleteGroup(g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.AddPermissionToRole(model.PermissionDeleteCustomGroup.Id, model.SystemUserRoleId)
	_, response, err = th.Client.DeleteGroup(g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.Client.DeleteGroup(g.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.Client.DeleteGroup("wertyuijhbgvfcde")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	validGroup, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + model.NewId(),
		Name:        model.NewString("name" + model.NewId()),
		Source:      model.GroupSourceCustom,
	})
	assert.Nil(t, appErr)

	_, response, err = th.Client.DeleteGroup(validGroup.Id)
	require.NoError(t, err)
	CheckOKStatus(t, response)
}
func TestPatchGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	g2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName:    "dn_" + model.NewId(),
		Name:           model.NewString("name" + model.NewId()),
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

	_, response, err := th.Client.PatchGroup(g.Id, gp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroup(g.Id, gp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "ldap"))

	group2, response, err := th.SystemAdminClient.PatchGroup(g.Id, gp)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	group, _, err := th.SystemAdminClient.GetGroup(g.Id, "")
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

	_, response, err = th.SystemAdminClient.PatchGroup(model.NewId(), gp)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroup(g2.Id, &model.GroupPatch{
		Name:           model.NewString(model.NewId()),
		DisplayName:    model.NewString("foo"),
		AllowReference: model.NewBool(false),
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	// ensure that omitting the AllowReference field from the patch doesn't patch it to false
	patchedG2, response, err := th.SystemAdminClient.PatchGroup(g2.Id, &model.GroupPatch{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewString("foo"),
	})
	require.NoError(t, err)
	CheckOKStatus(t, response)
	require.Equal(t, true, patchedG2.AllowReference)

	_, response, err = th.SystemAdminClient.PatchGroup(g2.Id, &model.GroupPatch{
		Name: model.NewString("here"),
	})
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.PatchGroup(group.Id, gp)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestLinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response, err := th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, _, err = th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Error(t, err)

	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	groupTeam, response, _ := th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupTeam)

	gid := model.NewId()
	g2, app2Err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + gid,
		Name:        model.NewString("name" + gid),
		Source:      model.GroupSourceCustom,
		Description: "description_" + gid,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, app2Err)

	_, response, err = th.Client.LinkGroupSyncable(g2.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)
}

func TestLinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response, err := th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupTeam, response, _ := th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.Equal(t, th.BasicChannel.TeamId, groupTeam.TeamID)
	assert.NotNil(t, groupTeam)

	_, err = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	_, _, err = th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Error(t, err)

	gid := model.NewId()
	g2, app2Err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + gid,
		Name:        model.NewString("name" + gid),
		Source:      model.GroupSourceCustom,
		Description: "description_" + gid,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, app2Err)

	_, response, err = th.Client.LinkGroupSyncable(g2.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)
}

func TestUnlinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	response, err := th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	response, err = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, err = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	assert.Error(t, err)
	time.Sleep(2 * time.Second) // A hack to let "go c.App.SyncRolesAndMembership" finish before moving on.
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	response, err = th.Client.Logout()
	require.NoError(t, err)
	CheckOKStatus(t, response)
	_, response, err = th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	response, err = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	CheckOKStatus(t, response)
}

func TestUnlinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	response, err := th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	response, err = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, err = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	_, err = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.Error(t, err)

	_, err = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "channel_admin channel_user")
	require.NoError(t, err)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	_, err = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.NoError(t, err)
}

func TestGetGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response, _ = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response, err := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable("asdfasdfe3", th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, "asdfasdfe3", model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, response, err := th.Client.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response, _ = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response, err := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable("asdfasdfe3", th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, "asdfasdfe3", model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupTeams(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	for i := 0; i < 10; i++ {
		team := th.CreateTeam()
		_, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, team.Id, model.GroupSyncableTypeTeam, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response, err := th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ = th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response, err := th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	require.NoError(t, err)
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	for i := 0; i < 10; i++ {
		channel := th.CreatePublicChannel()
		_, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, channel.Id, model.GroupSyncableTypeChannel, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response, err := th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response, _ = th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response, _ := th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	_, response, _ = th.Client.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	_, response, err := th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewBool(false)
	groupSyncable, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, model.GroupSyncableTypeTeam, groupSyncable.Type)

	patch.AutoAdd = model.NewBool(true)
	_, response, _ = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckOKStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable("abc", th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, "abc", model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response, _ := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	role, appErr := th.App.GetRoleByName(context.Background(), "channel_user")
	require.Nil(t, appErr)
	originalPermissions := role.Permissions
	_, appErr = th.App.PatchRole(role, &model.RolePatch{Permissions: &[]string{}})
	require.Nil(t, appErr)

	_, response, _ = th.Client.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	_, appErr = th.App.PatchRole(role, &model.RolePatch{Permissions: &originalPermissions})
	require.Nil(t, appErr)

	th.App.Srv().SetLicense(nil)

	_, response, err := th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewBool(false)
	groupSyncable, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, th.BasicChannel.TeamId, groupSyncable.TeamID)
	assert.Equal(t, model.GroupSyncableTypeChannel, groupSyncable.Type)

	patch.AutoAdd = model.NewBool(true)
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.NoError(t, err)
	CheckOKStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckNotFoundStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable("abc", th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, "abc", model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response, err = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupsByChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
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
		_, _, response, err := client.GetGroupsByChannel("asdfasdf", opts)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	th.App.Srv().SetLicense(nil)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		require.Error(t, err)
		if client == th.SystemAdminClient {
			CheckNotImplementedStatus(t, response)
		} else {
			CheckForbiddenStatus(t, response)
		}
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	privateChannel := th.CreateChannelWithClient(th.SystemAdminClient, model.ChannelTypePrivate)

	_, _, response, err := th.Client.GetGroupsByChannel(privateChannel.Id, opts)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		var groups []*model.GroupWithSchemeAdmin
		groups, _, _, err = client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		assert.NoError(t, err)
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(false)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		assert.NoError(t, err)
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

		groups, _, _, err = client.GetGroupsByChannel(model.NewId(), opts)
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
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
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

	_, response, err := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam("asdfasdf", opts)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	th.App.Srv().SetLicense(nil)

	_, response, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groups, _, err := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	assert.NoError(t, err)

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewBool(false)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.False(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, appErr = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, appErr)

	// ensure that SchemeAdmin field is updated
	groups, _, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	assert.NoError(t, err)

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewBool(true)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.True(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	groups, _, err = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(model.NewId(), opts)
	assert.NoError(t, err)
	assert.Empty(t, groups)
}

func TestGetGroupsByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
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
		_, _, response, err := client.GetGroupsByTeam("asdfasdf", opts)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	th.App.Srv().RemoveLicense()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response, err := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		require.Error(t, err)
		if client == th.SystemAdminClient {
			CheckNotImplementedStatus(t, response)
		} else {
			CheckForbiddenStatus(t, response)
		}
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		assert.NoError(t, err)
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(false)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, _, err := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		assert.NoError(t, err)
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

		groups, _, _, err = client.GetGroupsByTeam(model.NewId(), opts)
		assert.NoError(t, err)
		assert.Empty(t, groups)
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
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)
	start := group.UpdateAt - 1

	id2 := model.NewId()
	group2, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id2,
		Name:        model.NewString("name" + id2),
		Source:      model.GroupSourceCustom,
		Description: "description_" + id2,
		RemoteId:    model.NewString(model.NewId()),
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

	_, _, err := th.SystemAdminClient.GetGroups(opts)
	require.NoError(t, err)

	_, err = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.NoError(t, err)

	opts.NotAssociatedToChannel = th.BasicChannel.Id

	_, err = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "channel_user channel_admin")
	require.NoError(t, err)

	groups, _, err := th.SystemAdminClient.GetGroups(opts)
	assert.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group, th.Group}, groups)
	assert.Nil(t, groups[0].MemberCount)

	opts.IncludeMemberCount = true
	groups, _, _ = th.SystemAdminClient.GetGroups(opts)
	assert.NotNil(t, groups[0].MemberCount)
	opts.IncludeMemberCount = false

	opts.Q = "-fOo"
	groups, _, _ = th.SystemAdminClient.GetGroups(opts)
	assert.Len(t, groups, 1)
	opts.Q = ""

	_, err = th.SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.NoError(t, err)

	opts.NotAssociatedToTeam = th.BasicTeam.Id

	_, err = th.SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "team_user team_admin")
	require.NoError(t, err)

	_, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)

	// test "since", should only return group created in this test, not th.Group
	opts.Since = start
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	// test correct group returned
	assert.Equal(t, groups[0].Id, group.Id)

	// delete group, should still return
	th.App.DeleteGroup(group.Id)
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group.Id)

	// test with current since value, return none
	opts.Since = model.GetMillis()
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	assert.Empty(t, groups)

	// make sure delete group is not returned without Since
	opts.Since = 0
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	//'Normal getGroups should not return delete groups
	assert.Len(t, groups, 1)
	// make sure it returned th.Group,not group
	assert.Equal(t, groups[0].Id, th.Group.Id)

	opts.Source = model.GroupSourceCustom
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group2.Id)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomGroups = false
	})

	// Specify custom groups source when feature is disabled
	opts.Source = model.GroupSourceCustom
	_, response, err := th.Client.GetGroups(opts)
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	// Specify ldap groups source when custom groups feature is disabled
	opts.Source = model.GroupSourceLdap
	groups, _, err = th.Client.GetGroups(opts)
	assert.NoError(t, err)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Source, model.GroupSourceLdap)

	// don't include source and should only get ldap groups in response
	opts.Source = ""
	groups, _, err = th.Client.GetGroups(opts)
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
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
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
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	_, appErr = th.App.UpsertGroupMember(group2.Id, user1.Id)
	assert.Nil(t, appErr)

	th.App.Srv().SetLicense(nil)
	_, response, err := th.SystemAdminClient.GetGroupsByUserId(user1.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))
	_, response, err = th.SystemAdminClient.GetGroupsByUserId("")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	_, response, err = th.SystemAdminClient.GetGroupsByUserId("notvaliduserid")
	require.Error(t, err)
	CheckBadRequestStatus(t, response)

	groups, _, err := th.SystemAdminClient.GetGroupsByUserId(user1.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)

	// test permissions
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	_, response, err = th.Client.GetGroupsByUserId(user1.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, response)

	th.Client.Logout()
	th.Client.Login(user1.Email, user1.Password)
	groups, _, err = th.Client.GetGroupsByUserId(user1.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)

}

func TestGetGroupStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, appErr := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, appErr)

	t.Run("Requires ldap license", func(t *testing.T) {
		_, response, err := th.SystemAdminClient.GetGroupStats(group.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Requires manage system permission to access group stats", func(t *testing.T) {
		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		_, response, err := th.Client.GetGroupStats(group.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Returns stats for a group with no members", func(t *testing.T) {
		stats, _, err := th.SystemAdminClient.GetGroupStats(group.Id)
		require.NoError(t, err)
		assert.Equal(t, stats.GroupID, group.Id)
		assert.Equal(t, stats.TotalMemberCount, int64(0))
	})

	user1, err := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	assert.Nil(t, err)
	_, appErr = th.App.UpsertGroupMember(group.Id, user1.Id)
	assert.Nil(t, appErr)

	t.Run("Returns stats for a group with members", func(t *testing.T) {
		stats, _, _ := th.SystemAdminClient.GetGroupStats(group.Id)
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
			Name:        model.NewString("name" + id),
			Source:      model.GroupSourceLdap,
			Description: "description_" + id,
			RemoteId:    model.NewString(model.NewId()),
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
		GroupConstrained: model.NewBool(true),
	}
	channel, appErr := th.App.CreateChannel(th.Context, channel, false)
	require.Nil(t, appErr)

	// normal result of groups are returned if the team is not group-constrained
	apiGroups, _, err := th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
	require.NoError(t, err)
	require.Contains(t, apiGroups, groups[0])
	require.Contains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	team.GroupConstrained = model.NewBool(true)
	team, appErr = th.App.UpdateTeam(team)
	require.Nil(t, appErr)

	// team is group-constrained but has no associated groups
	apiGroups, _, err = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.NoError(t, err)
	require.Len(t, apiGroups, 0)

	for _, group := range []*model.Group{groups[0], groups[2], groups[3]} {
		_, appErr = th.App.UpsertGroupSyncable(model.NewGroupTeam(group.Id, team.Id, false))
		require.Nil(t, appErr)
	}

	// set of the teams groups are returned
	apiGroups, _, err = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.NoError(t, err)
	require.Contains(t, apiGroups, groups[0])
	require.NotContains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	// paged results function as expected
	apiGroups, _, err = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 0}})
	require.NoError(t, err)
	require.Len(t, apiGroups, 2)
	require.Equal(t, apiGroups[0].Id, groups[0].Id)
	require.Equal(t, apiGroups[1].Id, groups[2].Id)

	apiGroups, _, err = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 1}})
	require.NoError(t, err)
	require.Len(t, apiGroups, 1)
	require.Equal(t, apiGroups[0].Id, groups[3].Id)

	_, appErr = th.App.UpsertGroupSyncable(model.NewGroupChannel(groups[0].Id, channel.Id, false))
	require.Nil(t, appErr)

	// as usual it doesn't return groups already associated to the channel
	apiGroups, _, err = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
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
		Name:        model.NewString("name" + id),
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

	groupMembers, response, upsertErr := th.SystemAdminClient.UpsertGroupMembers(group.Id, members)
	require.NoError(t, upsertErr)
	CheckOKStatus(t, response)

	assert.Len(t, groupMembers, 2)

	count, countErr := th.App.GetGroupMemberCount(group.Id, nil)
	assert.Nil(t, countErr)

	assert.Equal(t, count, int64(2))

	// 2. Test invalid group ID
	_, response, upsertErr = th.Client.UpsertGroupMembers("abc123", members)
	require.Error(t, upsertErr)
	CheckBadRequestStatus(t, response)

	// 3. Test invalid user ID
	invalidMembers := &model.GroupModifyMembers{
		UserIds: []string{"abc123"},
	}

	_, response, upsertErr = th.SystemAdminClient.UpsertGroupMembers(group.Id, invalidMembers)
	require.Error(t, upsertErr)
	CheckInternalErrorStatus(t, response)

	// 4. Test with ldap source
	ldapId := model.NewId()
	ldapGroup, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + ldapId,
		Name:        model.NewString("name" + ldapId),
		Source:      model.GroupSourceLdap,
		Description: "description_" + ldapId,
		RemoteId:    model.NewString(model.NewId()),
	})
	assert.Nil(t, err)

	_, response, upsertErr = th.SystemAdminClient.UpsertGroupMembers(ldapGroup.Id, members)

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
		Name:        model.NewString("name" + id),
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

	groupMembers, response, deleteErr := th.SystemAdminClient.DeleteGroupMembers(group.Id, members)
	require.NoError(t, deleteErr)
	CheckOKStatus(t, response)

	assert.Len(t, groupMembers, 1)
	assert.Equal(t, groupMembers[0].UserId, user1.Id)

	users, usersErr := th.App.GetGroupMemberUsers(group.Id)
	assert.Nil(t, usersErr)

	assert.Len(t, users, 1)
	assert.Equal(t, users[0].Id, user2.Id)

	// 2. Test invalid group ID
	_, response, deleteErr = th.Client.DeleteGroupMembers("abc123", members)
	require.Error(t, deleteErr)
	CheckBadRequestStatus(t, response)

	// 3. Test invalid user ID
	invalidMembers := &model.GroupModifyMembers{
		UserIds: []string{"abc123"},
	}

	_, response, deleteErr = th.SystemAdminClient.DeleteGroupMembers(group.Id, invalidMembers)
	require.Error(t, deleteErr)
	CheckInternalErrorStatus(t, response)

	// 4. Test with ldap source
	ldapId := model.NewId()
	g1 := &model.Group{
		DisplayName: "dn_" + ldapId,
		Name:        model.NewString("name" + ldapId),
		Source:      model.GroupSourceLdap,
		Description: "description_" + ldapId,
		RemoteId:    model.NewString(model.NewId()),
	}
	ldapGroup, err := th.App.CreateGroupWithUserIds(&model.GroupWithUserIds{
		Group:   *g1,
		UserIds: []string{user1.Id, user2.Id},
	})
	assert.Nil(t, err)

	_, response, deleteErr = th.SystemAdminClient.DeleteGroupMembers(ldapGroup.Id, members)

	require.Error(t, deleteErr)
	CheckBadRequestStatus(t, response)
}
