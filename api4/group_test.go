// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroup(g.Id, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	group, response := th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNoError(t, response)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Source, group.Source)
	assert.Equal(t, g.Description, group.Description)
	assert.Equal(t, g.RemoteId, group.RemoteId)
	assert.Equal(t, g.CreateAt, group.CreateAt)
	assert.Equal(t, g.UpdateAt, group.UpdateAt)
	assert.Equal(t, g.DeleteAt, group.DeleteAt)

	_, response = th.SystemAdminClient.GetGroup(model.NewId(), "")
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.GetGroup("12345", "")
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.GetGroup(group.Id, "")
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroup(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	updateFmt := "%s_updated"

	newName := fmt.Sprintf(updateFmt, *g.Name)
	newDisplayName := fmt.Sprintf(updateFmt, g.DisplayName)
	newDescription := fmt.Sprintf(updateFmt, g.Description)

	gp := &model.GroupPatch{
		Name:        &newName,
		DisplayName: &newDisplayName,
		Description: &newDescription,
	}

	_, response := th.Client.PatchGroup(g.Id, gp)
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroup(g.Id, gp)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	group2, response := th.SystemAdminClient.PatchGroup(g.Id, gp)
	CheckOKStatus(t, response)

	group, response := th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNoError(t, response)

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

	_, response = th.SystemAdminClient.PatchGroup(model.NewId(), gp)
	CheckNotFoundStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.PatchGroup(group.Id, gp)
	CheckUnauthorizedStatus(t, response)
}

func TestLinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response := th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response = th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.NotNil(t, response.Error)

	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	groupTeam, response := th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupTeam)
}

func TestLinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response := th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupTeam, response := th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupTeam)

	_, response = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.Nil(t, response.Error)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	_, response = th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.NotNil(t, response.Error)
}

func TestUnlinkGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	CheckNotImplementedStatus(t, response)

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	assert.NotNil(t, response.Error)
	time.Sleep(2 * time.Second) // A hack to let "go c.App.SyncRolesAndMembership" finish before moving on.
	th.UpdateUserToTeamAdmin(th.BasicUser, th.BasicTeam)
	ok, response := th.Client.Logout()
	assert.True(t, ok)
	CheckOKStatus(t, response)
	_, response = th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	CheckOKStatus(t, response)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	CheckOKStatus(t, response)
}

func TestUnlinkGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	CheckNotImplementedStatus(t, response)

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.Nil(t, response.Error)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.NotNil(t, response.Error)

	_, response = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "channel_admin channel_user")
	require.Nil(t, response.Error)
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.Nil(t, response.Error)
}

func TestGetGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response = th.SystemAdminClient.GetGroupSyncable(model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeTeam, "")
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable("asdfasdfe3", th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckBadRequestStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, "asdfasdfe3", model.GroupSyncableTypeTeam, "")
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)

	_, response = th.SystemAdminClient.GetGroupSyncable(model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeChannel, "")
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable("asdfasdfe3", th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckBadRequestStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, "asdfasdfe3", model.GroupSyncableTypeChannel, "")
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupTeams(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	for i := 0; i < 10; i++ {
		team := th.CreateTeam()
		_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, team.Id, model.GroupSyncableTypeTeam, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response := th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response = th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response := th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeTeam, "")
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	for i := 0; i < 10; i++ {
		channel := th.CreatePublicChannel()
		_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, channel.Id, model.GroupSyncableTypeChannel, patch)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
	}

	th.App.Srv().SetLicense(nil)

	_, response := th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response = th.Client.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	groupSyncables, response := th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	CheckOKStatus(t, response)

	assert.Len(t, groupSyncables, 10)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.GetGroupSyncables(g.Id, model.GroupSyncableTypeChannel, "")
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	_, response = th.Client.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	th.App.Srv().SetLicense(nil)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewBool(false)
	groupSyncable, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, model.GroupSyncableTypeTeam, groupSyncable.Type)

	patch.AutoAdd = model.NewBool(true)
	groupSyncable, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckOKStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(model.NewId(), th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeTeam, patch)
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable("abc", th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckBadRequestStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, "abc", model.GroupSyncableTypeTeam, patch)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckUnauthorizedStatus(t, response)
}

func TestPatchGroupChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		AutoAdd: model.NewBool(true),
	}

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groupSyncable, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
	assert.NotNil(t, groupSyncable)
	assert.True(t, groupSyncable.AutoAdd)

	role, err := th.App.GetRoleByName("channel_user")
	require.Nil(t, err)
	originalPermissions := role.Permissions
	_, err = th.App.PatchRole(role, &model.RolePatch{Permissions: &[]string{}})
	require.Nil(t, err)

	_, response = th.Client.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusForbidden, response.StatusCode)

	_, err = th.App.PatchRole(role, &model.RolePatch{Permissions: &originalPermissions})
	require.Nil(t, err)

	th.App.Srv().SetLicense(nil)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	patch.AutoAdd = model.NewBool(false)
	groupSyncable, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckOKStatus(t, response)
	assert.False(t, groupSyncable.AutoAdd)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, model.GroupSyncableTypeChannel, groupSyncable.Type)

	patch.AutoAdd = model.NewBool(true)
	groupSyncable, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckOKStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(model.NewId(), th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, model.NewId(), model.GroupSyncableTypeChannel, patch)
	CheckNotFoundStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable("abc", th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckBadRequestStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, "abc", model.GroupSyncableTypeChannel, patch)
	CheckBadRequestStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.PatchGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckUnauthorizedStatus(t, response)
}

func TestGetGroupsByChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	groupSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	assert.Nil(t, err)

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response := client.GetGroupsByChannel("asdfasdf", opts)
		CheckBadRequestStatus(t, response)
	})

	th.App.Srv().SetLicense(nil)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response := client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		CheckNotImplementedStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	privateChannel := th.CreateChannelWithClient(th.SystemAdminClient, model.CHANNEL_PRIVATE)

	_, _, response := th.Client.GetGroupsByChannel(privateChannel.Id, opts)
	CheckForbiddenStatus(t, response)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, response := client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		assert.Nil(t, response.Error)
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(false)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, response := client.GetGroupsByChannel(th.BasicChannel.Id, opts)
		assert.Nil(t, response.Error)
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

		groups, _, response = client.GetGroupsByChannel(model.NewId(), opts)
		assert.Equal(t, "app.channel.get.existing.app_error", response.Error.Id)
		assert.Empty(t, groups)
	})
}

func TestGetGroupsAssociatedToChannelsByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	groupSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	assert.Nil(t, err)

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	_, response := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam("asdfasdf", opts)
	CheckBadRequestStatus(t, response)

	th.App.Srv().SetLicense(nil)

	_, response = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	groups, response := th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	assert.Nil(t, response.Error)

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewBool(false)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.False(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, err)

	// ensure that SchemeAdmin field is updated
	groups, response = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(th.BasicTeam.Id, opts)
	assert.Nil(t, response.Error)

	assert.Equal(t, map[string][]*model.GroupWithSchemeAdmin{
		th.BasicChannel.Id: {
			{Group: *group, SchemeAdmin: model.NewBool(true)},
		},
	}, groups)

	require.NotNil(t, groups[th.BasicChannel.Id][0].SchemeAdmin)
	require.True(t, *groups[th.BasicChannel.Id][0].SchemeAdmin)

	groups, response = th.SystemAdminClient.GetGroupsAssociatedToChannelsByTeam(model.NewId(), opts)
	assert.Nil(t, response.Error)
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
		RemoteId:    model.NewId(),
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

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response := client.GetGroupsByTeam("asdfasdf", opts)
		CheckBadRequestStatus(t, response)
	})

	th.App.Srv().SetLicense(nil)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, _, response := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		CheckNotImplementedStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, response := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		assert.Nil(t, response.Error)
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(false)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.False(t, *groups[0].SchemeAdmin)
	})

	// set syncable to true
	groupSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(groupSyncable)
	require.Nil(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		groups, _, response := client.GetGroupsByTeam(th.BasicTeam.Id, opts)
		assert.Nil(t, response.Error)
		// ensure that SchemeAdmin field is updated
		assert.ElementsMatch(t, []*model.GroupWithSchemeAdmin{{Group: *group, SchemeAdmin: model.NewBool(true)}}, groups)
		require.NotNil(t, groups[0].SchemeAdmin)
		require.True(t, *groups[0].SchemeAdmin)

		groups, _, response = client.GetGroupsByTeam(model.NewId(), opts)
		assert.Nil(t, response.Error)
		assert.Empty(t, groups)
	})
}

func TestGetGroups(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// make sure "createdDate" for next group is after one created in InitBasic()
	time.Sleep(2 * time.Millisecond)
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)
	start := group.UpdateAt - 1

	opts := model.GroupSearchOpts{
		PageOpts: &model.PageOpts{
			Page:    0,
			PerPage: 60,
		},
	}

	th.App.Srv().SetLicense(nil)

	_, response := th.SystemAdminClient.GetGroups(opts)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	_, response = th.SystemAdminClient.GetGroups(opts)
	require.Nil(t, response.Error)

	_, response = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "")
	require.Nil(t, response.Error)

	opts.NotAssociatedToChannel = th.BasicChannel.Id

	_, response = th.SystemAdminClient.UpdateChannelRoles(th.BasicChannel.Id, th.BasicUser.Id, "channel_user channel_admin")
	require.Nil(t, response.Error)

	groups, response := th.SystemAdminClient.GetGroups(opts)
	assert.Nil(t, response.Error)
	assert.ElementsMatch(t, []*model.Group{group, th.Group}, groups)
	assert.Nil(t, groups[0].MemberCount)

	opts.IncludeMemberCount = true
	groups, _ = th.SystemAdminClient.GetGroups(opts)
	assert.NotNil(t, groups[0].MemberCount)
	opts.IncludeMemberCount = false

	opts.Q = "-fOo"
	groups, _ = th.SystemAdminClient.GetGroups(opts)
	assert.Len(t, groups, 1)
	opts.Q = ""

	_, response = th.SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "")
	require.Nil(t, response.Error)

	opts.NotAssociatedToTeam = th.BasicTeam.Id

	_, response = th.SystemAdminClient.UpdateTeamMemberRoles(th.BasicTeam.Id, th.BasicUser.Id, "team_user team_admin")
	require.Nil(t, response.Error)

	_, response = th.Client.GetGroups(opts)
	assert.Nil(t, response.Error)

	// test "since", should only return group created in this test, not th.Group
	opts.Since = start
	groups, response = th.Client.GetGroups(opts)
	assert.Nil(t, response.Error)
	assert.Len(t, groups, 1)
	// test correct group returned
	assert.Equal(t, groups[0].Id, group.Id)

	// delete group, should still return
	th.App.DeleteGroup(group.Id)
	groups, response = th.Client.GetGroups(opts)
	assert.Nil(t, response.Error)
	assert.Len(t, groups, 1)
	assert.Equal(t, groups[0].Id, group.Id)

	// test with current since value, return none
	opts.Since = model.GetMillis()
	groups, response = th.Client.GetGroups(opts)
	assert.Nil(t, response.Error)
	assert.Empty(t, groups)

	// make sure delete group is not returned without Since
	opts.Since = 0
	groups, response = th.Client.GetGroups(opts)
	assert.Nil(t, response.Error)
	//'Normal getGroups should not return delete groups
	assert.Len(t, groups, 1)
	// make sure it returned th.Group,not group
	assert.Equal(t, groups[0].Id, th.Group.Id)
}

func TestGetGroupsByUserId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group1, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	user1, err := th.App.CreateUser(&model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SYSTEM_USER_ROLE_ID})
	assert.Nil(t, err)
	user1.Password = "test-password-1"
	_, err = th.App.UpsertGroupMember(group1.Id, user1.Id)
	assert.Nil(t, err)

	id = model.NewId()
	group2, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, err = th.App.UpsertGroupMember(group2.Id, user1.Id)
	assert.Nil(t, err)

	th.App.Srv().SetLicense(nil)
	_, response := th.SystemAdminClient.GetGroupsByUserId(user1.Id)
	CheckNotImplementedStatus(t, response)

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))
	_, response = th.SystemAdminClient.GetGroupsByUserId("")
	CheckBadRequestStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupsByUserId("notvaliduserid")
	CheckBadRequestStatus(t, response)

	groups, response := th.SystemAdminClient.GetGroupsByUserId(user1.Id)
	require.Nil(t, response.Error)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)

	// test permissions
	th.Client.Logout()
	th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
	_, response = th.Client.GetGroupsByUserId(user1.Id)
	CheckForbiddenStatus(t, response)

	th.Client.Logout()
	th.Client.Login(user1.Email, user1.Password)
	groups, response = th.Client.GetGroupsByUserId(user1.Id)
	require.Nil(t, response.Error)
	assert.ElementsMatch(t, []*model.Group{group1, group2}, groups)

}

func TestGetGroupStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn-foo_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	var response *model.Response
	var stats *model.GroupStats

	t.Run("Requires ldap license", func(t *testing.T) {
		_, response = th.SystemAdminClient.GetGroupStats(group.Id)
		CheckNotImplementedStatus(t, response)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))

	t.Run("Requires manage system permission to access group stats", func(t *testing.T) {
		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)
		_, response = th.Client.GetGroupStats(group.Id)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Returns stats for a group with no members", func(t *testing.T) {
		stats, _ = th.SystemAdminClient.GetGroupStats(group.Id)
		assert.Equal(t, stats.GroupID, group.Id)
		assert.Equal(t, stats.TotalMemberCount, int64(0))
	})

	user1, err := th.App.CreateUser(&model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SYSTEM_USER_ROLE_ID})
	assert.Nil(t, err)
	_, err = th.App.UpsertGroupMember(group.Id, user1.Id)
	assert.Nil(t, err)

	t.Run("Returns stats for a group with members", func(t *testing.T) {
		stats, _ = th.SystemAdminClient.GetGroupStats(group.Id)
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
			RemoteId:    model.NewId(),
		})
		require.Nil(t, err)
		groups = append(groups, group)
	}

	team := th.CreateTeam()

	id := model.NewId()
	channel := &model.Channel{
		DisplayName:      "dn_" + id,
		Name:             "name" + id,
		Type:             model.CHANNEL_PRIVATE,
		TeamId:           team.Id,
		GroupConstrained: model.NewBool(true),
	}
	channel, err := th.App.CreateChannel(channel, false)
	require.Nil(t, err)

	// normal result of groups are returned if the team is not group-constrained
	apiGroups, response := th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
	require.Nil(t, response.Error)
	require.Contains(t, apiGroups, groups[0])
	require.Contains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	team.GroupConstrained = model.NewBool(true)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)

	// team is group-constrained but has no associated groups
	apiGroups, response = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.Nil(t, response.Error)
	require.Len(t, apiGroups, 0)

	for _, group := range []*model.Group{groups[0], groups[2], groups[3]} {
		_, err = th.App.UpsertGroupSyncable(model.NewGroupTeam(group.Id, team.Id, false))
		require.Nil(t, err)
	}

	// set of the teams groups are returned
	apiGroups, response = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true})
	require.Nil(t, response.Error)
	require.Contains(t, apiGroups, groups[0])
	require.NotContains(t, apiGroups, groups[1])
	require.Contains(t, apiGroups, groups[2])

	// paged results function as expected
	apiGroups, response = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 0}})
	require.Nil(t, response.Error)
	require.Len(t, apiGroups, 2)
	require.Equal(t, apiGroups[0].Id, groups[0].Id)
	require.Equal(t, apiGroups[1].Id, groups[2].Id)

	apiGroups, response = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id, FilterParentTeamPermitted: true, PageOpts: &model.PageOpts{PerPage: 2, Page: 1}})
	require.Nil(t, response.Error)
	require.Len(t, apiGroups, 1)
	require.Equal(t, apiGroups[0].Id, groups[3].Id)

	_, err = th.App.UpsertGroupSyncable(model.NewGroupChannel(groups[0].Id, channel.Id, false))
	require.Nil(t, err)

	// as usual it doesn't return groups already associated to the channel
	apiGroups, response = th.SystemAdminClient.GetGroups(model.GroupSearchOpts{NotAssociatedToChannel: channel.Id})
	require.Nil(t, response.Error)
	require.NotContains(t, apiGroups, groups[0])
	require.Contains(t, apiGroups, groups[2])
}
