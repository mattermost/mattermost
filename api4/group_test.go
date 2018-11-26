// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
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

func TestPatchGroup(t *testing.T) {}

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
