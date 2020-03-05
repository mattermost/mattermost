// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestTestLdap(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.SystemAdminClient.TestLdap()
	CheckNotImplementedStatus(t, resp)
	require.NotNil(t, resp.Error)
	require.Equal(t, "api.ldap_groups.license_error", resp.Error.Id)

	th.App.SetLicense(model.NewTestLicense("ldap_groups"))

	_, resp = th.Client.TestLdap()
	CheckForbiddenStatus(t, resp)
	require.NotNil(t, resp.Error)
	require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)

	_, resp = th.SystemAdminClient.TestLdap()
	CheckNotImplementedStatus(t, resp)
	require.NotNil(t, resp.Error)
	require.Equal(t, "ent.ldap.disabled.app_error", resp.Error.Id)
}

func TestSyncLdap(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.SystemAdminClient.SyncLdap()
	CheckNotImplementedStatus(t, resp)
	require.NotNil(t, resp.Error)
	require.Equal(t, "api.ldap_groups.license_error", resp.Error.Id)

	th.App.SetLicense(model.NewTestLicense("ldap_groups"))

	_, resp = th.SystemAdminClient.SyncLdap()
	CheckNoError(t, resp)

	_, resp = th.Client.SyncLdap()
	CheckForbiddenStatus(t, resp)
}

func TestGetLdapGroups(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.Client.GetLdapGroups()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetLdapGroups()
	CheckNotImplementedStatus(t, resp)
}

func TestLinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.Client.LinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.LinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}

func TestUnlinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.Client.UnlinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UnlinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}
