// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetRole(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system create_public_channel"},
		SchemeManaged: true,
	}

	res1 := <-th.App.Srv.Store.Role().Save(role)
	assert.Nil(t, res1.Err)
	role = res1.Data.(*model.Role)
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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	role := &model.Role{
		Name:          model.NewId(),
		DisplayName:   model.NewId(),
		Description:   model.NewId(),
		Permissions:   []string{"manage_system create_public_channel"},
		SchemeManaged: true,
	}

	res1 := <-th.App.Srv.Store.Role().Save(role)
	assert.Nil(t, res1.Err)
	role = res1.Data.(*model.Role)
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

}

func TestPatchRole(t *testing.T) {

}
