// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
)

func TestTestLdap(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.TestLdap()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestLdap()
	CheckNotImplementedStatus(t, resp)
}

func TestSyncLdap(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.SystemAdminClient.SyncLdap()
	CheckNoError(t, resp)

	_, resp = th.Client.SyncLdap()
	CheckForbiddenStatus(t, resp)
}

func TestGetLdapGroups(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.GetLdapGroups()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetLdapGroups()
	CheckNotImplementedStatus(t, resp)
}

func TestLinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.LinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.LinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}

func TestUnlinkLdapGroup(t *testing.T) {
	const entryUUID string = "foo"

	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.UnlinkLdapGroup(entryUUID)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UnlinkLdapGroup(entryUUID)
	CheckNotImplementedStatus(t, resp)
}
