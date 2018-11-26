// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroup(g.Id, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	group, response := th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNoError(t, response)

	assert.Equal(t, g.DisplayName, group.DisplayName)
	assert.Equal(t, g.Name, group.Name)
	assert.Equal(t, g.Type, group.Type)
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
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	updateFmt := "%s_updated"

	newName := fmt.Sprintf(updateFmt, g.Name)
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

	th.App.SetLicense(model.NewTestLicense("ldap"))

	group2, response := th.SystemAdminClient.PatchGroup(g.Id, gp)
	CheckOKStatus(t, response)

	group, response := th.SystemAdminClient.GetGroup(g.Id, "")
	CheckNoError(t, response)

	assert.Equal(t, *gp.DisplayName, group.DisplayName)
	assert.Equal(t, *gp.DisplayName, group2.DisplayName)
	assert.Equal(t, *gp.Name, group.Name)
	assert.Equal(t, *gp.Name, group2.Name)
	assert.Equal(t, *gp.Description, group.Description)
	assert.Equal(t, *gp.Description, group2.Description)

	assert.Equal(t, group2.UpdateAt, group.UpdateAt)

	assert.Equal(t, g.Type, group.Type)
	assert.Equal(t, g.Type, group2.Type)
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
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	_, response := th.Client.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
}

func TestLinkGroupChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	_, response := th.Client.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)
}

func TestUnlinkGroupTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	th.App.SetLicense(model.NewTestLicense("ldap"))

	_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.SetLicense(nil)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	CheckNotImplementedStatus(t, response)

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
}

func TestUnlinkGroupChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	th.App.SetLicense(model.NewTestLicense("ldap"))

	_, response := th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	th.App.SetLicense(nil)

	response = th.Client.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	CheckNotImplementedStatus(t, response)

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	response = th.SystemAdminClient.UnlinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.Equal(t, http.StatusNoContent, response.StatusCode)
}

func TestGetGroupTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam, "")
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicTeam.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)
	assert.Equal(t, *patch.CanLeave, groupSyncable.CanLeave)

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
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	g, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, err)

	_, response := th.Client.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap"))

	patch := &model.GroupSyncablePatch{
		CanLeave: model.NewBool(true),
		AutoAdd:  model.NewBool(true),
	}

	_, response = th.SystemAdminClient.LinkGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, patch)
	assert.Equal(t, http.StatusCreated, response.StatusCode)

	groupSyncable, response := th.SystemAdminClient.GetGroupSyncable(g.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel, "")
	CheckOKStatus(t, response)
	assert.NotNil(t, groupSyncable)

	assert.Equal(t, g.Id, groupSyncable.GroupId)
	assert.Equal(t, th.BasicChannel.Id, groupSyncable.SyncableId)
	assert.Equal(t, *patch.AutoAdd, groupSyncable.AutoAdd)
	assert.Equal(t, *patch.CanLeave, groupSyncable.CanLeave)

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

func TestGetGroupTeams(t *testing.T)     {}
func TestGetGroupChannels(t *testing.T)  {}
func TestPatchGroupTeam(t *testing.T)    {}
func TestPatchGroupChannel(t *testing.T) {}
