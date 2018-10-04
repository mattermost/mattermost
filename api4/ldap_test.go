// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
)

func TestTestLdap(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	_, resp := th.Client.TestLdap()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestLdap()
	CheckNotImplementedStatus(t, resp)
}

func TestSyncLdap(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	_, resp := th.SystemAdminClient.SyncLdap()
	CheckNoError(t, resp)

	_, resp = th.Client.SyncLdap()
	CheckForbiddenStatus(t, resp)
}

func TestGetChildLdapGroups(t *testing.T) {
	const testDN string = "cn=developers,ou=testusers,dc=mm,dc=test,dc=com"

	th := Setup().InitBasic().InitSystemAdmin()

	_, resp := th.Client.GetChildLdapGroups(testDN)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetChildLdapGroups(testDN)
	CheckNotImplementedStatus(t, resp)
}

func TestLinkLdapGroup(t *testing.T) {
	const testDN string = "cn=tgroup,ou=testusers,dc=mm,dc=test,dc=com"

	th := Setup().InitBasic().InitSystemAdmin()

	_, resp := th.Client.LinkLdapGroup(testDN)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.LinkLdapGroup(testDN)
	CheckNotImplementedStatus(t, resp)
}

func TestUnlinkLdapGroup(t *testing.T) {
	const testDN string = "cn=tgroup,ou=testusers,dc=mm,dc=test,dc=com"

	th := Setup().InitBasic().InitSystemAdmin()

	_, resp := th.Client.UnlinkLdapGroup(testDN)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UnlinkLdapGroup(testDN)
	CheckNotImplementedStatus(t, resp)
}
