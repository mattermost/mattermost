// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestTestLdap(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.TestLdap()
		CheckNotImplementedStatus(t, resp)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.ldap_groups.license_error", resp.Error.Id)
	})
	th.App.Srv().SetLicense(model.NewTestLicense("ldap_groups"))

	_, resp := th.Client.TestLdap()
	CheckForbiddenStatus(t, resp)
	require.NotNil(t, resp.Error)
	require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.TestLdap()
		CheckNotImplementedStatus(t, resp)
		require.NotNil(t, resp.Error)
		require.Equal(t, "ent.ldap.disabled.app_error", resp.Error.Id)
	})
}

func TestSyncLdap(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.TestLdap()
		CheckNotImplementedStatus(t, resp)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.ldap_groups.license_error", resp.Error.Id)
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap_groups"))

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.SyncLdap()
		CheckNoError(t, resp)
	})

	_, resp := th.Client.SyncLdap()
	CheckForbiddenStatus(t, resp)
}

func TestGetLdapGroups(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	_, resp := th.Client.GetLdapGroups()
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp := client.GetLdapGroups()
		CheckNotImplementedStatus(t, resp)
	})
}

func TestLinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup(t)
	defer th.TearDown()

	_, resp := th.Client.LinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.LinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}

func TestUnlinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup(t)
	defer th.TearDown()

	_, resp := th.Client.UnlinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UnlinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}

func TestMigrateIdLdap(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	_, resp := th.Client.MigrateIdLdap("objectGUID")
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp = client.MigrateIdLdap("")
		CheckBadRequestStatus(t, resp)

		_, resp = client.MigrateIdLdap("objectGUID")
		CheckNotImplementedStatus(t, resp)
	})
}
