// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
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

	_, response := th.Client.PatchGroup(g.Id, gp, "")
	CheckNotImplementedStatus(t, response)

	_, response = th.SystemAdminClient.PatchGroup(g.Id, gp, "")
	CheckNotImplementedStatus(t, response)

	th.App.SetLicense(model.NewTestLicense("ldap_groups"))

	group2, response := th.SystemAdminClient.PatchGroup(g.Id, gp, "")
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

	_, response = th.SystemAdminClient.PatchGroup(model.NewId(), gp, "")
	CheckNotFoundStatus(t, response)

	th.SystemAdminClient.Logout()
	_, response = th.SystemAdminClient.PatchGroup(group.Id, gp, "")
	CheckUnauthorizedStatus(t, response)
}

func TestLinkGroupTeam(t *testing.T)   {}
func TestGetGroupTeam(t *testing.T)    {}
func TestGetGroupTeams(t *testing.T)   {}
func TestPatchGroupTeam(t *testing.T)  {}
func TestUnlinkGroupTeam(t *testing.T) {}

func TestLinkGroupChannel(t *testing.T)   {}
func TestGetGroupChannel(t *testing.T)    {}
func TestGetGroupTChannel(t *testing.T)   {}
func TestPatchGroupChannel(t *testing.T)  {}
func TestUnlinkGroupChannel(t *testing.T) {}
